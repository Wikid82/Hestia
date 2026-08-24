package services_test

import (
	"testing"
	"time"

	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestRewardService_Redeem_InactiveRewardRejected(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, user, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	rewardSvc := services.NewRewardService(db)
	reward, err := rewardSvc.Create(household.ID, services.RewardInput{Title: "X", PointCost: 10})
	if err != nil {
		t.Fatalf("create reward: %v", err)
	}
	if _, err := rewardSvc.ToggleActive(household.ID, reward.ID); err != nil {
		t.Fatalf("toggle active: %v", err)
	}

	if _, err := rewardSvc.Redeem(household.ID, reward.ID, user.ID, 100); err != services.ErrRewardUnavailable {
		t.Errorf("err = %v, want ErrRewardUnavailable", err)
	}
}

func TestRewardService_Get_UnknownIDReturnsNotFound(t *testing.T) {
	rewardSvc := services.NewRewardService(testutil.NewDB(t))
	if _, err := rewardSvc.Get("any-household", "does-not-exist"); err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestRewardService_Update_UnknownIDReturnsNotFound(t *testing.T) {
	rewardSvc := services.NewRewardService(testutil.NewDB(t))
	if _, err := rewardSvc.Update("any-household", "does-not-exist", services.RewardInput{Title: "X", PointCost: 1}); err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestReminderService_Create_UnknownAssigneeRejected(t *testing.T) {
	reminderSvc := services.NewReminderService(testutil.NewDB(t))
	missing := "does-not-exist"
	_, err := reminderSvc.Create("any-household", services.ReminderInput{Title: "X", AssignedToUserID: &missing})
	if err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestReminderService_ToggleDone_UnknownIDReturnsNotFound(t *testing.T) {
	reminderSvc := services.NewReminderService(testutil.NewDB(t))
	if _, err := reminderSvc.ToggleDone("any-household", "does-not-exist"); err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestReminderService_Get_UnknownIDReturnsNotFound(t *testing.T) {
	reminderSvc := services.NewReminderService(testutil.NewDB(t))
	if _, err := reminderSvc.Get("any-household", "does-not-exist"); err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestChoreService_Get_UnknownIDReturnsNotFound(t *testing.T) {
	choreSvc := services.NewChoreService(testutil.NewDB(t))
	if _, err := choreSvc.Get("any-household", "does-not-exist"); err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestChoreService_Create_UnknownAssigneeRejected(t *testing.T) {
	choreSvc := services.NewChoreService(testutil.NewDB(t))
	_, err := choreSvc.Create("any-household", services.ChoreInput{
		Title: "X", AssignedToUserID: "does-not-exist", DueDate: time.Now(), Recurrence: "none",
	})
	if err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestChoreService_Update_UnknownIDReturnsNotFound(t *testing.T) {
	db := testutil.NewDB(t)
	hhAuth := services.NewHouseholdAuthService(db)
	household, admin, err := hhAuth.Signup("Test HH", "Admin", "admin@example.com", "password123", true)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	choreSvc := services.NewChoreService(db)
	_, err = choreSvc.Update(household.ID, "does-not-exist", services.ChoreInput{
		Title: "X", AssignedToUserID: admin.ID, DueDate: time.Now(), Recurrence: "none",
	})
	if err != services.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestInviteService_AcceptInvite_RevokedRejected(t *testing.T) {
	db := testutil.NewDB(t)
	inviteSvc := services.NewInviteService(db)

	_, rawToken, err := inviteSvc.CreateInvite("hoh", "revoke-me@example.com", nil, "inviter-id")
	if err != nil {
		t.Fatalf("CreateInvite: %v", err)
	}
	preview, err := inviteSvc.GetByToken(rawToken)
	if err != nil {
		t.Fatalf("GetByToken: %v", err)
	}
	if revokeErr := inviteSvc.Revoke(preview.ID, nil); revokeErr != nil {
		t.Fatalf("Revoke: %v", revokeErr)
	}

	_, _, err = inviteSvc.AcceptInvite(rawToken, "Name", "password123", "HH")
	if err != services.ErrInviteNotPending {
		t.Errorf("err = %v, want ErrInviteNotPending", err)
	}
}
