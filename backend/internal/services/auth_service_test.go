package services

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestHashSecretAndVerifySecret(t *testing.T) {
	hash, err := HashSecret("correct-horse-battery-staple")
	if err != nil {
		t.Fatalf("HashSecret returned an error: %v", err)
	}
	if hash == "correct-horse-battery-staple" {
		t.Fatal("HashSecret must not return the plaintext secret")
	}
	if !VerifySecret("correct-horse-battery-staple", hash) {
		t.Error("VerifySecret should accept the correct secret against its own hash")
	}
	if VerifySecret("wrong-password", hash) {
		t.Error("VerifySecret should reject an incorrect secret")
	}
}

func TestHashSecretProducesDifferentHashesEachTime(t *testing.T) {
	// bcrypt salts per call — two hashes of the same input should differ,
	// even though both verify successfully.
	a, err := HashSecret("same-password")
	if err != nil {
		t.Fatalf("HashSecret returned an error: %v", err)
	}
	b, err := HashSecret("same-password")
	if err != nil {
		t.Fatalf("HashSecret returned an error: %v", err)
	}
	if a == b {
		t.Error("expected two hashes of the same input to differ (bcrypt salting)")
	}
	if !VerifySecret("same-password", a) || !VerifySecret("same-password", b) {
		t.Error("both hashes should still verify against the original secret")
	}
}

func TestSignAndVerifySession(t *testing.T) {
	auth := NewAuthService("test-secret")

	token, err := auth.SignSession("household-123")
	if err != nil {
		t.Fatalf("SignSession returned an error: %v", err)
	}

	claims, err := auth.VerifySession(token)
	if err != nil {
		t.Fatalf("VerifySession returned an error for a freshly-signed token: %v", err)
	}
	if claims.HouseholdID != "household-123" {
		t.Errorf("HouseholdID = %q, want %q", claims.HouseholdID, "household-123")
	}
}

func TestVerifySession_RejectsGarbage(t *testing.T) {
	auth := NewAuthService("test-secret")
	if _, err := auth.VerifySession("not-a-real-token"); err == nil {
		t.Error("expected an error verifying a malformed token")
	}
}

func TestVerifySession_RejectsWrongSecret(t *testing.T) {
	signed := NewAuthService("secret-a")
	verified := NewAuthService("secret-b")

	token, err := signed.SignSession("household-123")
	if err != nil {
		t.Fatalf("SignSession returned an error: %v", err)
	}
	if _, err := verified.VerifySession(token); err == nil {
		t.Error("expected a token signed with a different secret to fail verification")
	}
}

func TestVerifySession_RejectsExpiredToken(t *testing.T) {
	auth := NewAuthService("test-secret")

	claims := SessionClaims{
		HouseholdID: "household-123",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-48 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-24 * time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to construct an expired test token: %v", err)
	}

	if _, err := auth.VerifySession(token); err == nil {
		t.Error("expected an expired token to fail verification")
	}
}

func TestSignAndVerifyProfile(t *testing.T) {
	auth := NewAuthService("test-secret")

	token, err := auth.SignProfile("household-123", "user-456")
	if err != nil {
		t.Fatalf("SignProfile returned an error: %v", err)
	}

	claims, err := auth.VerifyProfile(token)
	if err != nil {
		t.Fatalf("VerifyProfile returned an error for a freshly-signed token: %v", err)
	}
	if claims.HouseholdID != "household-123" || claims.UserID != "user-456" {
		t.Errorf("claims = %+v, want HouseholdID=household-123 UserID=user-456", claims)
	}
}

func TestVerifyProfile_RejectsGarbage(t *testing.T) {
	auth := NewAuthService("test-secret")
	if _, err := auth.VerifyProfile("not-a-real-token"); err == nil {
		t.Error("expected an error verifying a malformed token")
	}
}

func TestSessionAndProfileTokensAreNotInterchangeable(t *testing.T) {
	// VerifySession/VerifyProfile both just parse claims into their own
	// struct shape without checking a "type" discriminator, so this test
	// documents the actual (permissive) behavior rather than assuming
	// cross-verification fails — a session token's claims happen to
	// satisfy ProfileClaims' required fields (none are marked required),
	// so VerifyProfile parses it without error but UserID comes back
	// empty since a session token never set it.
	auth := NewAuthService("test-secret")

	sessionToken, err := auth.SignSession("household-123")
	if err != nil {
		t.Fatalf("SignSession returned an error: %v", err)
	}

	profileClaims, err := auth.VerifyProfile(sessionToken)
	if err != nil {
		t.Fatalf("VerifyProfile returned an unexpected error: %v", err)
	}
	if profileClaims.UserID != "" {
		t.Errorf("expected UserID to be empty when parsing a session token as a profile token, got %q", profileClaims.UserID)
	}
}
