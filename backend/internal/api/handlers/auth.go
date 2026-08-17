package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

type signupRequest struct {
	HouseholdName string `json:"householdName" binding:"required"`
	Name          string `json:"name" binding:"required"`
	Email         string `json:"email" binding:"required"`
	Password      string `json:"password" binding:"required"`
}

func (d *Deps) Signup(c *gin.Context) {
	var req signupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "all fields are required"})
		return
	}
	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	household, user, err := d.HHAuth.Signup(req.HouseholdName, req.Name, req.Email, req.Password, d.AllowPublicSignup)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrEmailTaken):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case errors.Is(err, services.ErrSignupDisabled):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "signup failed"})
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

	c.JSON(http.StatusCreated, gin.H{"household": household, "user": user})
}

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (d *Deps) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, err := d.HHAuth.Login(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	if err := d.setSessionCookie(c, user.HouseholdID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session error"})
		return
	}
	if err := d.setProfileCookie(c, user.HouseholdID, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (d *Deps) Logout(c *gin.Context) {
	d.clearAuthCookies(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ListProfiles returns every profile in the household, for the
// avatar-picker screen. Requires only a household session, not an active
// profile.
func (d *Deps) ListProfiles(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	users, err := d.Member.List(household.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list profiles"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"profiles": users})
}

type switchProfileRequest struct {
	PIN string `json:"pin"`
}

// SwitchProfile selects a profile via the avatar picker (optionally
// gated by a PIN for admin-role profiles) and issues a profile cookie.
func (d *Deps) SwitchProfile(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	userID := c.Param("id")

	var req switchProfileRequest
	_ = c.ShouldBindJSON(&req)

	user, err := d.HHAuth.SwitchProfile(household.ID, userID, req.PIN)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		case errors.Is(err, services.ErrIncorrectPIN):
			c.JSON(http.StatusForbidden, gin.H{"error": "incorrect PIN"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "switch failed"})
		}
		return
	}

	if err := d.setProfileCookie(c, household.ID, user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "session error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// SwitchToPicker clears the active profile session, returning to the
// avatar picker without logging out of the household entirely.
func (d *Deps) SwitchToPicker(c *gin.Context) {
	d.clearProfileCookie(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Me reports the current session state: the household (always present,
// since this route requires a household session) and the active profile
// (nil if there's a household session but no profile has been picked yet).
// The frontend uses this on load to decide whether to route to /login,
// /switch-profile, or the app shell.
func (d *Deps) Me(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var user any
	if token, err := c.Cookie(services.ProfileCookie); err == nil && token != "" {
		if claims, verr := d.Auth.VerifyProfile(token); verr == nil && claims.HouseholdID == household.ID {
			if u, gerr := d.Member.Get(household.ID, claims.UserID); gerr == nil {
				user = u
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"household": household, "user": user})
}
