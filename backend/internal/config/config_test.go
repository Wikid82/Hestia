package config

import "testing"

// clearEnv unsets every variable Load reads, so each test starts from a
// clean slate regardless of what's set in the surrounding environment
// (t.Setenv already isolates per-test, but Load reads several optional
// vars that must be *absent*, not just unset-to-empty, for the "not
// configured" branches to trigger correctly).
func clearEnv(t *testing.T) {
	t.Helper()
	for _, v := range []string{
		"AUTH_SECRET", "PORT", "DB_PATH", "NODE_ENV", "GIN_MODE", "STATIC_DIR",
		"BASE_URL", "SMTP_SERVER", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD",
		"SMTP_FROM", "SMTP_USE_TLS", "ALLOW_PUBLIC_SIGNUP",
	} {
		t.Setenv(v, "")
	}
}

func TestLoad_RequiresAuthSecret(t *testing.T) {
	clearEnv(t)
	if _, err := Load(); err == nil {
		t.Error("expected an error when AUTH_SECRET is unset")
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned an error: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.DBPath != "./data/hestia.db" {
		t.Errorf("DBPath = %q, want ./data/hestia.db", cfg.DBPath)
	}
	if cfg.SMTP != nil {
		t.Errorf("expected SMTP to be nil when unconfigured, got %+v", cfg.SMTP)
	}
	if cfg.AllowPublicSignup {
		t.Error("expected AllowPublicSignup to default to false")
	}
	if cfg.Production {
		t.Error("expected Production to default to false")
	}
}

func TestLoad_OverridesFromEnv(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("PORT", "9090")
	t.Setenv("DB_PATH", "/tmp/custom.db")
	t.Setenv("GIN_MODE", "release")
	t.Setenv("STATIC_DIR", "/app/web")
	t.Setenv("ALLOW_PUBLIC_SIGNUP", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned an error: %v", err)
	}
	if cfg.Port != "9090" || cfg.DBPath != "/tmp/custom.db" || cfg.StaticDir != "/app/web" {
		t.Errorf("cfg = %+v, overrides not applied", cfg)
	}
	if !cfg.Production {
		t.Error("expected GIN_MODE=release to set Production true")
	}
	if !cfg.AllowPublicSignup {
		t.Error("expected ALLOW_PUBLIC_SIGNUP=true to be honored")
	}
}

func TestLoad_AllowPublicSignupAcceptsNumericOne(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("ALLOW_PUBLIC_SIGNUP", "1")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned an error: %v", err)
	}
	if !cfg.AllowPublicSignup {
		t.Error("expected ALLOW_PUBLIC_SIGNUP=1 to be honored")
	}
}

func TestLoad_NodeEnvProductionAlsoSetsProduction(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("NODE_ENV", "production")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned an error: %v", err)
	}
	if !cfg.Production {
		t.Error("expected NODE_ENV=production to set Production true")
	}
}

func TestLoad_SMTPFullyConfigured(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("BASE_URL", "https://hestia.example.com")
	t.Setenv("SMTP_SERVER", "smtp.example.com")
	t.Setenv("SMTP_PORT", "587")
	t.Setenv("SMTP_FROM", "hestia@example.com")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned an error: %v", err)
	}
	if cfg.SMTP == nil {
		t.Fatal("expected SMTP to be configured")
	}
	if cfg.SMTP.Server != "smtp.example.com" || cfg.SMTP.Port != "587" || cfg.SMTP.From != "hestia@example.com" {
		t.Errorf("SMTP = %+v", cfg.SMTP)
	}
	if !cfg.SMTP.UseTLS {
		t.Error("expected UseTLS to default to true")
	}
}

func TestLoad_SMTPUseTLSFalse(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("BASE_URL", "https://hestia.example.com")
	t.Setenv("SMTP_SERVER", "smtp.example.com")
	t.Setenv("SMTP_PORT", "587")
	t.Setenv("SMTP_FROM", "hestia@example.com")
	t.Setenv("SMTP_USE_TLS", "false")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load returned an error: %v", err)
	}
	if cfg.SMTP.UseTLS {
		t.Error("expected SMTP_USE_TLS=false to disable UseTLS")
	}
}

func TestLoad_SMTPPartiallyConfiguredFailsFast(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("SMTP_SERVER", "smtp.example.com")
	// SMTP_PORT and SMTP_FROM deliberately left unset.

	if _, err := Load(); err == nil {
		t.Error("expected an error when only some SMTP_* variables are set")
	}
}

func TestLoad_SMTPConfiguredWithoutBaseURLFailsFast(t *testing.T) {
	clearEnv(t)
	t.Setenv("AUTH_SECRET", "test-secret")
	t.Setenv("SMTP_SERVER", "smtp.example.com")
	t.Setenv("SMTP_PORT", "587")
	t.Setenv("SMTP_FROM", "hestia@example.com")
	// BASE_URL deliberately left unset.

	if _, err := Load(); err == nil {
		t.Error("expected an error when SMTP is configured but BASE_URL is not")
	}
}
