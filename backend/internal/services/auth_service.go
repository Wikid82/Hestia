// Package services holds Hestia's business logic, independent of the
// HTTP layer.
package services

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	SessionCookie = "hestia_session"
	ProfileCookie = "hestia_profile"
	MaxAgeSeconds = 60 * 60 * 24 * 30 // 30 days
)

// AuthService signs and verifies the two-tier JWT session model: a
// household-level session (email/password login) and a separate
// profile-level session (avatar-picker selection).
type AuthService struct {
	secret []byte
}

func NewAuthService(secret string) *AuthService {
	return &AuthService{secret: []byte(secret)}
}

// SessionClaims is the household-level session payload.
type SessionClaims struct {
	HouseholdID string `json:"householdId"`
	jwt.RegisteredClaims
}

// ProfileClaims is the profile-level session payload.
type ProfileClaims struct {
	HouseholdID string `json:"householdId"`
	UserID      string `json:"userId"`
	jwt.RegisteredClaims
}

func (s *AuthService) expiry() *jwt.NumericDate {
	return jwt.NewNumericDate(time.Now().Add(MaxAgeSeconds * time.Second))
}

// SignSession creates a household-session JWT.
func (s *AuthService) SignSession(householdID string) (string, error) {
	claims := SessionClaims{
		HouseholdID: householdID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: s.expiry(),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// VerifySession parses and validates a household-session JWT.
func (s *AuthService) VerifySession(token string) (*SessionClaims, error) {
	claims := &SessionClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		return s.secret, nil
	})
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid session")
	}
	return claims, nil
}

// SignProfile creates a profile-session JWT.
func (s *AuthService) SignProfile(householdID, userID string) (string, error) {
	claims := ProfileClaims{
		HouseholdID: householdID,
		UserID:      userID,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: s.expiry(),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// VerifyProfile parses and validates a profile-session JWT.
func (s *AuthService) VerifyProfile(token string) (*ProfileClaims, error) {
	claims := &ProfileClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		return s.secret, nil
	})
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid profile session")
	}
	return claims, nil
}

// HashSecret bcrypt-hashes a password or PIN.
func HashSecret(secret string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(secret), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// VerifySecret checks a plaintext secret against a bcrypt hash.
func VerifySecret(secret, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(secret)) == nil
}
