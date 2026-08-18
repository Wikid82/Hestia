package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

// mustCreateUser inserts a household + user with the given email/password
// directly via GORM, for service-level tests that don't need the full HTTP
// signup flow.
func mustCreateUser(t *testing.T, db *gorm.DB, email, password string) *models.User {
	t.Helper()
	householdID := uuid.NewString()
	household := &models.Household{ID: householdID, Name: "Test HH", ThemePreference: "system"}
	if err := db.Create(household).Error; err != nil {
		t.Fatalf("creating test household: %v", err)
	}
	passwordHash, err := services.HashSecret(password)
	if err != nil {
		t.Fatalf("hashing test password: %v", err)
	}
	user := &models.User{
		ID:           uuid.NewString(),
		HouseholdID:  householdID,
		Name:         "Test User",
		AvatarEmoji:  "🙂",
		Role:         "hoh",
		Email:        &email,
		PasswordHash: &passwordHash,
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("creating test user: %v", err)
	}
	return user
}

// mustCreateManagedProfile inserts a household + a profile with no
// email/password login at all (a PIN-only managed profile).
func mustCreateManagedProfile(t *testing.T, db *gorm.DB) *models.User {
	t.Helper()
	householdID := uuid.NewString()
	household := &models.Household{ID: householdID, Name: "Test HH", ThemePreference: "system"}
	if err := db.Create(household).Error; err != nil {
		t.Fatalf("creating test household: %v", err)
	}
	managed := &models.User{ID: uuid.NewString(), HouseholdID: householdID, Name: "Kid", AvatarEmoji: "🙂", Role: "member"}
	if err := db.Create(managed).Error; err != nil {
		t.Fatalf("creating managed profile: %v", err)
	}
	return managed
}

func TestPasswordResetService_CreateReset_UnknownEmailReturnsNil(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)

	reset, rawToken, err := svc.CreateReset("nobody@example.com")
	if err != nil {
		t.Fatalf("CreateReset: %v", err)
	}
	if reset != nil || rawToken != "" {
		t.Errorf("expected (nil, \"\", nil) for an unknown email, got (%v, %q, nil)", reset, rawToken)
	}
}

func TestPasswordResetService_CreateReset_ManagedProfileHasNoResetPath(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	mustCreateManagedProfile(t, db)

	// A managed profile has no email at all, so it can never be looked up
	// by CreateReset — confirming the empty-email lookup is a no-op, same
	// as any other unmatched email.
	reset, rawToken, err := svc.CreateReset("")
	if err != nil {
		t.Fatalf("CreateReset: %v", err)
	}
	if reset != nil || rawToken != "" {
		t.Errorf("expected (nil, \"\", nil) for an empty email, got (%v, %q, nil)", reset, rawToken)
	}
}

func TestPasswordResetService_CreateReset_SupersedesPriorPending(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	user := mustCreateUser(t, db, "reset@example.com", "password123")

	first, _, err := svc.CreateReset(*user.Email)
	if err != nil {
		t.Fatalf("first CreateReset: %v", err)
	}
	if first == nil {
		t.Fatal("expected a non-nil reset for a known email")
	}
	_, _, err = svc.CreateReset(*user.Email)
	if err != nil {
		t.Fatalf("second CreateReset: %v", err)
	}

	var reloaded models.PasswordReset
	if err := db.Where("id = ?", first.ID).First(&reloaded).Error; err != nil {
		t.Fatalf("reloading first reset: %v", err)
	}
	if reloaded.UsedAt == nil {
		t.Error("expected the first reset to be superseded (marked used)")
	}
}

func TestPasswordResetService_CreateReset_UserLookupDBErrorPropagates(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	testutil.PoisonTable(db, "users")

	_, _, err := svc.CreateReset("whoever@example.com")
	if err == nil {
		t.Error("expected a DB error to propagate from the user lookup")
	}
}

func TestPasswordResetService_CreateReset_SupersedeUpdateDBErrorPropagates(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	user := mustCreateUser(t, db, "supersede-fail@example.com", "password123")
	testutil.PoisonTable(db, "password_resets")

	_, _, err := svc.CreateReset(*user.Email)
	if err == nil {
		t.Error("expected a DB error to propagate when superseding a prior pending reset fails")
	}
}

func TestPasswordResetService_Reset_LookupDBErrorPropagates(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	testutil.PoisonTable(db, "password_resets")

	err := svc.Reset("whatever-token", "brand-new-password")
	if err == nil || err == services.ErrPasswordResetNotFound {
		t.Errorf("err = %v, want a generic DB error (not ErrPasswordResetNotFound)", err)
	}
}

func TestPasswordResetService_Reset_UnknownTokenReturnsNotFound(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)

	err := svc.Reset("not-a-real-token", "brand-new-password")
	if err != services.ErrPasswordResetNotFound {
		t.Errorf("err = %v, want ErrPasswordResetNotFound", err)
	}
}

func TestPasswordResetService_Reset_ExpiredRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	user := mustCreateUser(t, db, "expired@example.com", "password123")

	reset, rawToken, err := svc.CreateReset(*user.Email)
	if err != nil {
		t.Fatalf("CreateReset: %v", err)
	}
	// Force it into the past directly via the DB — CreateReset always sets
	// a future expiry, so this is the only way to construct an
	// expired-but-unused reset for the test.
	if updateErr := db.Model(&models.PasswordReset{}).Where("id = ?", reset.ID).
		Update("expires_at", time.Now().Add(-time.Hour)).Error; updateErr != nil {
		t.Fatalf("forcing expiry: %v", updateErr)
	}

	err = svc.Reset(rawToken, "brand-new-password")
	if err != services.ErrPasswordResetExpired {
		t.Errorf("err = %v, want ErrPasswordResetExpired", err)
	}
}

func TestPasswordResetService_Reset_AlreadyUsedRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	user := mustCreateUser(t, db, "used@example.com", "password123")

	_, rawToken, err := svc.CreateReset(*user.Email)
	if err != nil {
		t.Fatalf("CreateReset: %v", err)
	}
	if resetErr := svc.Reset(rawToken, "brand-new-password"); resetErr != nil {
		t.Fatalf("first Reset: %v", resetErr)
	}

	err = svc.Reset(rawToken, "another-password")
	if err != services.ErrPasswordResetUsed {
		t.Errorf("err = %v, want ErrPasswordResetUsed", err)
	}
}

func TestPasswordResetService_Reset_UpdatesPasswordHash(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPasswordResetService(db)
	user := mustCreateUser(t, db, "changeme@example.com", "old-password")

	_, rawToken, err := svc.CreateReset(*user.Email)
	if err != nil {
		t.Fatalf("CreateReset: %v", err)
	}
	if err := svc.Reset(rawToken, "new-password-123"); err != nil {
		t.Fatalf("Reset: %v", err)
	}

	var reloaded models.User
	if err := db.Where("id = ?", user.ID).First(&reloaded).Error; err != nil {
		t.Fatalf("reloading user: %v", err)
	}
	if reloaded.PasswordHash == nil || !services.VerifySecret("new-password-123", *reloaded.PasswordHash) {
		t.Error("expected the user's password hash to verify against the new password")
	}
	if services.VerifySecret("old-password", *reloaded.PasswordHash) {
		t.Error("expected the old password to no longer verify")
	}
}
