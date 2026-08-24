// Package models defines the GORM data model for Hestia, ported from the
// original Drizzle/SQLite schema in src/db/schema.ts.
package models

import (
	"encoding/json"
	"time"
)

// Household is the top-level tenant: one shared login, one shared kiosk
// screen, many member profiles.
type Household struct {
	ID              string    `gorm:"primaryKey" json:"id"`
	Name            string    `gorm:"not null" json:"name"`
	ThemePreference string    `gorm:"not null;default:system" json:"themePreference"` // system | light | dark
	CreatedAt       time.Time `json:"createdAt"`

	Users     []User     `gorm:"foreignKey:HouseholdID;constraint:OnDelete:CASCADE" json:"-"`
	Chores    []Chore    `gorm:"foreignKey:HouseholdID;constraint:OnDelete:CASCADE" json:"-"`
	Reminders []Reminder `gorm:"foreignKey:HouseholdID;constraint:OnDelete:CASCADE" json:"-"`
	Rewards   []Reward   `gorm:"foreignKey:HouseholdID;constraint:OnDelete:CASCADE" json:"-"`
}

// User is a household member profile. Any profile can have Email/
// PasswordHash set for its own direct login (typically the household's
// creator, or anyone invited by email); profiles without one are
// switched into locally via the avatar picker, optionally PIN-gated.
// Role is scoped to this profile's own household ("hoh" = owns/manages
// this household, same as the old "admin"); IsSystemAdmin is a separate,
// household-independent flag for instance-wide administration (inviting
// HoHs, managing every household). PasswordHash/PinHash are never
// serialized to JSON.
type User struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	HouseholdID   string    `gorm:"not null;index" json:"householdId"`
	Name          string    `gorm:"not null" json:"name"`
	AvatarEmoji   string    `gorm:"not null" json:"avatarEmoji"`
	Role          string    `gorm:"not null;default:member" json:"role"` // hoh | member
	IsSystemAdmin bool      `gorm:"not null;default:false" json:"isSystemAdmin"`
	Email         *string   `gorm:"uniqueIndex" json:"email,omitempty"`
	PasswordHash  *string   `json:"-"`
	PinHash       *string   `json:"-"`
	Points        int       `gorm:"not null;default:0" json:"points"`
	CreatedAt     time.Time `json:"createdAt"`
}

// MarshalJSON adds a "hasPin" flag derived from PinHash (which itself
// stays excluded from the JSON output) so the avatar-picker UI can show a
// lock icon without ever seeing the hash.
func (u User) MarshalJSON() ([]byte, error) {
	type alias User
	return json.Marshal(struct {
		alias
		HasPIN bool `json:"hasPin"`
	}{alias: alias(u), HasPIN: u.PinHash != nil})
}

// Chore is a task that can be one-time or recurring, optionally assigned
// to a specific member, and awards points on completion.
type Chore struct {
	ID          string  `gorm:"primaryKey" json:"id"`
	HouseholdID string  `gorm:"not null;index" json:"householdId"`
	Title       string  `gorm:"not null" json:"title"`
	Description *string `json:"description,omitempty"`
	Points      int     `gorm:"not null;default:0" json:"points"`
	// For "none" (one-time chores), the date it's due. For recurring
	// chores, the date recurrence starts from.
	DueDate    time.Time `gorm:"not null" json:"dueDate"`
	Recurrence string    `gorm:"not null;default:none" json:"recurrence"` // none | daily | weekly | weekdays | custom
	// "custom" uses RecurrenceDays to hold a JSON array of weekday ints
	// (0=Sun..6=Sat).
	RecurrenceDays   *string   `json:"recurrenceDays,omitempty"`
	AssignedToUserID *string   `gorm:"index" json:"assignedToUserId,omitempty"`
	IsActive         bool      `gorm:"not null;default:true" json:"isActive"`
	CreatedAt        time.Time `json:"createdAt"`

	// Computed, not persisted: whether this chore already has a completion
	// recorded for today, and who completed it. Populated by ChoreService
	// so the frontend can render "done today" state without a separate
	// completions-list call.
	CompletedToday    bool    `gorm:"-" json:"completedToday"`
	CompletedByUserID *string `gorm:"-" json:"completedByUserId,omitempty"`
}

// ChoreCompletion records one day's completion of a chore by a user, and
// how many points it awarded (frozen at completion time so later chore
// edits don't retroactively change history).
type ChoreCompletion struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	ChoreID       string    `gorm:"not null;index" json:"choreId"`
	UserID        string    `gorm:"not null;index" json:"userId"`
	CompletedAt   time.Time `gorm:"not null" json:"completedAt"`
	PointsAwarded int       `gorm:"not null;default:0" json:"pointsAwarded"`
}

