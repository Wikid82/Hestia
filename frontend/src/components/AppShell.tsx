import { NavLink, Outlet } from "react-router";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { to: "/", label: "Hub", end: true },
  { to: "/calendar", label: "Calendar" },
  { to: "/chores", label: "Chores" },
  { to: "/rewards", label: "Rewards" },
  { to: "/reminders", label: "Reminders" },
];

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "text-foreground font-medium"
    : "text-muted-foreground hover:text-foreground";
}

export default function AppShell() {
  const { household, profile, logout, switchToPicker } = useAuth();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{household?.name}</span>
            <nav className="flex gap-4 text-sm">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                  {link.label}
                </NavLink>
              ))}
              {profile?.role === "hoh" && (
                <NavLink to="/household" className={navClass}>
                  Household
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="text-lg">{profile?.avatarEmoji}</span>
              <span>{profile?.name}</span>
              <span className="text-muted-foreground">· {profile?.points} pts</span>
            </span>
            <button
              onClick={() => switchToPicker()}
              className="text-muted-foreground hover:text-foreground"
            >
              Switch
            </button>
            <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
