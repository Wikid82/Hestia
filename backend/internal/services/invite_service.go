package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

// InviteExpiry is how long a created invite stays acceptable.
const InviteExpiry = 7 * 24 * time.Hour

var (
	ErrInviteNotFound    = errors.New("invite not found")
	ErrInviteNotPending  = errors.New("this invite has already been used or revoked")
	ErrInviteExpired     = errors.New("this invite has expired")
	ErrInvalidInviteRole = errors.New(`role must be "hoh" or "member"`)
)

// InviteService implements the invite lifecycle: create (with a random
// token, stored only as its sha256 hash), public preview by token, accept
// (creates the invitee's account), list, and revoke.
type InviteService struct {
	db *gorm.DB
}

func NewInviteService(db *gorm.DB) *InviteService {
	return &InviteService{db: db}
}

// CreateInvite creates a pending invite and returns it along with the raw
// (unhashed) token — the only moment the raw token is ever available.
// householdID must be nil for role "hoh" (the invitee creates their own,
// independent household on accept) and non-nil for role "member" (the
// invitee joins that existing household). Any still-pending invite for
// the same email + household scope is superseded (marked revoked) so
// re-inviting someone doesn't leave two live links outstanding.
func (s *InviteService) CreateInvite(role, email string, householdID *string, invitedByUserID string) (*models.Invite, string, error) {
	role = strings.ToLower(strings.TrimSpace(role))
	email = strings.ToLower(strings.TrimSpace(email))

	if role != "hoh" && role != "member" {
		return nil, "", ErrInvalidInviteRole
	}
	if role == "member" && householdID == nil {
		return nil, "", fmt.Errorf("a member invite requires a household")
	}
	if role == "hoh" && householdID != nil {
		return nil, "", fmt.Errorf("a hoh invite must not be scoped to an existing household")
	}
	if email == "" {
		return nil, "", fmt.Errorf("email is required")
	}

	var userCount int64
	if err := s.db.Model(&models.User{}).Where("email = ?", email).Count(&userCount).Error; err != nil {
		return nil, "", err
	}
	if userCount > 0 {
		return nil, "", ErrEmailTaken
	}

	rawToken, tokenHash, err := generateInviteToken()
	if err != nil {
		return nil, "", err
	}

	scope := s.db.Model(&models.Invite{}).Where("email = ? AND status = ?", email, "pending")
	if householdID == nil {
		scope = scope.Where("household_id IS NULL")
	} else {
		scope = scope.Where("household_id = ?", *householdID)
	}
	if err := scope.Update("status", "revoked").Error; err != nil {
		return nil, "", err
	}

	invite := models.Invite{
		ID:              uuid.NewString(),
		HouseholdID:     householdID,
		Role:            role,
		Email:           email,
		TokenHash:       tokenHash,
		Status:          "pending",
		InvitedByUserID: invitedByUserID,
		ExpiresAt:       time.Now().Add(InviteExpiry),
	}
	if err := s.db.Create(&invite).Error; err != nil {
		return nil, "", err
	}
	return &invite, rawToken, nil
}

// GetByToken looks up an invite by its raw token, for the public
// accept-page preview. Read-only.
func (s *InviteService) GetByToken(rawToken string) (*models.Invite, error) {
	var invite models.Invite
	err := s.db.Where("token_hash = ?", hashInviteToken(rawToken)).First(&invite).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInviteNotFound
	}
	if err != nil {
		return nil, err
	}
	return &invite, nil
}

// AcceptInvite validates the invite and creates the invitee's account: a
// brand-new household plus hoh profile for a "hoh" invite, or a member
// profile in the existing household for a "member" invite.
// householdName is required (and only used) for "hoh" invites.
func (s *InviteService) AcceptInvite(rawToken, name, password, householdName string) (*models.Household, *models.User, error) {
	invite, err := s.GetByToken(rawToken)
	if err != nil {
		return nil, nil, err
	}
	if invite.Status != "pending" {
		return nil, nil, ErrInviteNotPending
	}
	if invite.IsExpired() {
		return nil, nil, ErrInviteExpired
	}

	var userCount int64
	if err := s.db.Model(&models.User{}).Where("email = ?", invite.Email).Count(&userCount).Error; err != nil {
		return nil, nil, err
	}
	if userCount > 0 {
		return nil, nil, ErrEmailTaken
	}

	passwordHash, err := HashSecret(password)
	if err != nil {
		return nil, nil, err
	}

	var household models.Household
	user := models.User{
		ID:           uuid.NewString(),
		Name:         name,
		Role:         invite.Role,
		AvatarEmoji:  defaultAvatar,
		Email:        &invite.Email,
		PasswordHash: &passwordHash,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if invite.Role == "hoh" {
			household = models.Household{ID: uuid.NewString(), Name: householdName, ThemePreference: "system"}
			if err := tx.Create(&household).Error; err != nil {
				return err
			}
		} else {
			if invite.HouseholdID == nil {
				return fmt.Errorf("member invite is missing its household")
			}
			if err := tx.Where("id = ?", *invite.HouseholdID).First(&household).Error; err != nil {
				return err
			}
		}
		user.HouseholdID = household.ID
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		now := time.Now()
		return tx.Model(&models.Invite{}).Where("id = ?", invite.ID).
			Updates(map[string]any{"status": "accepted", "accepted_at": &now}).Error
	})
	if err != nil {
		return nil, nil, err
	}
	return &household, &user, nil
}

// ListForHousehold returns every invite issued for a household's member
// slots (any status), newest first.
func (s *InviteService) ListForHousehold(householdID string) ([]models.Invite, error) {
	var invites []models.Invite
	err := s.db.Where("household_id = ?", householdID).Order("created_at desc").Find(&invites).Error
	return invites, err
}

// ListHoHInvites returns every hoh-role invite (household_id IS NULL),
// any status, newest first. System-admin-only by convention of its
// caller — this method itself doesn't check permissions.
func (s *InviteService) ListHoHInvites() ([]models.Invite, error) {
	var invites []models.Invite
	err := s.db.Where("household_id IS NULL").Order("created_at desc").Find(&invites).Error
	return invites, err
}

// Revoke marks a pending invite revoked. If householdScope is non-nil,
// the invite must belong to that household or ErrInviteNotFound is
// returned — this is how a HoH is limited to revoking only their own
// household's invites, while a system admin (nil scope) can revoke any
// hoh invite.
func (s *InviteService) Revoke(id string, householdScope *string) error {
	var invite models.Invite
	if err := s.db.Where("id = ?", id).First(&invite).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrInviteNotFound
		}
		return err
	}
	if householdScope != nil {
		if invite.HouseholdID == nil || *invite.HouseholdID != *householdScope {
			return ErrInviteNotFound
		}
	}
	return s.db.Model(&invite).Update("status", "revoked").Error
}

func generateInviteToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	return raw, hashInviteToken(raw), nil
}

func hashInviteToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
