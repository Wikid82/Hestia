package services_test

import (
	"context"
	"errors"
	"testing"

	"hestia/backend/internal/models"
	"hestia/backend/internal/services"
	"hestia/backend/internal/testutil"
)

func TestPushService_VAPIDPublicKeyGeneratesAndPersists(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPushService(db, "https://hestia.example.com")

	key1, err := svc.VAPIDPublicKey()
	if err != nil {
		t.Fatalf("VAPIDPublicKey returned an error: %v", err)
	}
	if key1 == "" {
		t.Fatal("expected a non-empty VAPID public key")
	}

	key2, err := svc.VAPIDPublicKey()
	if err != nil {
		t.Fatalf("second VAPIDPublicKey call returned an error: %v", err)
	}
	if key2 != key1 {
		t.Errorf("VAPID key changed across calls: %q then %q, want stable", key1, key2)
	}

	var cfg models.PushConfig
	if err := db.Where("id = ?", models.PushConfigID).First(&cfg).Error; err != nil {
		t.Fatalf("expected a persisted PushConfig row: %v", err)
	}
	if cfg.VAPIDPrivateKey == "" {
		t.Error("expected a persisted, non-empty VAPID private key")
	}
}

func TestPushService_VAPIDPublicKeyRequiresBaseURL(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPushService(db, "")

	if _, err := svc.VAPIDPublicKey(); !errors.Is(err, services.ErrBaseURLNotConfigured) {
		t.Errorf("VAPIDPublicKey with no BASE_URL: err = %v, want ErrBaseURLNotConfigured", err)
	}
}

func TestPushService_SubscribeRejectsMissingFields(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPushService(db, "https://hestia.example.com")

	cases := []services.SubscriptionInput{
		{Endpoint: "", P256dh: "p", Auth: "a"},
		{Endpoint: "https://push.example.com/x", P256dh: "", Auth: "a"},
		{Endpoint: "https://push.example.com/x", P256dh: "p", Auth: ""},
	}
	for _, in := range cases {
		if err := svc.Subscribe("user-1", in); !errors.Is(err, services.ErrInvalidSubscription) {
			t.Errorf("Subscribe(%+v): err = %v, want ErrInvalidSubscription", in, err)
		}
	}
}

func TestPushService_SubscribeUpsertsByUserAndEndpoint(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPushService(db, "https://hestia.example.com")

	in := services.SubscriptionInput{
		Endpoint: "https://push.example.com/sub-1",
		P256dh:   "p256dh-v1",
		Auth:     "auth-v1",
	}
	if err := svc.Subscribe("user-1", in); err != nil {
		t.Fatalf("first Subscribe returned an error: %v", err)
	}

	in.P256dh = "p256dh-v2"
	in.Auth = "auth-v2"
	if err := svc.Subscribe("user-1", in); err != nil {
		t.Fatalf("second Subscribe returned an error: %v", err)
	}

	var subs []models.PushSubscription
	if err := db.Where("user_id = ?", "user-1").Find(&subs).Error; err != nil {
		t.Fatalf("querying subscriptions: %v", err)
	}
	if len(subs) != 1 {
		t.Fatalf("got %d subscriptions, want 1 (upsert, not duplicate)", len(subs))
	}
	if subs[0].P256dh != "p256dh-v2" || subs[0].Auth != "auth-v2" {
		t.Errorf("subscription not updated: got p256dh=%q auth=%q", subs[0].P256dh, subs[0].Auth)
	}
}

func TestPushService_SubscribeDBErrorPropagates(t *testing.T) {
	db := testutil.NewDB(t)
	testutil.PoisonTable(db, "push_subscriptions")
	svc := services.NewPushService(db, "https://hestia.example.com")

	err := svc.Subscribe("user-1", services.SubscriptionInput{
		Endpoint: "https://push.example.com/sub-1", P256dh: "p", Auth: "a",
	})
	if err == nil {
		t.Error("expected an error when the push_subscriptions table is poisoned")
	}
}

func TestPushService_UnsubscribeIdempotent(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPushService(db, "https://hestia.example.com")

	if err := svc.Unsubscribe("user-1", "https://push.example.com/never-subscribed"); err != nil {
		t.Errorf("Unsubscribe on a nonexistent subscription returned an error: %v", err)
	}

	in := services.SubscriptionInput{Endpoint: "https://push.example.com/sub-1", P256dh: "p", Auth: "a"}
	if err := svc.Subscribe("user-1", in); err != nil {
		t.Fatalf("Subscribe returned an error: %v", err)
	}
	if err := svc.Unsubscribe("user-1", in.Endpoint); err != nil {
		t.Fatalf("Unsubscribe returned an error: %v", err)
	}

	var count int64
	db.Model(&models.PushSubscription{}).Where("user_id = ?", "user-1").Count(&count)
	if count != 0 {
		t.Errorf("expected the subscription to be removed, got %d rows", count)
	}
}

func TestPushService_SendToUserNoSubscriptionsNoop(t *testing.T) {
	db := testutil.NewDB(t)
	svc := services.NewPushService(db, "https://hestia.example.com")

	err := svc.SendToUser(context.Background(), "user-with-no-subs", services.PushMessage{Title: "T", Body: "B"})
	if err != nil {
		t.Errorf("SendToUser with no subscriptions: err = %v, want nil (silent no-op)", err)
	}

	var cfgCount int64
	db.Model(&models.PushConfig{}).Count(&cfgCount)
	if cfgCount != 0 {
		t.Error("expected no VAPID config to be generated when there's nothing to send to")
	}
}
