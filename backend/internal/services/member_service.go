package services

import (
	"errors"
	"regexp"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

const defaultAvatar = "🙂"

var pinPattern = regexp.MustCompile(`^\d{4,6}$`)

var ErrInvalidPIN = errors.New("PIN must be 4-6 digits")
var ErrMainAccountUndeletable = errors.New("the main household account can't be deleted")

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
	if in.Role == "admin" {
		role = "admin"
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
	if in.Role == "admin" {
		role = "admin"
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

// Delete removes a profile. The main login account (email/passwordHash
// set) can't be deleted — it's how anyone gets into this household at
// all.
func (s *MemberService) Delete(householdID, id string) error {
	target, err := s.Get(householdID, id)
	if err != nil {
		return err
	}
	if target.PasswordHash != nil {
		return ErrMainAccountUndeletable
	}
	return s.db.Delete(target).Error
}
