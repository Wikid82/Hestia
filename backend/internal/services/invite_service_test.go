package services_test

import (
	"testing"
	"time"

	"hestia/backend/internal/models"
	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestInviteService_CreateInvite_InvalidRoleRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	_, _, err := svc.CreateInvite("owner", "x@example.com", nil, "inviter-id")
	if err != services.ErrInvalidInviteRole {
		t.Errorf("err = %v, want ErrInvalidInviteRole", err)
	}
}

func TestInviteService_CreateInvite_MemberInviteRequiresHousehold(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	_, _, err := svc.CreateInvite("member", "x@example.com", nil, "inviter-id")
	if err == nil {
		t.Error("expected an error when a member invite has no household")
	}
}

func TestInviteService_CreateInvite_HoHInviteRejectsHousehold(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)
	hh := "some-household-id"

	_, _, err := svc.CreateInvite("hoh", "x@example.com", &hh, "inviter-id")
	if err == nil {
		t.Error("expected an error when a hoh invite is scoped to a household")
	}
}

func TestInviteService_CreateInvite_EmptyEmailRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	_, _, err := svc.CreateInvite("hoh", "", nil, "inviter-id")
	if err == nil {
		t.Error("expected an error for an empty email")
	}
}

func TestInviteService_CreateInvite_SupersedesPriorPending(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	first, _, err := svc.CreateInvite("hoh", "dupe@example.com", nil, "inviter-id")
	if err != nil {
		t.Fatalf("first CreateInvite: %v", err)
	}
	_, _, err = svc.CreateInvite("hoh", "dupe@example.com", nil, "inviter-id")
	if err != nil {
		t.Fatalf("second CreateInvite: %v", err)
	}

	var reloaded models.Invite
	if err := db.Where("id = ?", first.ID).First(&reloaded).Error; err != nil {
		t.Fatalf("reloading first invite: %v", err)
	}
	if reloaded.Status != "revoked" {
		t.Errorf("expected the first invite to be superseded (revoked), got status %q", reloaded.Status)
	}
}

func TestInviteService_AcceptInvite_ExpiredRejected(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	invite, rawToken, err := svc.CreateInvite("hoh", "expired@example.com", nil, "inviter-id")
	if err != nil {
		t.Fatalf("CreateInvite: %v", err)
	}
	// Force it into the past directly via the DB — CreateInvite always
	// sets a future expiry, so this is the only way to construct an
	// expired-but-still-pending invite for the test.
	if updateErr := db.Model(&models.Invite{}).Where("id = ?", invite.ID).
		Update("expires_at", time.Now().Add(-time.Hour)).Error; updateErr != nil {
		t.Fatalf("forcing expiry: %v", updateErr)
	}

	_, _, err = svc.AcceptInvite(rawToken, "Name", "password123", "Some HH")
	if err != services.ErrInviteExpired {
		t.Errorf("err = %v, want ErrInviteExpired", err)
	}
}

func TestInviteService_AcceptInvite_UnknownTokenReturnsNotFound(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	_, _, err := svc.AcceptInvite("not-a-real-token", "Name", "password123", "HH")
	if err != services.ErrInviteNotFound {
		t.Errorf("err = %v, want ErrInviteNotFound", err)
	}
}

func TestInviteService_Revoke_UnknownIDReturnsNotFound(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)

	if err := svc.Revoke("does-not-exist", nil); err != services.ErrInviteNotFound {
		t.Errorf("err = %v, want ErrInviteNotFound", err)
	}
}

func TestInviteService_ListForHousehold(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewInviteService(db)
	hh := "household-1"

	if _, _, err := svc.CreateInvite("member", "a@example.com", &hh, "inviter-id"); err != nil {
		t.Fatalf("CreateInvite a: %v", err)
	}
	if _, _, err := svc.CreateInvite("member", "b@example.com", &hh, "inviter-id"); err != nil {
		t.Fatalf("CreateInvite b: %v", err)
	}

	invites, err := svc.ListForHousehold(hh)
	if err != nil {
		t.Fatalf("ListForHousehold: %v", err)
	}
	if len(invites) != 2 {
		t.Errorf("expected 2 invites, got %d", len(invites))
	}
}
