package services

import (
	"encoding/json"
	"sort"
	"time"
)

// RecurrenceConfig mirrors the fields needed to compute due-dates, ported
// from src/lib/chores/recurrence.ts.
type RecurrenceConfig struct {
	Recurrence     string // none | daily | weekly | weekdays | custom
	DueDate        time.Time
	RecurrenceDays *string // JSON array of weekday ints (0=Sun..6=Sat)
}

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// ParseRecurrenceDays decodes the JSON weekday-int array, silently
// dropping anything malformed or out of range (0-6), matching the
// permissive behavior of the original TS implementation.
func ParseRecurrenceDays(raw *string) []int {
	if raw == nil || *raw == "" {
		return []int{}
	}
	var parsed []int
	if err := json.Unmarshal([]byte(*raw), &parsed); err != nil {
		return []int{}
	}
	out := make([]int, 0, len(parsed))
	for _, d := range parsed {
		if d >= 0 && d <= 6 {
			out = append(out, d)
		}
	}
	return out
}

// SerializeRecurrenceDays encodes a de-duplicated, sorted weekday-int
// array as JSON.
func SerializeRecurrenceDays(days []int) string {
	set := make(map[int]bool)
	for _, d := range days {
		set[d] = true
	}
	unique := make([]int, 0, len(set))
	for d := range set {
		unique = append(unique, d)
	}
	sort.Ints(unique)
	b, _ := json.Marshal(unique)
	return string(b)
}

// IsChoreDueOn reports whether chore is due on the given date. A one-time
// chore ("none") is due only on its exact due date. Recurring chores
// never come due before their anchor date (DueDate doubles as the
// recurrence start), and weekly recurrence repeats on the anchor's
// weekday.
func IsChoreDueOn(chore RecurrenceConfig, date time.Time) bool {
	target := startOfDay(date)
	anchor := startOfDay(chore.DueDate)

	if chore.Recurrence == "none" {
		return target.Equal(anchor)
	}

	if target.Before(anchor) {
		return false
	}

	switch chore.Recurrence {
	case "daily":
		return true
	case "weekly":
		return target.Weekday() == anchor.Weekday()
	case "weekdays":
		wd := target.Weekday()
		return wd >= time.Monday && wd <= time.Friday
	case "custom":
		for _, d := range ParseRecurrenceDays(chore.RecurrenceDays) {
			if time.Weekday(d) == target.Weekday() {
				return true
			}
		}
		return false
	default:
		return false
	}
}

// IsChoreDueToday reports whether chore is due today (local time).
func IsChoreDueToday(chore RecurrenceConfig) bool {
	return IsChoreDueOn(chore, time.Now())
}

var weekdayLabels = []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}

// DescribeRecurrence returns a short human-readable description of a
// chore's recurrence, mirroring describeRecurrence from the TS source.
func DescribeRecurrence(chore RecurrenceConfig) string {
	switch chore.Recurrence {
	case "none":
		return "One-time (" + chore.DueDate.Format("1/2/2006") + ")"
	case "daily":
		return "Daily"
	case "weekly":
		return "Weekly (" + weekdayLabels[int(chore.DueDate.Weekday())] + ")"
	case "weekdays":
		return "Weekdays"
	case "custom":
		days := ParseRecurrenceDays(chore.RecurrenceDays)
		labels := make([]string, len(days))
		for i, d := range days {
			labels[i] = weekdayLabels[d]
		}
		out := ""
		for i, l := range labels {
			if i > 0 {
				out += ", "
			}
			out += l
		}
		return "Custom (" + out + ")"
	default:
		return chore.Recurrence
	}
}

// DueDatesInRange returns every date in [start, end] (inclusive) that the
// chore is due on — used to plot a chore across a calendar month.
func DueDatesInRange(chore RecurrenceConfig, start, end time.Time) []time.Time {
	var dates []time.Time
	cursor := startOfDay(start)
	last := startOfDay(end)

	for !cursor.After(last) {
		if IsChoreDueOn(chore, cursor) {
			dates = append(dates, cursor)
		}
		cursor = cursor.AddDate(0, 0, 1)
	}

	return dates
}
