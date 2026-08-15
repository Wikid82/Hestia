// Package middleware provides Gin middleware for the two-tier household
// and profile session model.
package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
	"hestia/backend/internal/services"
)

const (
	HouseholdKey = "household"
	UserKey      = "user"
)

// RequireHousehold verifies the hestia_session cookie and loads the
// household into the Gin context. Aborts with 401 if missing/invalid.
func RequireHousehold(auth *services.AuthService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(services.SessionCookie)
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		claims, err := auth.VerifySession(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
			return
		}

		var household models.Household
		if err := db.Where("id = ?", claims.HouseholdID).First(&household).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "household not found"})
			return
		}

		c.Set(HouseholdKey, &household)
		c.Next()
	}
}

// RequireProfile verifies the hestia_profile cookie (in addition to
// RequireHousehold, which must run first) and loads the active user
// profile into the Gin context. Aborts with 403 if missing/invalid.
func RequireProfile(auth *services.AuthService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		household := CurrentHousehold(c)
		if household == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}

		token, err := c.Cookie(services.ProfileCookie)
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "no active profile"})
			return
		}
		claims, err := auth.VerifyProfile(token)
		if err != nil || claims.HouseholdID != household.ID {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid profile session"})
			return
		}

		var user models.User
		if err := db.Where("id = ?", claims.UserID).First(&user).Error; err != nil || user.HouseholdID != household.ID {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "profile not found"})
			return
		}

		c.Set(UserKey, &user)
		c.Next()
	}
}

// RequireAdmin aborts with 403 unless the active profile has the admin
// role. Must run after RequireProfile.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := CurrentUser(c)
		if user == nil || user.Role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "this action requires an admin profile"})
			return
		}
		c.Next()
	}
}

func CurrentHousehold(c *gin.Context) *models.Household {
	v, ok := c.Get(HouseholdKey)
	if !ok {
		return nil
	}
	h, _ := v.(*models.Household)
	return h
}

func CurrentUser(c *gin.Context) *models.User {
	v, ok := c.Get(UserKey)
	if !ok {
		return nil
	}
	u, _ := v.(*models.User)
	return u
}
