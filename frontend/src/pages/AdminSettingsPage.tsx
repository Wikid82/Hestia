import { useState } from "react";
import { Navigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationSettings,
  testNotificationSettings,
  updateNotificationSettings,
} from "@/api/admin";
import { createHoHInvite, listHoHInvites, revokeHoHInvite } from "@/api/invites";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { InviteEmailForm } from "@/components/InviteEmailForm";
import { InviteList } from "@/components/InviteList";
import type { NotificationProvider } from "@/types";

// Provider -> its config fields, matching the keys each go_notify_yourself
// provider package documents in its register.go (see backend
// notify_service.go). Fields not listed here (e.g. pushover/telegram's
// optional base_url, used only for that package's own tests) aren't
// exposed in this UI.
const PROVIDER_FIELDS: Record<Exclude<NotificationProvider, "">, { key: string; label: string; optional?: boolean }[]> = {
  discord: [{ key: "webhook_url", label: "Webhook URL" }],
  slack: [{ key: "webhook_url", label: "Webhook URL" }],
  gotify: [
    { key: "url", label: "Server push URL" },
    { key: "token", label: "Application token", optional: true },
  ],
  ntfy: [
    { key: "url", label: "Topic URL" },
    { key: "token", label: "Access token", optional: true },
  ],
  pushover: [
    { key: "user_key", label: "User/group key" },
    { key: "api_token", label: "Application API token" },
  ],
  telegram: [
    { key: "bot_token", label: "Bot token" },
    { key: "chat_id", label: "Chat ID" },
  ],
  webhook: [{ key: "url", label: "Destination URL" }],
};

const PROVIDER_OPTIONS: { value: NotificationProvider; label: string }[] = [
  { value: "", label: "None (disabled)" },
  { value: "discord", label: "Discord" },
  { value: "slack", label: "Slack" },
  { value: "gotify", label: "Gotify" },
  { value: "ntfy", label: "ntfy" },
  { value: "pushover", label: "Pushover" },
  { value: "telegram", label: "Telegram" },
  { value: "webhook", label: "Generic webhook" },
];

export default function AdminSettingsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["notification-settings"], queryFn: getNotificationSettings });

  const [provider, setProvider] = useState<NotificationProvider | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const activeProvider = provider ?? settingsQuery.data?.provider ?? "";
  const activeConfig = provider === null ? (settingsQuery.data?.config ?? {}) : config;

  const saveMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(["notification-settings"], settings);
      setProvider(null);
      setConfig({});
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const testMutation = useMutation({
    mutationFn: testNotificationSettings,
    onSuccess: () => setTestResult("Test notification sent."),
    onError: (err) =>
      setTestResult(err instanceof ApiError ? err.message : "Failed to send test notification"),
  });

  const hohInvitesQuery = useQuery({ queryKey: ["hoh-invites"], queryFn: listHoHInvites });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const createInviteMutation = useMutation({
    mutationFn: createHoHInvite,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["hoh-invites"] });
      setInviteError(null);
      setInviteNotice(res.emailSent ? "Invite sent." : `Invite created, but the email failed to send: ${res.emailError}`);
    },
    onError: (err) => setInviteError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const [revokingInviteId, setRevokingInviteId] = useState<string | undefined>();
  const revokeInviteMutation = useMutation({
    mutationFn: revokeHoHInvite,
    onMutate: (id) => setRevokingInviteId(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hoh-invites"] }),
    onSettled: () => setRevokingInviteId(undefined),
  });

  if (!profile || !profile.isSystemAdmin) {
    return <Navigate to="/" replace />;
  }

  const fields = activeProvider ? PROVIDER_FIELDS[activeProvider as Exclude<NotificationProvider, "">] : [];

  return (
    <div className="max-w-sm space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Admin settings</h1>
        <p className="text-sm text-muted-foreground">Instance-wide, not scoped to one household.</p>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Invite a Head of Household</h2>
        <p className="text-sm text-muted-foreground">
          They&apos;ll get their own independent household on this instance — separate from yours, with no
          shared visibility either way.
        </p>
        <InviteEmailForm
          onSubmit={(email) => {
            setInviteNotice(null);
            createInviteMutation.mutate(email);
          }}
          pending={createInviteMutation.isPending}
          error={inviteError}
          submitLabel="Invite"
        />
        {inviteNotice && <p className="text-sm text-muted-foreground">{inviteNotice}</p>}
        <InviteList
          invites={hohInvitesQuery.data?.invites ?? []}
          onRevoke={(id) => revokeInviteMutation.mutate(id)}
          revokingId={revokingInviteId}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Get pinged here when someone accepts an invite. SMTP for sending invites itself is
          configured via environment variables, not here — see .env.example.
        </p>

        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Channel</span>
          <select
            value={activeProvider}
            onChange={(e) => {
              setProvider(e.target.value as NotificationProvider);
              setConfig({});
            }}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {fields.map((field) => (
          <label key={field.key} className="block space-y-1 text-sm">
            <span className="text-muted-foreground">
              {field.label}
              {field.optional && " (optional)"}
            </span>
            <input
              type="text"
              value={activeConfig[field.key] ?? ""}
              onChange={(e) => {
                setProvider(activeProvider);
                setConfig({ ...activeConfig, [field.key]: e.target.value });
              }}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
        ))}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ provider: activeProvider, config: activeConfig })}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={!settingsQuery.data?.provider || testMutation.isPending}
            onClick={() => {
              setTestResult(null);
              testMutation.mutate();
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Send test notification
          </button>
        </div>

        {testResult && <p className="text-sm text-muted-foreground">{testResult}</p>}
      </div>
    </div>
  );
}
