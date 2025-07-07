package main

import (
	"log"

	"github.com/dexteresc/tether/config"
	"github.com/dexteresc/tether/handlers"
	"github.com/dexteresc/tether/models"
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
	)

	if err != nil {
		log.Panic("Failed to auto migrate database: " + err.Error())
	}

	r := gin.Default()

	api := r.Group("/api")
	{

		api.POST("/users", handlers.CreateUser)
		api.GET("/users/:id", handlers.GetUser)
		api.PUT("/users/:id", handlers.UpdateUser)
		api.DELETE("/users/:id", handlers.DeleteUser)

		api.GET("/sources", handlers.GetSources)
		api.POST("/sources", handlers.CreateSource)
		api.GET("/sources/:id", handlers.GetSource)
		api.PUT("/sources/:id", handlers.UpdateSource)
		api.DELETE("/sources/:id", handlers.DeleteSource)

		api.GET("/entities", handlers.GetEntities)
		api.POST("/entities", handlers.CreateEntity)
		api.GET("/entities/:id", handlers.GetEntity)
		api.PUT("/entities/:id", handlers.UpdateEntity)
		api.DELETE("/entities/:id", handlers.DeleteEntity)

		api.GET("/relations", handlers.GetRelations)
		api.POST("/relations", handlers.CreateRelation)
		api.GET("/relations/:id", handlers.GetRelation)
		api.PUT("/relations/:id", handlers.UpdateRelation)
		api.DELETE("/relations/:id", handlers.DeleteRelation)

		api.GET("/identifiers", handlers.GetIdentifiers)
		api.POST("/identifiers", handlers.CreateIdentifier)
		api.GET("/identifiers/:id", handlers.GetIdentifier)
		api.PUT("/identifiers/:id", handlers.UpdateIdentifier)
		api.DELETE("/identifiers/:id", handlers.DeleteIdentifier)

		api.GET("/intel", handlers.GetIntel)
		api.POST("/intel", handlers.CreateIntel)
		api.GET("/intel/:id", handlers.GetIntelByID)
		api.PUT("/intel/:id", handlers.UpdateIntel)
		api.DELETE("/intel/:id", handlers.DeleteIntel)

		api.GET("/intel-entities", handlers.GetIntelEntities)
		api.POST("/intel-entities", handlers.CreateIntelEntity)
		api.GET("/intel-entities/:id", handlers.GetIntelEntity)
		api.PUT("/intel-entities/:id", handlers.UpdateIntelEntity)
		api.DELETE("/intel-entities/:id", handlers.DeleteIntelEntity)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Start server
	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
