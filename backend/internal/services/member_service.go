package services

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

const defaultAvatar = "🙂"

var pinPattern = regexp.MustCompile(`^\d{4,6}$`)

var ErrInvalidPIN = errors.New("PIN must be 4-6 digits")
var ErrLastHoHUndeletable = errors.New("a household must always have at least one HoH")
var ErrIncorrectPassword = errors.New("current password is incorrect")

// MemberService implements profile CRUD, ported from
// src/lib/actions/members.ts.
type MemberService struct {
	db *gorm.DB
}

func NewMemberService(db *gorm.DB) *MemberService {
	return &MemberService{db: db}
}

func (s *MemberService) List(householdID string) ([]models.User, error) {
	var users []models.User
	if err := s.db.Where("household_id = ?", householdID).Order("created_at asc").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (s *MemberService) Get(householdID, id string) (*models.User, error) {
	var u models.User
	if err := s.db.Where("id = ? AND household_id = ?", id, householdID).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

type MemberInput struct {
	Name        string
	Role        string
	AvatarEmoji string
	PIN         string // empty = leave unchanged on update, or no PIN on create
}

func (s *MemberService) Create(householdID string, in MemberInput) (*models.User, error) {
	if in.PIN != "" && !pinPattern.MatchString(in.PIN) {
		return nil, ErrInvalidPIN
	}
	role := "member"
	if in.Role == "hoh" {
		role = "hoh"
	}
	avatar := in.AvatarEmoji
	if avatar == "" {
		avatar = defaultAvatar
	}

	var pinHash *string
	if in.PIN != "" {
		h, err := HashSecret(in.PIN)
		if err != nil {
			return nil, err
		}
		pinHash = &h
	}

	user := models.User{
		ID:          uuid.NewString(),
		HouseholdID: householdID,
		Name:        in.Name,
		Role:        role,
		AvatarEmoji: avatar,
		PinHash:     pinHash,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *MemberService) Update(householdID, id string, in MemberInput) (*models.User, error) {
	target, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	if in.PIN != "" && !pinPattern.MatchString(in.PIN) {
		return nil, ErrInvalidPIN
	}

	role := "member"
	if in.Role == "hoh" {
		role = "hoh"
	}
	avatar := in.AvatarEmoji
	if avatar == "" {
		avatar = defaultAvatar
	}

	target.Name = in.Name
	target.Role = role
	target.AvatarEmoji = avatar
	if in.PIN != "" {
		h, err := HashSecret(in.PIN)
		if err != nil {
			return nil, err
		}
		target.PinHash = &h
	}

	if err := s.db.Save(target).Error; err != nil {
		return nil, err
	}
	return target, nil
}

func (s *MemberService) ClearPIN(householdID, id string) error {
	target, err := s.Get(householdID, id)
	if err != nil {
		return err
	}
	return s.db.Model(target).Update("pin_hash", nil).Error
}

// SetCredentials sets/replaces a member's email+password directly — a
// HoH-only admin override (e.g. giving a managed profile its own login,
// or resetting one a member forgot). Does not require the target's
// current password. Use ChangeOwnCredentials for self-service changes.
func (s *MemberService) SetCredentials(householdID, id, email, password string) (*models.User, error) {
	target, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	return s.setCredentials(target, email, password)
}

// ChangeOwnCredentials lets a profile set or change its own email and
// password. If the profile already has a password set, currentPassword
// must match it — this is the self-service path, unlike SetCredentials,
// so proving you know the existing password stands in for the admin
// override's HoH-only gate. A profile with no password yet (e.g. a
// managed profile setting up its own login for the first time) doesn't
// need to supply one.
func (s *MemberService) ChangeOwnCredentials(householdID, id, email, password, currentPassword string) (*models.User, error) {
	target, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	if target.PasswordHash != nil {
		if currentPassword == "" || !VerifySecret(currentPassword, *target.PasswordHash) {
			return nil, ErrIncorrectPassword
		}
	}
	return s.setCredentials(target, email, password)
}

func (s *MemberService) setCredentials(target *models.User, email, password string) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if len(password) < 8 {
		return nil, fmt.Errorf("password must be at least 8 characters")
	}

	var count int64
	if err := s.db.Model(&models.User{}).Where("email = ? AND id <> ?", email, target.ID).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, ErrEmailTaken
	}

	passwordHash, err := HashSecret(password)
	if err != nil {
		return nil, err
	}

	target.Email = &email
	target.PasswordHash = &passwordHash
	if err := s.db.Save(target).Error; err != nil {
		return nil, err
	}
	return target, nil
}

// Delete removes a profile. A household's last remaining HoH can't be
// deleted — without one, nobody could manage the household at all. This
// used to be keyed off "has a password set" instead of "is the last hoh",
// back when only the founding account could ever have one; now that any
// member can get their own login (SetCredentials/ChangeOwnCredentials),
// that check would incorrectly make an ordinary member undeletable too.
func (s *MemberService) Delete(householdID, id string) error {
	target, err := s.Get(householdID, id)
	if err != nil {
		return err
	}
	if target.Role == "hoh" {
		var hohCount int64
		if err := s.db.Model(&models.User{}).
			Where("household_id = ? AND role = ?", householdID, "hoh").
			Count(&hohCount).Error; err != nil {
			return err
		}
		if hohCount <= 1 {
			return ErrLastHoHUndeletable
		}
	}
	return s.db.Delete(target).Error
}
