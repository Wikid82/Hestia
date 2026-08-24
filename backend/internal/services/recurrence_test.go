package services

import (
	"testing"
	"time"
)

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func TestParseRecurrenceDays(t *testing.T) {
	tests := []struct {
		name string
		raw  *string
		want []int
	}{
		{"nil", nil, []int{}},
		{"empty string", ptr(""), []int{}},
		{"valid", ptr(`[1,3,5]`), []int{1, 3, 5}},
		{"out of range dropped", ptr(`[-1,0,6,7]`), []int{0, 6}},
		{"malformed json", ptr(`not json`), []int{}},
		{"not an array", ptr(`{"a":1}`), []int{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseRecurrenceDays(tt.raw)
			if !intSliceEqual(got, tt.want) {
				t.Errorf("ParseRecurrenceDays(%v) = %v, want %v", derefOrNil(tt.raw), got, tt.want)
			}
		})
	}
}

func TestSerializeRecurrenceDays(t *testing.T) {
	tests := []struct {
		name string
		days []int
		want string
	}{
		{"empty", []int{}, "[]"},
		{"dedupes and sorts", []int{5, 1, 1, 3}, "[1,3,5]"},
		{"single", []int{2}, "[2]"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SerializeRecurrenceDays(tt.days); got != tt.want {
				t.Errorf("SerializeRecurrenceDays(%v) = %q, want %q", tt.days, got, tt.want)
			}
		})
	}
}

