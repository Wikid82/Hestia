package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/models"
	"hestia/backend/internal/services"
)

type createInviteRequest struct {
	Email string `json:"email"`
}

type createInviteResponse struct {
	Invite     *models.Invite `json:"invite"`
	EmailSent  bool           `json:"emailSent"`
	EmailError string         `json:"emailError,omitempty"`
}

// sendInviteEmail builds and sends the invite link email. householdName
// is only used in the message copy for member invites (empty for hoh
// invites, which have no household yet).
func (d *Deps) sendInviteEmail(invite *models.Invite, rawToken, householdName string) error {
	link := fmt.Sprintf("%s/invite/%s", strings.TrimRight(d.BaseURL, "/"), rawToken)

	var subject, body string
	if invite.Role == "hoh" {
		subject = "You're invited to run your own household on Hestia"
		body = fmt.Sprintf(
			"You've been invited to create your own independent household on this Hestia instance.\n\n"+
				"Set up your account: %s\n\nThis link expires in 7 days.",
			link,
		)
	} else {
		subject = fmt.Sprintf("You're invited to join %s on Hestia", householdName)
		body = fmt.Sprintf(
			"You've been invited to join the %q household on Hestia.\n\n"+
				"Set up your account: %s\n\nThis link expires in 7 days.",
			householdName, link,
		)
	}

	return d.Mailer.Send(invite.Email, subject, body)
}

func inviteCreationErrorStatus(err error) int {
	switch {
	case errors.Is(err, services.ErrEmailTaken):
		return http.StatusConflict
	case errors.Is(err, services.ErrInvalidInviteRole):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// CreateHoHInvite invites a new Head of Household, who will get their own
// independent household on accept. System-admin-only.
func (d *Deps) CreateHoHInvite(c *gin.Context) {
	if !d.Mailer.IsConfigured() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "outbound email is not configured on this instance (set SMTP_HOST/SMTP_PORT/SMTP_FROM and BASE_URL)"})
		return
	}
	var req createInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	actingUser := middleware.CurrentUser(c)
	invite, rawToken, err := d.Invite.CreateInvite("hoh", req.Email, nil, actingUser.ID)
	if err != nil {
		c.JSON(inviteCreationErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	resp := createInviteResponse{Invite: invite, EmailSent: true}
	if err := d.sendInviteEmail(invite, rawToken, ""); err != nil {
		resp.EmailSent = false
		resp.EmailError = err.Error()
	}
	c.JSON(http.StatusCreated, resp)
}

// ListHoHInvites lists every hoh-role invite ever issued on this
// instance. System-admin-only.
func (d *Deps) ListHoHInvites(c *gin.Context) {
	invites, err := d.Invite.ListHoHInvites()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list invites"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"invites": invites})
}

// RevokeHoHInvite revokes a pending hoh invite. System-admin-only, any
// system admin may revoke any hoh invite.
func (d *Deps) RevokeHoHInvite(c *gin.Context) {
	if err := d.Invite.Revoke(c.Param("id"), nil); err != nil {
		if errors.Is(err, services.ErrInviteNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke invite"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CreateMemberInvite invites someone to join the acting HoH's own
// household by email, as an alternative to the no-email managed-profile
// path. HoH-only, scoped to their own household.
func (d *Deps) CreateMemberInvite(c *gin.Context) {
	if !d.Mailer.IsConfigured() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "outbound email is not configured on this instance (set SMTP_HOST/SMTP_PORT/SMTP_FROM and BASE_URL)"})
		return
	}
	var req createInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	household := middleware.CurrentHousehold(c)
	actingUser := middleware.CurrentUser(c)
	invite, rawToken, err := d.Invite.CreateInvite("member", req.Email, &household.ID, actingUser.ID)
	if err != nil {
		c.JSON(inviteCreationErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	resp := createInviteResponse{Invite: invite, EmailSent: true}
	if err := d.sendInviteEmail(invite, rawToken, household.Name); err != nil {
		resp.EmailSent = false
		resp.EmailError = err.Error()
	}
	c.JSON(http.StatusCreated, resp)
}

// ListMemberInvites lists every invite issued for the acting HoH's own
// household. HoH-only.
func (d *Deps) ListMemberInvites(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	invites, err := d.Invite.ListForHousehold(household.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list invites"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"invites": invites})
}

// RevokeMemberInvite revokes a pending member invite. HoH-only, scoped to
// their own household — an invite belonging to a different household
// reports as not found rather than forbidden, so as not to confirm its
// existence.
func (d *Deps) RevokeMemberInvite(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	if err := d.Invite.Revoke(c.Param("id"), &household.ID); err != nil {
		if errors.Is(err, services.ErrInviteNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke invite"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type invitePreview struct {
	Role          string    `json:"role"`
	Email         string    `json:"email"`
	Status        string    `json:"status"`
	HouseholdName *string   `json:"householdName,omitempty"`
	ExpiresAt     time.Time `json:"expiresAt"`
}

// GetInvitePreview reports enough about a pending invite for the public
// accept page to render context ("you're joining the Smith household as
// a member") before the invitee submits anything. No auth required.
func (d *Deps) GetInvitePreview(c *gin.Context) {
	invite, err := d.Invite.GetByToken(c.Param("token"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
		return
	}

	status := invite.Status
	if invite.IsExpired() {
		status = "expired"
	}
	preview := invitePreview{Role: invite.Role, Email: invite.Email, Status: status, ExpiresAt: invite.ExpiresAt}

	if invite.HouseholdID != nil {
		household, err := d.Household.Get(*invite.HouseholdID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load invite"})
			return
		}
		preview.HouseholdName = &household.Name
	}

	c.JSON(http.StatusOK, preview)
}

type acceptInviteRequest struct {
	Name          string `json:"name" binding:"required"`
	Password      string `json:"password" binding:"required"`
	HouseholdName string `json:"householdName"`
}

// AcceptInvite validates the invite and creates the invitee's account,
// then logs them straight in (same cookie-setting as Signup) so accepting
// an invite doesn't require a separate login step. No auth required.
func (d *Deps) AcceptInvite(c *gin.Context) {
	var req acceptInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and password are required"})
		return
	}
	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	household, user, err := d.Invite.AcceptInvite(c.Param("token"), req.Name, req.Password, req.HouseholdName)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInviteNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
		case errors.Is(err, services.ErrInviteNotPending), errors.Is(err, services.ErrInviteExpired):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, services.ErrEmailTaken):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept invite"})
		}
		return
	}

	if err := d.setSessionCookie(c, household.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session error"})
		return
	}
	if err := d.setProfileCookie(c, household.ID, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session error"})
		return
	}

	// Best-effort: a failed notification shouldn't fail the invitee's own
	// signup, which has already succeeded at this point.
	_ = d.Notify.Notify(c.Request.Context(), "invite.accepted",
		"Invite accepted",
		fmt.Sprintf("%s (%s) accepted their invite and joined %q as %s.", user.Name, *user.Email, household.Name, user.Role),
		map[string]any{"userId": user.ID, "householdId": household.ID, "role": user.Role},
	)

	c.JSON(http.StatusCreated, gin.H{"household": household, "user": user})
}
