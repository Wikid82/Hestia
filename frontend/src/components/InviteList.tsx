import type { Invite } from "@/types";

const STATUS_LABEL: Record<Invite["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

const STATUS_CLASS: Record<Invite["status"], string> = {
  pending: "text-foreground",
  accepted: "text-muted-foreground",
  revoked: "text-muted-foreground",
  expired: "text-danger",
};

export function InviteList({
  invites,
  onRevoke,
  revokingId,
}: {
  invites: Invite[];
  onRevoke: (id: string) => void;
  revokingId?: string;
}) {
  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground">No invites yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {invites.map((invite) => (
        <li
          key={invite.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
        >
          <span>{invite.email}</span>
          <span className="flex items-center gap-3">
            <span className={STATUS_CLASS[invite.status]}>{STATUS_LABEL[invite.status]}</span>
            {invite.status === "pending" && (
              <button
                type="button"
                onClick={() => onRevoke(invite.id)}
                disabled={revokingId === invite.id}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Revoke
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
