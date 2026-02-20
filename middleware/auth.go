package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type jwksKey struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
}

type jwksResponse struct {
	Keys []jwksKey `json:"keys"`
}

func SupabaseAuth() gin.HandlerFunc {
	secret := os.Getenv("SUPABASE_JWT_SECRET")
	supabaseURL := os.Getenv("SUPABASE_URL")

	// Fetch JWKS for ES256 support
	ecKeys := make(map[string]*ecdsa.PublicKey)
	if supabaseURL != "" {
		resp, err := http.Get(supabaseURL + "/auth/v1/.well-known/jwks.json")
		if err == nil {
			defer resp.Body.Close()
			var jwks jwksResponse
			if json.NewDecoder(resp.Body).Decode(&jwks) == nil {
				for _, k := range jwks.Keys {
					if k.Kty == "EC" && k.Crv == "P-256" {
						xBytes, _ := base64.RawURLEncoding.DecodeString(k.X)
						yBytes, _ := base64.RawURLEncoding.DecodeString(k.Y)
						ecKeys[k.Kid] = &ecdsa.PublicKey{
							Curve: elliptic.P256(),
							X:     new(big.Int).SetBytes(xBytes),
							Y:     new(big.Int).SetBytes(yBytes),
						}
					}
				}
				log.Printf("Loaded %d JWKS key(s) from Supabase", len(ecKeys))
			}
		}
	}

	if secret == "" && len(ecKeys) == 0 {
		panic("SUPABASE_JWT_SECRET or SUPABASE_URL with JWKS is required")
	}

	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization header"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			switch token.Method.(type) {
			case *jwt.SigningMethodECDSA:
				kid, _ := token.Header["kid"].(string)
				if key, ok := ecKeys[kid]; ok {
					return key, nil
				}
				return nil, fmt.Errorf("unknown kid: %s", kid)
			case *jwt.SigningMethodHMAC:
				if secret == "" {
					return nil, fmt.Errorf("HS256 not configured")
				}
				return []byte(secret), nil
			default:
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid claims"})
			return
		}

		sub, _ := claims["sub"].(string)
		email, _ := claims["email"].(string)
		if sub == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing user ID in token"})
			return
		}

		user, err := getOrCreateUser(sub, email)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync user"})
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

func getOrCreateUser(supabaseID, email string) (*models.User, error) {
	var user models.User
	err := config.DB.Preload("Entity.Identifiers").Where("supabase_id = ?", supabaseID).First(&user).Error
	if err == nil {
		return &user, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		entity := models.Entity{
			Type: "person",
			Data: datatypes.JSON(fmt.Sprintf(`{"user": true, "name": "%s"}`, email)),
		}
		if err := tx.Create(&entity).Error; err != nil {
			return err
		}

		user = models.User{
			SupabaseID: supabaseID,
			EntityID:   entity.ID,
			Email:      email,
			Active:     true,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}

		identifier := models.Identifier{
			EntityID: entity.ID,
			Type:     "email",
			Value:    email,
		}
		if err := tx.Create(&identifier).Error; err != nil {
			return err
		}

		return tx.Preload("Entity.Identifiers").First(&user, user.ID).Error
	})

	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserFromContext extracts the user set by the auth middleware.
func GetUserFromContext(c *gin.Context) (*models.User, bool) {
	val, exists := c.Get("user")
	if !exists {
		return nil, false
	}
	user, ok := val.(*models.User)
	return user, ok
}
