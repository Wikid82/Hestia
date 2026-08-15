package services

import (
	"errors"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

var (
	ErrEmailTaken         = errors.New("an account with that email already exists")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrIncorrectPIN       = errors.New("incorrect PIN")
)

// HouseholdAuthService implements signup/login/profile-switch, ported
// from src/lib/actions/auth.ts and src/lib/actions/profile.ts.
type HouseholdAuthService struct {
	db *gorm.DB
}

func NewHouseholdAuthService(db *gorm.DB) *HouseholdAuthService {
	return &HouseholdAuthService{db: db}
}

// Signup creates a brand-new household plus its one admin/login profile.
func (s *HouseholdAuthService) Signup(householdName, name, email, password string) (*models.Household, *models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var count int64
	if err := s.db.Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return nil, nil, err
	}
	if count > 0 {
		return nil, nil, ErrEmailTaken
	}

	passwordHash, err := HashSecret(password)
	if err != nil {
		return nil, nil, err
	}

	household := models.Household{ID: uuid.NewString(), Name: householdName, ThemePreference: "system"}
	user := models.User{
		ID:           uuid.NewString(),
		HouseholdID:  household.ID,
		Name:         name,
		Role:         "admin",
		AvatarEmoji:  defaultAvatar,
		Email:        &email,
		PasswordHash: &passwordHash,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&household).Error; err != nil {
			return err
		}
		return tx.Create(&user).Error
	})
	if err != nil {
		return nil, nil, err
	}
	return &household, &user, nil
}

// Login validates household-account credentials.
func (s *HouseholdAuthService) Login(email, password string) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var user models.User
	err := s.db.Where("email = ?", email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	if user.PasswordHash == nil || !VerifySecret(password, *user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}
	return &user, nil
}

// SwitchProfile validates a profile switch (with optional PIN check for
// PIN-gated profiles) within the given household.
func (s *HouseholdAuthService) SwitchProfile(householdID, userID, pin string) (*models.User, error) {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if user.HouseholdID != householdID {
		return nil, ErrNotFound
	}
	if user.PinHash != nil {
		if pin == "" || !VerifySecret(pin, *user.PinHash) {
			return nil, ErrIncorrectPIN
		}
	}
	return &user, nil
}