// Reminder is a simple to-do, optionally assigned to a member; unassigned
// reminders are visible to the whole household.
type Reminder struct {
	ID               string     `gorm:"primaryKey" json:"id"`
	HouseholdID      string     `gorm:"not null;index" json:"householdId"`
	AssignedToUserID *string    `gorm:"index" json:"assignedToUserId,omitempty"`
	Title            string     `gorm:"not null" json:"title"`
	Notes            *string    `json:"notes,omitempty"`
	DueAt            *time.Time `json:"dueAt,omitempty"`
	IsDone           bool       `gorm:"not null;default:false" json:"isDone"`
	CreatedAt        time.Time  `json:"createdAt"`
}

// Reward is something a member can redeem points for.
type Reward struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	HouseholdID string    `gorm:"not null;index" json:"householdId"`
	Title       string    `gorm:"not null" json:"title"`
	Description *string   `json:"description,omitempty"`
	PointCost   int       `gorm:"not null" json:"pointCost"`
	IsActive    bool      `gorm:"not null;default:true" json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
}

// RewardRedemption records one redemption of a reward by a user.
type RewardRedemption struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	RewardID    string    `gorm:"not null;index" json:"rewardId"`
	UserID      string    `gorm:"not null;index" json:"userId"`
	PointsSpent int       `gorm:"not null" json:"pointsSpent"`
	RedeemedAt  time.Time `gorm:"not null" json:"redeemedAt"`
}

// NotificationSettings is a singleton row (always ID
// NotificationSettingsID) holding the instance's admin-notification
// channel: which go_notify_yourself provider to send through and its
// provider-specific config (e.g. {"webhook_url": "..."}), stored as JSON.
// System-admin-only, instance-wide — not per-household. An empty Provider
// means notifications are unconfigured.
//
// Deliberately DB-backed and web-UI-editable, unlike SMTP: these are
// lower-stakes credentials (a leaked webhook URL lets someone post fake
// notifications, not access an external account) and benefit from
// no-redeploy editability. See CLAUDE.md's "Product shape" section.
type NotificationSettings struct {
	ID         string    `gorm:"primaryKey" json:"id"`
	Provider   string    `json:"provider"`
	ConfigJSON string    `json:"-"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// NotificationSettingsID is the fixed primary key of the singleton
// NotificationSettings row.
const NotificationSettingsID = "default"

// Invite is a pending email invitation to join Hestia — either as a new
// HoH (HouseholdID nil: the invitee creates their own, independent
// household on accept) or as a member of an existing household
// (HouseholdID set). Tokens are stored hashed (sha256); the raw token
// only ever exists in the invite email link and the API response at the
// moment of creation.
type Invite struct {
	ID              string     `gorm:"primaryKey" json:"id"`
	HouseholdID     *string    `gorm:"index" json:"householdId,omitempty"`
	Role            string     `gorm:"not null" json:"role"` // hoh | member
	Email           string     `gorm:"not null;index" json:"email"`
	TokenHash       string     `gorm:"not null;uniqueIndex" json:"-"`
	Status          string     `gorm:"not null;default:pending" json:"status"` // pending | accepted | revoked
	InvitedByUserID string     `gorm:"not null" json:"invitedByUserId"`
	ExpiresAt       time.Time  `gorm:"not null" json:"expiresAt"`
	AcceptedAt      *time.Time `json:"acceptedAt,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
}

// IsExpired reports whether this invite is still nominally "pending" in
// the DB but past its expiry — computed on read rather than via a
// background job, same as chore due-dates.
func (i Invite) IsExpired() bool {
	return i.Status == "pending" && time.Now().After(i.ExpiresAt)
}

// MarshalJSON reports "expired" as the JSON status once ExpiresAt has
// passed, instead of the stored "pending" — API consumers shouldn't have
// to duplicate the expiry check themselves.
func (i Invite) MarshalJSON() ([]byte, error) {
	status := i.Status
	if i.IsExpired() {
		status = "expired"
	}
	type alias Invite
	return json.Marshal(struct {
		alias
		Status string `json:"status"`
	}{alias: alias(i), Status: status})
}

// PasswordReset is a pending "forgot password" request for a user with
// email/password login. Tokens are stored hashed (sha256), same rationale
// as Invite.TokenHash — the raw token only ever exists in the reset email
// link and the moment-of-creation response.
type PasswordReset struct {
	ID        string     `gorm:"primaryKey" json:"id"`
	UserID    string     `gorm:"not null;index" json:"userId"`
	TokenHash string     `gorm:"not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expiresAt"`
	UsedAt    *time.Time `json:"usedAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

// IsExpired reports whether this reset token is still unused but past its
// expiry — computed on read, same pattern as Invite.IsExpired.
func (p PasswordReset) IsExpired() bool {
	return p.UsedAt == nil && time.Now().After(p.ExpiresAt)
}

// MarshalJSON exposes ConfigJSON (stored as a raw string for simple
// GORM persistence) as a parsed "config" object in the API response.
func (n NotificationSettings) MarshalJSON() ([]byte, error) {
	var cfg map[string]any
	if n.ConfigJSON != "" {
		_ = json.Unmarshal([]byte(n.ConfigJSON), &cfg)
	}
	type alias NotificationSettings
	return json.Marshal(struct {
		alias
		Config map[string]any `json:"config"`
	}{alias: alias(n), Config: cfg})
}
