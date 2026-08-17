export type ThemePreference = "system" | "light" | "dark";
export type Role = "hoh" | "member";
export type Recurrence = "none" | "daily" | "weekly" | "weekdays" | "custom";

export type Household = {
  id: string;
  name: string;
  themePreference: ThemePreference;
  createdAt: string;
};

export type Profile = {
  id: string;
  householdId: string;
  name: string;
  avatarEmoji: string;
  role: Role;
  isSystemAdmin: boolean;
  email?: string | null;
  points: number;
  createdAt: string;
  hasPin: boolean;
};

export type NotificationProvider =
  | ""
  | "discord"
  | "slack"
  | "gotify"
  | "pushover"
  | "ntfy"
  | "telegram"
  | "webhook";

export type NotificationSettings = {
  id: string;
  provider: NotificationProvider;
  config: Record<string, string> | null;
  updatedAt: string;
};

export type Chore = {
  id: string;
  householdId: string;
  title: string;
  description?: string | null;
  points: number;
  dueDate: string;
  recurrence: Recurrence;
  recurrenceDays?: string | null;
  assignedToUserId?: string | null;
  isActive: boolean;
  createdAt: string;
  completedToday: boolean;
  completedByUserId?: string | null;
};

export type ChoreCompletion = {
  id: string;
  choreId: string;
  userId: string;
  completedAt: string;
  pointsAwarded: number;
};

export type Reminder = {
  id: string;
  householdId: string;
  assignedToUserId?: string | null;
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  isDone: boolean;
  createdAt: string;
};

export type Reward = {
  id: string;
  householdId: string;
  title: string;
  description?: string | null;
  pointCost: number;
  isActive: boolean;
  createdAt: string;
};

export type RewardRedemption = {
  id: string;
  rewardId: string;
  userId: string;
  pointsSpent: number;
  redeemedAt: string;
};

export type WSEvent =
  | { type: "chore.completed"; choreId: string; userId: string }
  | { type: "chore.uncompleted"; choreId: string; userId: string }
  | { type: "reward.redeemed"; rewardId: string; userId: string };
