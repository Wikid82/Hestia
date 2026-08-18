package testutil

import (
	"testing"

	"hestia/backend/internal/models"
)

func TestPoisonTable_OnlyAffectsTargetTable(t *testing.T) {
	db := NewDB(t)

	household := models.Household{ID: "hh-1", Name: "Test", ThemePreference: "system"}
	if err := db.Create(&household).Error; err != nil {
		t.Fatalf("seeding household: %v", err)
	}

	PoisonTable(db, "chores")

	// Households are untouched by the poison.
	var got models.Household
	if err := db.Where("id = ?", "hh-1").First(&got).Error; err != nil {
		t.Errorf("expected households queries to keep working, got: %v", err)
	}

	// Chores fail.
	var chores []models.Chore
	if err := db.Where("household_id = ?", "hh-1").Find(&chores).Error; err == nil {
		t.Error("expected a poisoned chores query to fail")
	}

	// Creating a chore also fails (Create callback, not just Query).
	chore := models.Chore{ID: "c-1", HouseholdID: "hh-1", Title: "X", DueDate: got.CreatedAt, Recurrence: "none"}
	if err := db.Create(&chore).Error; err == nil {
		t.Error("expected a poisoned chore create to fail")
	}
}
