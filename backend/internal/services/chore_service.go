package services

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"hestia/backend/internal/models"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrForbidden    = errors.New("forbidden")
	ErrAlreadyDone  = errors.New("already completed today")
	ErrNotCompleted = errors.New("not completed today")
	ErrUnassigned   = errors.New("chore has no assignee")
)

// ChoreService implements chore CRUD and completion/points logic, ported
// from src/lib/actions/chores.ts.
type ChoreService struct {
	db *gorm.DB
}

func NewChoreService(db *gorm.DB) *ChoreService {
	return &ChoreService{db: db}
}

type ChoreInput struct {
	Title            string
	Description      *string
	Points           int
	AssignedToUserID string
	Recurrence       string
	DueDate          time.Time
	RecurrenceDays   *string
}

// List returns all chores for a household, optionally filtered to only
// those due today.
func (s *ChoreService) List(householdID string, dueToday bool) ([]models.Chore, error) {
	var chores []models.Chore
	if err := s.db.Where("household_id = ?", householdID).Order("due_date asc").Find(&chores).Error; err != nil {
		return nil, err
	}
	if dueToday {
		out := make([]models.Chore, 0, len(chores))
		for _, c := range chores {
			if !c.IsActive {
				continue
			}
			if IsChoreDueOn(RecurrenceConfig{Recurrence: c.Recurrence, DueDate: c.DueDate, RecurrenceDays: c.RecurrenceDays}, time.Now()) {
				out = append(out, c)
			}
		}
		chores = out
	}
	if err := s.attachCompletionStatus(chores); err != nil {
		return nil, err
	}
	return chores, nil
}

func (s *ChoreService) Get(householdID, id string) (*models.Chore, error) {
	var chore models.Chore
	if err := s.db.Where("id = ? AND household_id = ?", id, householdID).First(&chore).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	withStatus := []models.Chore{chore}
	if err := s.attachCompletionStatus(withStatus); err != nil {
		return nil, err
	}
	return &withStatus[0], nil
}

// attachCompletionStatus populates CompletedToday/CompletedByUserID on each
// chore by looking up today's ChoreCompletion rows in one query, so the
// frontend can render "done today" state without a separate endpoint.
func (s *ChoreService) attachCompletionStatus(chores []models.Chore) error {
	if len(chores) == 0 {
		return nil
	}
	ids := make([]string, len(chores))
	for i, c := range chores {
		ids[i] = c.ID
	}
	start, end := todayRange()
	var completions []models.ChoreCompletion
	if err := s.db.Where("chore_id IN ? AND completed_at >= ? AND completed_at < ?", ids, start, end).Find(&completions).Error; err != nil {
		return err
	}
	byChore := make(map[string]string, len(completions)) // choreID -> userID
	for _, comp := range completions {
		byChore[comp.ChoreID] = comp.UserID
	}
	for i := range chores {
		if userID, ok := byChore[chores[i].ID]; ok {
			chores[i].CompletedToday = true
			u := userID
			chores[i].CompletedByUserID = &u
		}
	}
	return nil
}

func (s *ChoreService) validateAssignee(householdID, userID string) error {
	var count int64
	if err := s.db.Model(&models.User{}).Where("id = ? AND household_id = ?", userID, householdID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *ChoreService) Create(householdID string, in ChoreInput) (*models.Chore, error) {
	if err := s.validateAssignee(householdID, in.AssignedToUserID); err != nil {
		return nil, err
	}
	assignee := in.AssignedToUserID
	chore := models.Chore{
		ID:               uuid.NewString(),
		HouseholdID:      householdID,
		Title:            in.Title,
		Description:      in.Description,
		Points:           in.Points,
		DueDate:          in.DueDate,
		Recurrence:       in.Recurrence,
		RecurrenceDays:   in.RecurrenceDays,
		AssignedToUserID: &assignee,
		IsActive:         true,
	}
	if err := s.db.Create(&chore).Error; err != nil {
		return nil, err
	}
	return &chore, nil
}

func (s *ChoreService) Update(householdID, id string, in ChoreInput) (*models.Chore, error) {
	existing, err := s.Get(householdID, id)
	if err != nil {
		return nil, err
	}
	if err := s.validateAssignee(householdID, in.AssignedToUserID); err != nil {
		return nil, err
	}
	assignee := in.AssignedToUserID
	existing.Title = in.Title
	existing.Description = in.Description
	existing.Points = in.Points
	existing.DueDate = in.DueDate
	existing.Recurrence = in.Recurrence
	existing.RecurrenceDays = in.RecurrenceDays
	existing.AssignedToUserID = &assignee
	if err := s.db.Save(existing).Error; err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *ChoreService) Delete(householdID, id string) error {
	return s.db.Where("id = ? AND household_id = ?", id, householdID).Delete(&models.Chore{}).Error
}

func todayRange() (time.Time, time.Time) {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	end := start.AddDate(0, 0, 1)
	return start, end
}

// Complete marks a chore done for today, awarding points to the assignee.
// Anyone can mark their own chore done; HoHs can mark on behalf of
// someone else too. Returns ErrAlreadyDone if already completed today
// (a no-op, not an error condition the caller needs to surface loudly).
func (s *ChoreService) Complete(householdID, choreID, actingUserID, actingRole string) (*models.ChoreCompletion, error) {
	chore, err := s.Get(householdID, choreID)
	if err != nil {
		return nil, err
	}
	if chore.AssignedToUserID == nil {
		return nil, ErrUnassigned
	}
	if *chore.AssignedToUserID != actingUserID && actingRole != "hoh" {
		return nil, ErrForbidden
	}

	start, end := todayRange()
	var existing models.ChoreCompletion
	err = s.db.Where("chore_id = ? AND completed_at >= ? AND completed_at < ?", chore.ID, start, end).First(&existing).Error
	if err == nil {
		return nil, ErrAlreadyDone
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	assignedToUserID := *chore.AssignedToUserID
	completion := models.ChoreCompletion{
		ID:            uuid.NewString(),
		ChoreID:       chore.ID,
		UserID:        assignedToUserID,
		CompletedAt:   time.Now(),
		PointsAwarded: chore.Points,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&completion).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", assignedToUserID).
			Update("points", gorm.Expr("points + ?", chore.Points)).Error
	})
	if err != nil {
		return nil, err
	}
	return &completion, nil
}

// Uncomplete reverts today's completion of a chore, deducting the points
// that were awarded.
func (s *ChoreService) Uncomplete(householdID, choreID, actingUserID, actingRole string) error {
	chore, err := s.Get(householdID, choreID)
	if err != nil {
		return err
	}
	if chore.AssignedToUserID == nil {
		return ErrUnassigned
	}
	if *chore.AssignedToUserID != actingUserID && actingRole != "hoh" {
		return ErrForbidden
	}

	start, end := todayRange()
	var completion models.ChoreCompletion
	err = s.db.Where("chore_id = ? AND completed_at >= ? AND completed_at < ?", chore.ID, start, end).First(&completion).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotCompleted
	}
	if err != nil {
		return err
	}

	assignedToUserID := *chore.AssignedToUserID
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&completion).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", assignedToUserID).
			Update("points", gorm.Expr("points - ?", completion.PointsAwarded)).Error
	})
}
