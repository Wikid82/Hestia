package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

func (d *Deps) ListReminders(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	reminders, err := d.Reminder.List(household.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list reminders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reminders": reminders})
}

type reminderRequest struct {
	Title            string  `json:"title"`
	Notes            *string `json:"notes"`
	DueAt            string  `json:"dueAt"` // YYYY-MM-DD, optional
	AssignedToUserID *string `json:"assignedToUserId"`
}

func (d *Deps) CreateReminder(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	user := middleware.CurrentUser(c)

	var req reminderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}

	var dueAt *time.Time
	if req.DueAt != "" {
		parsed, err := time.ParseInLocation("2006-01-02", req.DueAt, time.Local)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid due date"})
			return
		}
		dueAt = &parsed
	}

	// Non-HoHs can only create reminders for themselves or the whole
	// household — not assign work to someone else.
	assignedToUserID := req.AssignedToUserID
	if user.Role != "hoh" && assignedToUserID != nil && *assignedToUserID != user.ID {
		assignedToUserID = &user.ID
	}

	reminder, err := d.Reminder.Create(household.ID, services.ReminderInput{
		Title: req.Title, Notes: req.Notes, DueAt: dueAt, AssignedToUserID: assignedToUserID,
	})
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "assignee not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create reminder"})
		return
	}
	c.JSON(http.StatusCreated, reminder)
}

func (d *Deps) ToggleReminderDone(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	reminder, err := d.Reminder.ToggleDone(household.ID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "reminder not found"})
		return
	}
	c.JSON(http.StatusOK, reminder)
}

func (d *Deps) DeleteReminder(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	user := middleware.CurrentUser(c)

	err := d.Reminder.Delete(household.ID, c.Param("id"), user.ID, user.Role)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "reminder not found"})
		case errors.Is(err, services.ErrForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only delete your own reminders"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete reminder"})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
