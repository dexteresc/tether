package main

import (
	"log"
	"time"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/handlers"
	"github.com/dexteresc/tether/models"
	"github.com/dexteresc/tether/services"
	"github.com/gin-gonic/gin"
)

func main() {
	config.ConnectDatabase()
	err := config.DB.AutoMigrate(
		&models.Source{},
		&models.Entity{},
		&models.Relation{},
		&models.Identifier{},
		&models.Intel{},
		&models.IntelEntity{},
		&models.User{},
	)

	if err != nil {
		log.Panic("Failed to auto migrate database: " + err.Error())
	}

	// JWT middleware
	authMiddleware, err := jwt.New(&jwt.GinJWTMiddleware{
		Realm:       "tether",
		Key:         []byte("secret"),
		Timeout:     24 * time.Hour,
		MaxRefresh:  24 * time.Hour,
		IdentityKey: "email",

		Authenticator: func(c *gin.Context) (interface{}, error) {
			var login models.Login
			if err := c.ShouldBindJSON(&login); err != nil {
				return nil, jwt.ErrMissingLoginValues
			}
			user, err := services.AuthenticateUser(login.Email, login.Password)
			if err != nil {
				return nil, jwt.ErrFailedAuthentication
			}
			return user, nil
		},

		Authorizator: func(data interface{}, c *gin.Context) bool {

			if user, ok := data.(*models.User); ok {
				isAuthorized := user != nil
				return isAuthorized
			}
			return false
		},

		PayloadFunc: func(data interface{}) jwt.MapClaims {
			if user, ok := data.(*models.User); ok {
				claims := jwt.MapClaims{
					"email": user.Email,
					"id":    user.ID,
				}
				return claims
			}
			return jwt.MapClaims{}
		},

		IdentityHandler: func(c *gin.Context) interface{} {
			claims := jwt.ExtractClaims(c)

			email, ok := claims["email"].(string)
			if !ok {
				return nil
			}

			user, err := services.GetUserByEmail(email)
			if err != nil {
				return nil
			}

			return user
		},

		Unauthorized: func(c *gin.Context, code int, message string) {
			c.JSON(code, gin.H{"error": message})
		},

		TokenLookup:   "header: Authorization, query: token, cookie: jwt",
		TokenHeadName: "Bearer",
		TimeFunc:      time.Now,
	})
	if err != nil {
		log.Panic("JWT Error: " + err.Error())
	}

	r := gin.Default()
	// Public routes
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authMiddleware.LoginHandler)
		auth.GET("/refresh_token", authMiddleware.RefreshHandler)
		auth.POST("/register", handlers.CreateUser)
		// auth.POST("/forgot_password", handlers.ForgotPassword)
	}

	// JWT-protected routes

	api := r.Group("/api")
	api.Use(authMiddleware.MiddlewareFunc())
	{
		api.GET("/auth/me", handlers.GetCurrentUser)
		users := api.Group("/users")
		{
			// TODO: Elevate users endpoints to admin or superuser roles
			users.GET("/:id", handlers.GetUser)
			users.PUT("/:id", handlers.UpdateUser)
			users.DELETE("/:id", handlers.DeleteUser)
		}

		sources := api.Group("/sources")
		{
			sources.GET("/", handlers.GetSources)
			sources.POST("/", handlers.CreateSource)
			sources.GET("/:id", handlers.GetSource)
			sources.PUT("/:id", handlers.UpdateSource)
			sources.DELETE("/:id", handlers.DeleteSource)
		}

		entities := api.Group("/entities")
		{
			entities.GET("/", handlers.GetEntities)
			entities.POST("/", handlers.CreateEntity)
			entities.GET("/:id", handlers.GetEntity)
			entities.PUT("/:id", handlers.UpdateEntity)
			entities.DELETE("/:id", handlers.DeleteEntity)
		}

		relations := api.Group("/relations")
		{
			relations.GET("/", handlers.GetRelations)
			relations.POST("/", handlers.CreateRelation)
			relations.GET("/:id", handlers.GetRelation)
			relations.PUT("/:id", handlers.UpdateRelation)
			relations.DELETE("/:id", handlers.DeleteRelation)
		}

		identifiers := api.Group("/identifiers")
		{
			identifiers.GET("/", handlers.GetIdentifiers)
			identifiers.POST("/", handlers.CreateIdentifier)
			identifiers.GET("/:id", handlers.GetIdentifier)
			identifiers.PUT("/:id", handlers.UpdateIdentifier)
			identifiers.DELETE("/:id", handlers.DeleteIdentifier)
		}

		intel := api.Group("/intel")
		{
			intel.GET("/", handlers.GetIntel)
			intel.POST("/", handlers.CreateIntel)
			intel.GET("/:id", handlers.GetIntelByID)
			intel.PUT("/:id", handlers.UpdateIntel)
			intel.DELETE("/:id", handlers.DeleteIntel)
		}
		intelEntities := api.Group("/intel-entities")
		{
			intelEntities.GET("/", handlers.GetIntelEntities)
			intelEntities.POST("/", handlers.CreateIntelEntity)
			intelEntities.GET("/:id", handlers.GetIntelEntity)
			intelEntities.PUT("/:id", handlers.UpdateIntelEntity)
			intelEntities.DELETE("/:id", handlers.DeleteIntelEntity)
		}

		processor := services.NewIntelligenceProcessor(config.DB)
		llmHandler := handlers.NewLLMHandler(processor)

		llm := api.Group("/llm")
		{
			llm.POST("/process", llmHandler.ProcessIntelligence)
			llm.POST("/preview", llmHandler.PreviewExtraction)
		}
	}

	// Start server
	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
