package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"hestia/backend/internal/api/middleware"
	"hestia/backend/internal/services"
)

var validRecurrences = map[string]bool{
	"none": true, "daily": true, "weekly": true, "weekdays": true, "custom": true,
}

func (d *Deps) ListChores(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	dueToday := c.Query("due") == "today"

	chores, err := d.Chore.List(household.ID, dueToday)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list chores"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"chores": chores})
}

func (d *Deps) GetChore(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	chore, err := d.Chore.Get(household.ID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "chore not found"})
		return
	}
	c.JSON(http.StatusOK, chore)
}

type choreRequest struct {
	Title            string  `json:"title"`
	Description      *string `json:"description"`
	Points           int     `json:"points"`
	AssignedToUserID string  `json:"assignedToUserId"`
	Recurrence       string  `json:"recurrence"`
	DueDate          string  `json:"dueDate"` // YYYY-MM-DD
	RecurrenceDays   []int   `json:"recurrenceDays"`
}

func (r *choreRequest) toInput() (services.ChoreInput, string) {
	if r.Title == "" {
		return services.ChoreInput{}, "title is required"
	}
	if r.AssignedToUserID == "" {
		return services.ChoreInput{}, "choose who this is assigned to"
	}
	if r.Points < 0 {
		return services.ChoreInput{}, "points must be zero or a positive number"
	}
	if r.Recurrence == "" {
		r.Recurrence = "none"
	}
	if !validRecurrences[r.Recurrence] {
		return services.ChoreInput{}, "invalid recurrence"
	}
	dueDate, err := time.ParseInLocation("2006-01-02", r.DueDate, time.Local)
	if err != nil {
		return services.ChoreInput{}, "choose a valid due date"
	}
	var recurrenceDays *string
	if r.Recurrence == "custom" {
		if len(r.RecurrenceDays) == 0 {
			return services.ChoreInput{}, "pick at least one day for a custom schedule"
		}
		s := services.SerializeRecurrenceDays(r.RecurrenceDays)
		recurrenceDays = &s
	}

	return services.ChoreInput{
		Title:            r.Title,
		Description:      r.Description,
		Points:           r.Points,
		AssignedToUserID: r.AssignedToUserID,
		Recurrence:       r.Recurrence,
		DueDate:          dueDate,
		RecurrenceDays:   recurrenceDays,
	}, ""
}

func (d *Deps) CreateChore(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req choreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	input, errMsg := req.toInput()
	if errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	chore, err := d.Chore.Create(household.ID, input)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "assignee not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create chore"})
		return
	}
	c.JSON(http.StatusCreated, chore)
}

func (d *Deps) UpdateChore(c *gin.Context) {
	household := middleware.CurrentHousehold(c)

	var req choreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	input, errMsg := req.toInput()
	if errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	chore, err := d.Chore.Update(household.ID, c.Param("id"), input)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "chore not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update chore"})
		return
	}
	c.JSON(http.StatusOK, chore)
}

func (d *Deps) DeleteChore(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	if err := d.Chore.Delete(household.ID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete chore"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (d *Deps) CompleteChore(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	user := middleware.CurrentUser(c)
	choreID := c.Param("id")

	completion, err := d.Chore.Complete(household.ID, choreID, user.ID, user.Role)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "chore not found"})
		case errors.Is(err, services.ErrForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "this chore isn't assigned to you"})
		case errors.Is(err, services.ErrUnassigned):
			c.JSON(http.StatusBadRequest, gin.H{"error": "chore has no assignee"})
		case errors.Is(err, services.ErrAlreadyDone):
			c.JSON(http.StatusOK, gin.H{"ok": true, "alreadyDone": true})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete chore"})
		}
		return
	}

	d.broadcastEvent("chore.completed", map[string]any{"choreId": choreID, "userId": completion.UserID})
	c.JSON(http.StatusOK, completion)
}

func (d *Deps) UncompleteChore(c *gin.Context) {
	household := middleware.CurrentHousehold(c)
	user := middleware.CurrentUser(c)
	choreID := c.Param("id")

	err := d.Chore.Uncomplete(household.ID, choreID, user.ID, user.Role)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "chore not found"})
		case errors.Is(err, services.ErrForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "this chore isn't assigned to you"})
		case errors.Is(err, services.ErrUnassigned), errors.Is(err, services.ErrNotCompleted):
			c.JSON(http.StatusOK, gin.H{"ok": true})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to uncomplete chore"})
		}
		return
	}

	d.broadcastEvent("chore.uncompleted", map[string]any{"choreId": choreID, "userId": user.ID})
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
