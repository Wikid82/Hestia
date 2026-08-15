package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

func (d *Deps) ListMembers(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	users, err := d.Member.List(household.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": users})
}

func (d *Deps) GetMember(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	user, err := d.Member.Get(household.ID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

type memberRequest struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	AvatarEmoji string `json:"avatarEmoji"`
	PIN         string `json:"pin"`
}

func (d *Deps) CreateMember(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req memberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	user, err := d.Member.Create(household.ID, services.MemberInput{
		Name: req.Name, Role: req.Role, AvatarEmoji: req.AvatarEmoji, PIN: req.PIN,
	})
	if err != nil {
		if errors.Is(err, services.ErrInvalidPIN) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create member"})
		return
	}
	c.JSON(http.StatusCreated, user)
}

func (d *Deps) UpdateMember(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req memberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	user, err := d.Member.Update(household.ID, c.Param("id"), services.MemberInput{
		Name: req.Name, Role: req.Role, AvatarEmoji: req.AvatarEmoji, PIN: req.PIN,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		case errors.Is(err, services.ErrInvalidPIN):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member"})
		}
		return
	}
	c.JSON(http.StatusOK, user)
}

func (d *Deps) ClearMemberPIN(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	if err := d.Member.ClearPIN(household.ID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (d *Deps) DeleteMember(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	err := d.Member.Delete(household.ID, c.Param("id"))
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		case errors.Is(err, services.ErrMainAccountUndeletable):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete member"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
