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
	"sync"
	"time"

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

// jwksCache holds JWKS keys with a TTL for periodic refresh.
type jwksCache struct {
	mu          sync.RWMutex
	keys        map[string]*ecdsa.PublicKey
	lastFetched time.Time
	ttl         time.Duration
	jwksURL     string
}

func newJWKSCache(supabaseURL string, ttl time.Duration) *jwksCache {
	return &jwksCache{
		keys:    make(map[string]*ecdsa.PublicKey),
		ttl:     ttl,
		jwksURL: supabaseURL + "/auth/v1/.well-known/jwks.json",
	}
}

func (c *jwksCache) getKey(kid string) (*ecdsa.PublicKey, bool) {
	c.mu.RLock()
	stale := time.Since(c.lastFetched) > c.ttl
	key, ok := c.keys[kid]
	c.mu.RUnlock()

	// If key found and not stale, return it
	if ok && !stale {
		return key, true
	}

	// If stale or key not found, refresh
	c.refresh()

	c.mu.RLock()
	key, ok = c.keys[kid]
	c.mu.RUnlock()
	return key, ok
}

func (c *jwksCache) refresh() {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Double-check: another goroutine may have refreshed while we waited for the lock
	if time.Since(c.lastFetched) < c.ttl/2 {
		return
	}

	resp, err := http.Get(c.jwksURL)
	if err != nil {
		log.Printf("Failed to refresh JWKS: %v", err)
		return
	}
	defer resp.Body.Close()

	var jwks jwksResponse
	if json.NewDecoder(resp.Body).Decode(&jwks) != nil {
		log.Printf("Failed to decode JWKS response")
		return
	}

	newKeys := make(map[string]*ecdsa.PublicKey)
	for _, k := range jwks.Keys {
		if k.Kty == "EC" && k.Crv == "P-256" {
			xBytes, err := base64.RawURLEncoding.DecodeString(k.X)
			if err != nil {
				log.Printf("Failed to decode JWKS key X coordinate for kid %s: %v", k.Kid, err)
				continue
			}
			yBytes, err := base64.RawURLEncoding.DecodeString(k.Y)
			if err != nil {
				log.Printf("Failed to decode JWKS key Y coordinate for kid %s: %v", k.Kid, err)
				continue
			}
			newKeys[k.Kid] = &ecdsa.PublicKey{
				Curve: elliptic.P256(),
				X:     new(big.Int).SetBytes(xBytes),
				Y:     new(big.Int).SetBytes(yBytes),
			}
		}
	}

	if len(newKeys) > 0 {
		c.keys = newKeys
		c.lastFetched = time.Now()
		log.Printf("Refreshed %d JWKS key(s) from Supabase", len(newKeys))
	}
}

func (c *jwksCache) keyCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.keys)
}

func SupabaseAuth() gin.HandlerFunc {
	supabaseURL := os.Getenv("SUPABASE_URL")

	// Initialize JWKS cache with 1-hour TTL
	cache := newJWKSCache(supabaseURL, 1*time.Hour)
	cache.refresh()

	if cache.keyCount() == 0 {
		panic("SUPABASE_URL with JWKS is required")
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
			if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			kid, _ := token.Header["kid"].(string)
			if key, ok := cache.getKey(kid); ok {
				return key, nil
			}
			return nil, fmt.Errorf("unknown kid: %s", kid)
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
		// Fix #1: Use json.Marshal instead of fmt.Sprintf to prevent JSON injection
		dataMap := map[string]interface{}{"user": true, "name": email}
		dataBytes, err := json.Marshal(dataMap)
		if err != nil {
			return fmt.Errorf("failed to marshal entity data: %w", err)
		}

		entity := models.Entity{
			Type: "person",
			Data: datatypes.JSON(dataBytes),
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
