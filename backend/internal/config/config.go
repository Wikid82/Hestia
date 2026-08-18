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
	// BaseURL is the externally-reachable URL of this instance (e.g.
	// https://hestia.example.com), used to build links in outbound email
	// such as invite-accept links. Required when SMTP is configured.
	BaseURL string
	// SMTP is nil when outbound email isn't configured — that's a valid
	// state (e.g. no invite system in use yet), not an error. It's only
	// non-nil once every required SMTP variable is set.
	SMTP *SMTPConfig
	// AllowPublicSignup gates POST /auth/signup for every signup after
	// the very first (which always succeeds regardless of this flag —
	// otherwise a fresh instance could never be bootstrapped). Defaults
	// to false: this app has no real users yet, so nobody should be able
	// to spin up a household on someone else's found instance without an
	// invite. An instance owner opts in explicitly; once they do, the
	// security implications of open signup on their instance are theirs
	// to own. See CLAUDE.md's "Product shape" section.
	AllowPublicSignup bool
}

// SMTPConfig holds outbound-email settings. Deliberately env-var-only
// (see CLAUDE.md's "Product shape" section) rather than DB/web-UI-
// editable: it's a credential to an external system, and storing it
// reversibly in the same sqlite file the README tells self-hosters to
// "just copy to back up" would be a meaningfully worse security posture
// than the current AUTH_SECRET-style env-var pattern.
type SMTPConfig struct {
	Host     string
	Port     string
	Username string // optional: some relays don't require auth
	Password string // optional: see Username
	From     string
	UseTLS   bool
}

// Load reads configuration from the environment. It fails fast if
// AUTH_SECRET is unset, matching the old Next.js app's behavior, and
// applies the same fail-fast treatment to a partially-configured SMTP
// setup (better to refuse to boot than silently never send invite
// emails).
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

	baseURL := os.Getenv("BASE_URL")

	smtp, err := loadSMTPConfig(baseURL)
	if err != nil {
		return nil, err
	}

	allowPublicSignup := os.Getenv("ALLOW_PUBLIC_SIGNUP") == "true" || os.Getenv("ALLOW_PUBLIC_SIGNUP") == "1"

	return &Config{
		Port:              port,
		DBPath:            dbPath,
		AuthSecret:        authSecret,
		Production:        production,
		StaticDir:         staticDir,
		BaseURL:           baseURL,
		SMTP:              smtp,
		AllowPublicSignup: allowPublicSignup,
	}, nil
}

// loadSMTPConfig reads SMTP_* variables. Returns (nil, nil) if none are
// set at all (SMTP simply isn't configured). Returns an error if only
// some of the required variables are set, or if BASE_URL is missing —
// a half-configured mail setup would fail silently at send time
// otherwise.
func loadSMTPConfig(baseURL string) (*SMTPConfig, error) {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" && portStr == "" && from == "" && username == "" && password == "" {
		return nil, nil
	}
	if host == "" || portStr == "" || from == "" {
		return nil, fmt.Errorf("SMTP_HOST, SMTP_PORT, and SMTP_FROM must all be set together to enable outbound email (SMTP_USERNAME/SMTP_PASSWORD are optional, for relays that don't require auth)")
	}
	if baseURL == "" {
		return nil, fmt.Errorf("BASE_URL must be set when SMTP is configured — it's used to build links (e.g. invite-accept links) in outbound email")
	}

	useTLS := true
	if v := os.Getenv("SMTP_USE_TLS"); v != "" {
		useTLS = v != "false" && v != "0"
	}

	return &SMTPConfig{
		Host:     host,
		Port:     portStr,
		Username: username,
		Password: password,
		From:     from,
		UseTLS:   useTLS,
	}, nil
}
