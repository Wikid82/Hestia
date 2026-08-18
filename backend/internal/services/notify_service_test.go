package services_test

import (
	"context"
	"errors"
	"testing"

	"hestia/backend/internal/models"
	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestNotifyService_GetSettingsDefaultsToUnconfigured(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	settings, err := svc.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings returned an error: %v", err)
	}
	if settings.Provider != "" {
		t.Errorf("expected an unconfigured default, got provider %q", settings.Provider)
	}
}

func TestNotifyService_UpdateSettingsValidConfig(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	settings, err := svc.UpdateSettings("webhook", map[string]any{"url": "https://example.com/hook"})
	if err != nil {
		t.Fatalf("UpdateSettings returned an error: %v", err)
	}
	if settings.Provider != "webhook" {
		t.Errorf("Provider = %q, want webhook", settings.Provider)
	}

	got, err := svc.GetSettings()
	if err != nil {
		t.Fatalf("GetSettings after update returned an error: %v", err)
	}
	if got.Provider != "webhook" {
		t.Errorf("persisted provider = %q, want webhook", got.Provider)
	}
}

func TestNotifyService_UpdateSettingsUnknownProviderRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	if _, err := svc.UpdateSettings("carrier-pigeon", map[string]any{}); err == nil {
		t.Error("expected an error for an unknown provider")
	}
}

func TestNotifyService_UpdateSettingsMissingRequiredFieldRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	if _, err := svc.UpdateSettings("pushover", map[string]any{"user_key": "x"}); err == nil {
		t.Error("expected an error when a required field (api_token) is missing")
	}
}

func TestNotifyService_UpdateSettingsClearsProvider(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	if _, err := svc.UpdateSettings("webhook", map[string]any{"url": "https://example.com/hook"}); err != nil {
		t.Fatalf("initial UpdateSettings: %v", err)
	}
	settings, err := svc.UpdateSettings("", map[string]any{})
	if err != nil {
		t.Fatalf("clearing settings returned an error: %v", err)
	}
	if settings.Provider != "" {
		t.Errorf("expected provider to be cleared, got %q", settings.Provider)
	}
}

func TestNotifyService_NotifyNoOpsWhenUnconfigured(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	err := svc.Notify(context.Background(), "test.event", "Title", "Body", nil)
	if err != nil {
		t.Errorf("Notify with nothing configured should silently no-op, got: %v", err)
	}
}

func TestNotifyService_SendTestFailsWhenUnconfigured(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	err := svc.SendTest(context.Background())
	if !errors.Is(err, services.ErrNotificationsNotConfigured) {
		t.Errorf("SendTest with nothing configured: err = %v, want ErrNotificationsNotConfigured", err)
	}
}

func TestNotifyService_CorruptStoredConfigSurfacesAsError(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewNotifyService(db)

	// Bypass UpdateSettings' own validation to simulate a row that
	// somehow ended up with unparseable JSON (e.g. hand-edited in the
	// DB) — Notify/SendTest should surface a clear error, not panic.
	if err := db.Save(&models.NotificationSettings{
		ID: models.NotificationSettingsID, Provider: "webhook", ConfigJSON: "not json",
	}).Error; err != nil {
		t.Fatalf("seeding a corrupt settings row: %v", err)
	}

	if err := svc.Notify(context.Background(), "test.event", "T", "B", nil); err == nil {
		t.Error("expected Notify to surface an error for corrupt stored config")
	}
	if err := svc.SendTest(context.Background()); err == nil {
		t.Error("expected SendTest to surface an error for corrupt stored config")
	}
}

func TestNotifyService_GetSettingsPropagatesUnexpectedDBError(t *testing.T) {
	db := testutil.NewDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("getting underlying *sql.DB: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("closing DB: %v", err)
	}

	svc := services.NewNotifyService(db)
	if _, err := svc.GetSettings(); err == nil {
		t.Error("expected GetSettings to propagate an error once the DB connection is closed")
	}
}
