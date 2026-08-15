// Package config loads Hestia's runtime configuration from environment
// variables.
package config

import (
	"fmt"
	"os"
)

// Config holds all environment-derived settings for the API server.
type Config struct {
	Port       string
	DBPath     string
	AuthSecret string
	Production bool
	StaticDir  string
}

// Load reads configuration from the environment. It fails fast if
// AUTH_SECRET is unset, matching the old Next.js app's behavior.
func Load() (*Config, error) {
	authSecret := os.Getenv("AUTH_SECRET")
	if authSecret == "" {
		return nil, fmt.Errorf("AUTH_SECRET environment variable is not set")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/hestia.db"
	}

	production := os.Getenv("NODE_ENV") == "production" || os.Getenv("GIN_MODE") == "release"

	// StaticDir is optional and has no default: unset means "don't serve
	// static files", which is what local dev wants when the frontend is
	// served separately via `vite dev`. Set it (e.g. to the built frontend's
	// dist directory) to have the Go server also serve the SPA.
	staticDir := os.Getenv("STATIC_DIR")

	return &Config{
		Port:       port,
		DBPath:     dbPath,
		AuthSecret: authSecret,
		Production: production,
		StaticDir:  staticDir,
	}, nil
}
