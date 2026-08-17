import { Navigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { listMembers } from "@/api/members";
import { useAuth } from "@/context/AuthContext";
import { HouseholdName } from "@/components/HouseholdName";
import { MemberCard } from "@/components/MemberCard";
import { ThemePicker } from "@/components/ThemePicker";
import { AddMemberForm } from "@/components/AddMemberForm";

export default function HouseholdPage() {
  const { profile, household } = useAuth();
  const membersQuery = useQuery({ queryKey: ["members"], queryFn: listMembers });

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
        <AddMemberForm />
      </div>
    </div>
  );
}
