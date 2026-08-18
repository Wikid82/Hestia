package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

// PasswordResetExpiry is how long a created reset token stays usable.
// Shorter than InviteExpiry since this is an urgent "let me back in"
// action, not a slow-burn onboarding link.
const PasswordResetExpiry = 1 * time.Hour

var (
	ErrPasswordResetNotFound = errors.New("password reset token not found")
	ErrPasswordResetUsed     = errors.New("this password reset link has already been used")
	ErrPasswordResetExpired  = errors.New("this password reset link has expired")
)

// PasswordResetService implements the forgot/reset-password lifecycle:
// create (with a random token, stored only as its sha256 hash), and reset
// (validates the token and updates the user's password hash).
type PasswordResetService struct {
	db *gorm.DB
}

func NewPasswordResetService(db *gorm.DB) *PasswordResetService {
	return &PasswordResetService{db: db}
}

// CreateReset looks up the user by email and creates a pending reset
// token for them, returning the raw (unhashed) token — the only moment
// it's ever available. Returns (nil, "", nil) if no user with that email
// has password/email login (ErrRecordNotFound and no-PasswordHash cases
// are treated identically) — callers must not distinguish this from
// success in their HTTP response, to avoid leaking which emails have
// accounts. Any still-pending reset for the same user is superseded
// (marked used) so requesting a new link invalidates an old one.
func (s *PasswordResetService) CreateReset(email string) (*models.PasswordReset, string, error) {
	var user models.User
	err := s.db.Where("email = ?", email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	if user.PasswordHash == nil {
		return nil, "", nil
	}

	rawToken, tokenHash, err := generateResetToken()
	if err != nil {
		return nil, "", err
	}

	now := time.Now()
	if err := s.db.Model(&models.PasswordReset{}).
		Where("user_id = ? AND used_at IS NULL", user.ID).
		Update("used_at", &now).Error; err != nil {
		return nil, "", err
	}

	reset := models.PasswordReset{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: now.Add(PasswordResetExpiry),
	}
	if err := s.db.Create(&reset).Error; err != nil {
		return nil, "", err
	}
	return &reset, rawToken, nil
}

// Reset validates the raw token and updates the matching user's password
// hash, marking the token used so it can't be replayed.
func (s *PasswordResetService) Reset(rawToken, newPassword string) error {
	var reset models.PasswordReset
	err := s.db.Where("token_hash = ?", hashResetToken(rawToken)).First(&reset).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrPasswordResetNotFound
	}
	if err != nil {
		return err
	}
	if reset.UsedAt != nil {
		return ErrPasswordResetUsed
	}
	if reset.IsExpired() {
		return ErrPasswordResetExpired
	}

	passwordHash, err := HashSecret(newPassword)
	if err != nil {
		return err
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&models.PasswordReset{}).Where("id = ?", reset.ID).
			Update("used_at", &now).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", reset.UserID).
			Update("password_hash", &passwordHash).Error
	})
}

func generateResetToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	return raw, hashResetToken(raw), nil
}

func hashResetToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
