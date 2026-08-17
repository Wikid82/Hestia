import { useState } from "react";
import { Navigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMembers } from "@/api/members";
import { createMemberInvite, listMemberInvites, revokeMemberInvite } from "@/api/invites";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { HouseholdName } from "@/components/HouseholdName";
import { MemberCard } from "@/components/MemberCard";
import { ThemePicker } from "@/components/ThemePicker";
import { AddMemberForm } from "@/components/AddMemberForm";
import { InviteEmailForm } from "@/components/InviteEmailForm";
import { InviteList } from "@/components/InviteList";

export default function HouseholdPage() {
  const { profile, household } = useAuth();
  const queryClient = useQueryClient();
  const membersQuery = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const memberInvitesQuery = useQuery({ queryKey: ["member-invites"], queryFn: listMemberInvites });

  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const createInviteMutation = useMutation({
    mutationFn: createMemberInvite,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["member-invites"] });
      setInviteError(null);
      setInviteNotice(res.emailSent ? "Invite sent." : `Invite created, but the email failed to send: ${res.emailError}`);
    },
    onError: (err) => setInviteError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const [revokingInviteId, setRevokingInviteId] = useState<string | undefined>();
  const revokeInviteMutation = useMutation({
    mutationFn: revokeMemberInvite,
    onMutate: (id) => setRevokingInviteId(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-invites"] }),
    onSettled: () => setRevokingInviteId(undefined),
  });

  if (!profile || profile.role !== "hoh") {
    return <Navigate to="/" replace />;
  }
  if (!household) return null;

  const members = membersQuery.data?.members ?? [];

  return (
    <div className="space-y-8">
      <div>
        <HouseholdName name={household.name} />
        <p className="text-sm text-muted-foreground">Manage who&apos;s here.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      <div className="max-w-sm space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Applies to every screen in the household, including shared kiosk displays.
        </p>
        <ThemePicker value={household.themePreference} />
      </div>

      <div className="max-w-sm space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Add a family member</h2>
        <p className="text-sm text-muted-foreground">
          A managed profile with no email or password of its own — switched into from the shared avatar
          picker, optionally PIN-gated. Good for kids who don&apos;t have their own email address yet.
        </p>
        <AddMemberForm />
      </div>

      <div className="max-w-sm space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Invite a member by email</h2>
        <p className="text-sm text-muted-foreground">
          They&apos;ll set their own password and can log in directly, without going through the shared
          avatar picker.
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
          invites={memberInvitesQuery.data?.invites ?? []}
          onRevoke={(id) => revokeInviteMutation.mutate(id)}
          revokingId={revokingInviteId}
        />
      </div>
    </div>
  );
}
