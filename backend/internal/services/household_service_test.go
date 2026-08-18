package services_test

import (
	"errors"
	"testing"

	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestHouseholdService_GetUnknownIDReturnsNotFound(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewHouseholdService(db)

	_, err := svc.Get("does-not-exist")
	if !errors.Is(err, services.ErrNotFound) {
		t.Errorf("Get(unknown id): err = %v, want ErrNotFound", err)
	}
}

func TestHouseholdService_UpdateThemeRejectsInvalidValue(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewHouseholdService(db)
	hhAuth := services.NewHouseholdAuthService(db)

	household, _, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}

	if _, err := svc.UpdateTheme(household.ID, "not-a-real-theme"); err == nil {
		t.Error("expected an error for an invalid theme value")
	}
}
