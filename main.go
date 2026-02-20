package main

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/handlers"
	"github.com/dexteresc/tether/middleware"
	"github.com/dexteresc/tether/models"
	"github.com/dexteresc/tether/services"
	"github.com/gin-contrib/cors"
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

	r := gin.Default()

	// CORS
	allowedOrigins := []string{"http://localhost:5173"}
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		allowedOrigins = append(allowedOrigins, strings.Split(extra, ",")...)
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public routes
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// JWT-protected routes (Supabase Auth)
	api := r.Group("/api")
	api.Use(middleware.SupabaseAuth())
	{
		api.GET("/auth/me", handlers.GetCurrentUser)

		users := api.Group("/users")
		{
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