func TestIsChoreDueOn(t *testing.T) {
	anchor := date(2026, time.August, 17) // a Monday

	tests := []struct {
		name   string
		config RecurrenceConfig
		target time.Time
		want   bool
	}{
		{"none: exact due date", RecurrenceConfig{Recurrence: "none", DueDate: anchor}, anchor, true},
		{"none: different date", RecurrenceConfig{Recurrence: "none", DueDate: anchor}, anchor.AddDate(0, 0, 1), false},
		{"none: time-of-day ignored", RecurrenceConfig{Recurrence: "none", DueDate: anchor.Add(5 * time.Hour)}, anchor, true},

		{"daily: on anchor", RecurrenceConfig{Recurrence: "daily", DueDate: anchor}, anchor, true},
		{"daily: well after anchor", RecurrenceConfig{Recurrence: "daily", DueDate: anchor}, anchor.AddDate(0, 0, 30), true},
		{"daily: before anchor never due", RecurrenceConfig{Recurrence: "daily", DueDate: anchor}, anchor.AddDate(0, 0, -1), false},

		{"weekly: same weekday next week", RecurrenceConfig{Recurrence: "weekly", DueDate: anchor}, anchor.AddDate(0, 0, 7), true},
		{"weekly: different weekday", RecurrenceConfig{Recurrence: "weekly", DueDate: anchor}, anchor.AddDate(0, 0, 1), false},
		{"weekly: before anchor never due even if same weekday", RecurrenceConfig{Recurrence: "weekly", DueDate: anchor}, anchor.AddDate(0, 0, -7), false},

		{"weekdays: Monday", RecurrenceConfig{Recurrence: "weekdays", DueDate: anchor}, date(2026, time.August, 17), true},
		{"weekdays: Saturday excluded", RecurrenceConfig{Recurrence: "weekdays", DueDate: anchor}, date(2026, time.August, 22), false},
		{"weekdays: Sunday excluded", RecurrenceConfig{Recurrence: "weekdays", DueDate: anchor}, date(2026, time.August, 23), false},
		{"weekdays: Friday included", RecurrenceConfig{Recurrence: "weekdays", DueDate: anchor}, date(2026, time.August, 21), true},

		{
			"custom: matches one of the configured days",
			RecurrenceConfig{Recurrence: "custom", DueDate: anchor, RecurrenceDays: ptr(`[1,3]`)}, // Mon, Wed
			date(2026, time.August, 19),                                                           // Wednesday
			true,
		},
		{
			"custom: does not match",
			RecurrenceConfig{Recurrence: "custom", DueDate: anchor, RecurrenceDays: ptr(`[1,3]`)},
			date(2026, time.August, 20), // Thursday
			false,
		},
		{
			"custom: no days configured never due",
			RecurrenceConfig{Recurrence: "custom", DueDate: anchor, RecurrenceDays: nil},
			anchor,
			false,
		},

		{"unknown recurrence value defaults to never due", RecurrenceConfig{Recurrence: "bogus", DueDate: anchor}, anchor, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsChoreDueOn(tt.config, tt.target); got != tt.want {
				t.Errorf("IsChoreDueOn() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsChoreDueToday(t *testing.T) {
	// IsChoreDueToday is IsChoreDueOn(chore, time.Now()) — a daily chore
	// anchored in the past should always be due "today," regardless of
	// when the test actually runs.
	config := RecurrenceConfig{Recurrence: "daily", DueDate: date(2000, time.January, 1)}
	if !IsChoreDueToday(config) {
		t.Error("expected a daily chore anchored well in the past to be due today")
	}
}

func TestDescribeRecurrence(t *testing.T) {
	anchor := date(2026, time.August, 17) // Monday

	tests := []struct {
		name   string
		config RecurrenceConfig
		want   string
	}{
		{"none", RecurrenceConfig{Recurrence: "none", DueDate: anchor}, "One-time (8/17/2026)"},
		{"daily", RecurrenceConfig{Recurrence: "daily", DueDate: anchor}, "Daily"},
		{"weekly", RecurrenceConfig{Recurrence: "weekly", DueDate: anchor}, "Weekly (Mon)"},
		{"weekdays", RecurrenceConfig{Recurrence: "weekdays", DueDate: anchor}, "Weekdays"},
		{"custom with days", RecurrenceConfig{Recurrence: "custom", DueDate: anchor, RecurrenceDays: ptr(`[1,3,5]`)}, "Custom (Mon, Wed, Fri)"},
		{"custom with no days", RecurrenceConfig{Recurrence: "custom", DueDate: anchor}, "Custom ()"},
		{"unknown falls back to raw value", RecurrenceConfig{Recurrence: "bogus", DueDate: anchor}, "bogus"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DescribeRecurrence(tt.config); got != tt.want {
				t.Errorf("DescribeRecurrence() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestDueDatesInRange(t *testing.T) {
	anchor := date(2026, time.August, 17) // Monday

	t.Run("weekly within a two week range hits exactly twice", func(t *testing.T) {
		got := DueDatesInRange(
			RecurrenceConfig{Recurrence: "weekly", DueDate: anchor},
			anchor,
			anchor.AddDate(0, 0, 13),
		)
		want := []time.Time{anchor, anchor.AddDate(0, 0, 7)}
		if len(got) != len(want) {
			t.Fatalf("got %d dates, want %d: %v", len(got), len(want), got)
		}
		for i := range want {
			if !got[i].Equal(want[i]) {
				t.Errorf("date[%d] = %v, want %v", i, got[i], want[i])
			}
		}
	})

	t.Run("range entirely before anchor returns nothing", func(t *testing.T) {
		got := DueDatesInRange(
			RecurrenceConfig{Recurrence: "daily", DueDate: anchor},
			anchor.AddDate(0, 0, -10),
			anchor.AddDate(0, 0, -1),
		)
		if len(got) != 0 {
			t.Errorf("expected no due dates before the anchor, got %v", got)
		}
	})

	t.Run("one-time chore returns at most one date", func(t *testing.T) {
		got := DueDatesInRange(
			RecurrenceConfig{Recurrence: "none", DueDate: anchor},
			anchor.AddDate(0, 0, -5),
			anchor.AddDate(0, 0, 5),
		)
		if len(got) != 1 || !got[0].Equal(anchor) {
			t.Errorf("expected exactly [%v], got %v", anchor, got)
		}
	})
}

func ptr(s string) *string { return &s }

func derefOrNil(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func intSliceEqual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
