package testutil

import (
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hestia/backend/internal/api/handlers"
	"hestia/backend/internal/api/routes"
	"hestia/backend/internal/config"
	"hestia/backend/internal/database"
	"hestia/backend/internal/realtime"
	"hestia/backend/internal/services"
)

// App is a full, real Hestia backend (real temp-file SQLite DB, real
// routes, real services) running in-process behind an httptest.Server —
// the same wiring backend/cmd/api/main.go does, factored out so tests can
// reuse it. A real (fake but protocol-real) SMTP listener backs the
// mailer, so invite-email flows can be exercised end to end, not just
// mocked.
type App struct {
	Server  *httptest.Server
	SMTP    *FakeSMTP
	BaseURL string
	DB      *gorm.DB
}

// newPushService wires services.NewPushService with
// services.WithAllowHTTPTransport when allowHTTP is set — see
// Options.PushAllowHTTP.
func newPushService(db *gorm.DB, baseURL string, allowHTTP bool) *services.PushService {
	if allowHTTP {
		return services.NewPushService(db, baseURL, services.WithAllowHTTPTransport())
	}
	return services.NewPushService(db, baseURL)
}

// NewDB opens a fresh temp-file SQLite database with migrations applied —
// for service-level unit tests that don't need a full HTTP server.
func NewDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "hestia.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("opening test database: %v", err)
	}
	return db
}

// Options configures App.New. The zero value is the common case (public
// signup open, so tests can freely create households).
type Options struct {
	// AllowPublicSignup defaults to true when Options is omitted (via
	// New) — set false explicitly (via NewWithOptions) to test the
	// closed-by-default signup gate itself.
	AllowPublicSignup *bool
	// SMTPUnconfigured, when true, wires up the Mailer with a nil SMTP
	// config instead of the fake SMTP listener — for exercising the
	// "outbound email isn't configured on this instance" branches (e.g.
	// forgot-password still returning a generic 200 rather than leaking
	// server config to an unauthenticated caller).
	SMTPUnconfigured bool
	// BaseURL overrides the default "http://localhost:5173" test BASE_URL
	// when non-nil (an empty string included) — for exercising
	// BASE_URL-unset branches, e.g. Web Push's ErrBaseURLNotConfigured.
	BaseURL *string
	// PushAllowHTTP wires the app's PushService with
	// services.WithAllowHTTPTransport, so a test can point a
	// PushSubscription's endpoint at a local httptest.Server and observe
	// real delivery — the default SSRF-safe transport otherwise rejects
	// loopback/plain-HTTP destinations, which is correct in production.
	PushAllowHTTP bool
}

// New starts a fresh App (public signup open) for the duration of the
// test, torn down via t.Cleanup.
func New(t *testing.T) *App {
	t.Helper()
	return NewWithOptions(t, Options{})
}

// NewWithOptions is like New but lets a test override defaults, e.g. to
// exercise ALLOW_PUBLIC_SIGNUP=false.
func NewWithOptions(t *testing.T, opts Options) *App {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "hestia.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("opening test database: %v", err)
	}

	smtp := StartFakeSMTP(t)
	host, port, err := net.SplitHostPort(smtp.Addr)
	if err != nil {
		t.Fatalf("splitting fake SMTP address: %v", err)
	}

	hub := realtime.NewHub()
	go hub.Run()

	authService := services.NewAuthService("test-auth-secret")

	baseURL := "http://localhost:5173"
	if opts.BaseURL != nil {
		baseURL = *opts.BaseURL
	}
	var mailerCfg *config.SMTPConfig
	if !opts.SMTPUnconfigured {
		mailerCfg = &config.SMTPConfig{
			Server: host,
			Port:   port,
			From:   "hestia@example.com",
			UseTLS: false,
		}
	}

	allowPublicSignup := true
	if opts.AllowPublicSignup != nil {
		allowPublicSignup = *opts.AllowPublicSignup
	}

	deps := &handlers.Deps{
		Auth:              authService,
		Household:         services.NewHouseholdService(db),
		Member:            services.NewMemberService(db),
		Chore:             services.NewChoreService(db),
		Reminder:          services.NewReminderService(db),
		Reward:            services.NewRewardService(db),
		HHAuth:            services.NewHouseholdAuthService(db),
		Mailer:            services.NewMailer(mailerCfg),
		Notify:            services.NewNotifyService(db),
		Push:              newPushService(db, baseURL, opts.PushAllowHTTP),
		Invite:            services.NewInviteService(db),
		PasswordReset:     services.NewPasswordResetService(db),
		Hub:               hub,
		CookieSecure:      false,
		AllowPublicSignup: allowPublicSignup,
		BaseURL:           baseURL,
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	routes.Register(router, deps, db, authService)

	server := httptest.NewServer(router)
	t.Cleanup(server.Close)

	return &App{Server: server, SMTP: smtp, BaseURL: server.URL, DB: db}
}

// Client returns an *http.Client with its own cookie jar bound to the
// app's server, mimicking one browser session. Call Client() again for a
// second, independent "browser" (e.g. a second household).
func (a *App) Client(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("creating cookie jar: %v", err)
	}
	return &http.Client{Jar: jar}
}
