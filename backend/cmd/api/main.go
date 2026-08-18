// Command api is Hestia's HTTP server entrypoint: loads config, opens the
// database, runs migrations, wires up the router and realtime hub, and
// starts listening.
package main

import (
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/handlers"
	"hestia/backend/internal/api/routes"
	"hestia/backend/internal/config"
	"hestia/backend/internal/database"
	"hestia/backend/internal/realtime"
	"hestia/backend/internal/services"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	hub := realtime.NewHub()
	go hub.Run()

	authService := services.NewAuthService(cfg.AuthSecret)

	deps := &handlers.Deps{
		Auth:              authService,
		Household:         services.NewHouseholdService(db),
		Member:            services.NewMemberService(db),
		Chore:             services.NewChoreService(db),
		Reminder:          services.NewReminderService(db),
		Reward:            services.NewRewardService(db),
		HHAuth:            services.NewHouseholdAuthService(db),
		Mailer:            services.NewMailer(cfg.SMTP),
		Notify:            services.NewNotifyService(db),
		Invite:            services.NewInviteService(db),
		Hub:               hub,
		CookieSecure:      cfg.CookieSecure,
		AllowPublicSignup: cfg.AllowPublicSignup,
		BaseURL:           cfg.BaseURL,
	}

	if cfg.Production {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()
	routes.Register(router, deps, db, authService)

	if cfg.StaticDir != "" {
		serveStatic(router, cfg.StaticDir)
	}

	log.Printf("hestia backend listening on :%s (db: %s)", cfg.Port, cfg.DBPath)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// serveStatic mounts the built frontend (from dir, e.g. frontend/dist) onto
// router: real files (JS/CSS/images/etc.) are served directly, and any other
// GET request that isn't under /api falls back to index.html so client-side
// routes handled by react-router (e.g. /chores) work on a hard refresh.
func serveStatic(router *gin.Engine, dir string) {
	router.Use(static.Serve("/", static.LocalFile(dir, false)))

	indexPath := filepath.Join(dir, "index.html")
	router.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusNotFound)
			return
		}
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Status(http.StatusNotFound)
			return
		}
		c.File(indexPath)
	})
}
