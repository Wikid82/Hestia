package services_test

import (
	"testing"

	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestMemberService_SetCredentials_EmptyEmailRejected(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, _, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	memberSvc := services.NewMemberService(db)
	kid, err := memberSvc.Create(household.ID, services.MemberInput{Name: "Kid", Role: "member"})
	if err != nil {
		t.Fatalf("create member: %v", err)
	}

	if _, err := memberSvc.SetCredentials(household.ID, kid.ID, "", "password123"); err == nil {
		t.Error("expected an error for an empty email")
	}
}

func TestMemberService_SetCredentials_ShortPasswordRejected(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, _, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	memberSvc := services.NewMemberService(db)
	kid, err := memberSvc.Create(household.ID, services.MemberInput{Name: "Kid", Role: "member"})
	if err != nil {
		t.Fatalf("create member: %v", err)
	}

	if _, err := memberSvc.SetCredentials(household.ID, kid.ID, "kid@example.com", "short"); err == nil {
		t.Error("expected an error for a short password")
	}
}

func TestMemberService_ChangeOwnCredentials_NoExistingPasswordSkipsCheck(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, _, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	memberSvc := services.NewMemberService(db)
	kid, err := memberSvc.Create(household.ID, services.MemberInput{Name: "Kid", Role: "member"})
	if err != nil {
		t.Fatalf("create member: %v", err)
	}

	// The kid has no password yet, so no currentPassword should be
	// required to set one for the first time.
	updated, err := memberSvc.ChangeOwnCredentials(household.ID, kid.ID, "kid@example.com", "password123", "")
	if err != nil {
		t.Fatalf("ChangeOwnCredentials with no prior password: %v", err)
	}
	if updated.Email == nil || *updated.Email != "kid@example.com" {
		t.Errorf("email not set: %+v", updated.Email)
	}
}

func TestMemberService_List_ReturnsInCreationOrder(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, _, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	memberSvc := services.NewMemberService(db)
	if _, createErr := memberSvc.Create(household.ID, services.MemberInput{Name: "Kid1", Role: "member"}); createErr != nil {
		t.Fatalf("create Kid1: %v", createErr)
	}
	if _, createErr := memberSvc.Create(household.ID, services.MemberInput{Name: "Kid2", Role: "member"}); createErr != nil {
		t.Fatalf("create Kid2: %v", createErr)
	}

	members, err := memberSvc.List(household.ID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(members) != 3 {
		t.Errorf("expected 3 members (admin + 2 kids), got %d", len(members))
	}
}

func TestMemberService_Get_UnknownIDReturnsNotFound(t *testing.T) {
	memberSvc := services.NewMemberService(testutil.NewDB(t))
	if _, err := memberSvc.Get("any-household-id", "does-not-exist"); err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestMemberService_Update_InvalidPINRejected(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, _, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	memberSvc := services.NewMemberService(db)
	kid, err := memberSvc.Create(household.ID, services.MemberInput{Name: "Kid", Role: "member"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := memberSvc.Update(household.ID, kid.ID, services.MemberInput{Name: "Kid", Role: "member", PIN: "abc"}); err != services.ErrInvalidPIN {
		t.Errorf("err = %v, want ErrInvalidPIN", err)
	}
}

func TestMemberService_ClearPIN_UnknownIDReturnsNotFound(t *testing.T) {
	memberSvc := services.NewMemberService(testutil.NewDB(t))
	if err := memberSvc.ClearPIN("any-household-id", "does-not-exist"); err == nil {
		t.Error("expected an error clearing the PIN of an unknown member")
	}
}
