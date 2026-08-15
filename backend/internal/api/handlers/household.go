package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
)

func (d *Deps) GetHousehold(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	c.JSON(http.StatusOK, household)
}

type updateHouseholdRequest struct {
	Name            *string `json:"name"`
	ThemePreference *string `json:"themePreference"`
}

// UpdateHousehold handles rename and/or theme-preference changes in a
// single PATCH, mirroring renameHousehold + updateThemePreference from
// src/lib/actions/household.ts.
func (d *Deps) UpdateHousehold(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req updateHouseholdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if req.Name != nil {
		name := *req.Name
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "household name is required"})
			return
		}
		updated, err := d.Household.Rename(household.ID, name)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "rename failed"})
			return
		}
		household = updated
	}

	if req.ThemePreference != nil {
		updated, err := d.Household.UpdateTheme(household.ID, *req.ThemePreference)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid theme preference"})
			return
		}
		household = updated
	}

	c.JSON(http.StatusOK, household)
}
