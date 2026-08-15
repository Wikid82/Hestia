package services

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

// ReminderService implements reminder CRUD, ported from
// src/lib/actions/reminders.ts.
type ReminderService struct {
	db *gorm.DB
}

func NewReminderService(db *gorm.DB) *ReminderService {
	return &ReminderService{db: db}
}

func (s *ReminderService) List(householdID string) ([]models.Reminder, error) {
	var reminders []models.Reminder
	if err := s.db.Where("household_id = ?", householdID).Order("created_at desc").Find(&reminders).Error; err != nil {
		return nil, err
	}
	return reminders, nil
}

func (s *ReminderService) Get(householdID, id string) (*models.Reminder, error) {
	var r models.Reminder
	if err := s.db.Where("id = ? AND household_id = ?", id, householdID).First(&r).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &r, nil
}

type ReminderInput struct {
	Title            string
	Notes            *string
	DueAt            *time.Time
	AssignedToUserID *string
}

// Create inserts a reminder. Non-admins can only create reminders for
// themselves or the whole household (assignedToUserID == nil) — not
// assign work to someone else; the caller is expected to have already
// coerced AssignedToUserID accordingly for non-admin actors (mirroring
// the TS action's silent-downgrade behavior), but we re-validate the
// assignee exists regardless.
func (s *ReminderService) Create(householdID string, in ReminderInput) (*models.Reminder, error) {
	if in.AssignedToUserID != nil {
		var count int64
		if err := s.db.Model(&models.User{}).Where("id = ? AND household_id = ?", *in.AssignedToUserID, householdID).Count(&count).Error; err != nil {
			return nil, err
		}
		if count == 0 {
			return nil, ErrNotFound
		}
	}

	reminder := models.Reminder{
		ID:               uuid.NewString(),
		HouseholdID:      householdID,
		Title:            in.Title,
		Notes:            in.Notes,
		DueAt:            in.DueAt,
		AssignedToUserID: in.AssignedToUserID,
	}
	if err := s.db.Create(&reminder).Error; err != nil {
		return nil, err
	}
	return &reminder, nil
}

func (s *ReminderService) ToggleDone(householdID, id string) (*models.Reminder, error) {
	r, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	r.IsDone = !r.IsDone
	if err := s.db.Save(r).Error; err != nil {
		return nil, err
	}
	return r, nil
}

// Delete removes a reminder. Only an admin or the reminder's own assignee
// may delete it.
func (s *ReminderService) Delete(householdID, id, actingUserID, actingRole string) error {
	r, err := s.Get(householdID, id)
	if err != nil {
		return err
	}
	if actingRole != "admin" && (r.AssignedToUserID == nil || *r.AssignedToUserID != actingUserID) {
		return ErrForbidden
	}
	return s.db.Delete(r).Error
}
