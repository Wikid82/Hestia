import Link from "next/link";
import { requireActiveUser } from "@/lib/auth/current-user";
import { logout } from "@/lib/actions/auth";
import { switchToPicker } from "@/lib/actions/profile";

const NAV_LINKS = [
  { href: "/", label: "Hub" },
  { href: "/calendar", label: "Calendar" },
  { href: "/chores", label: "Chores" },
  { href: "/rewards", label: "Rewards" },
  { href: "/reminders", label: "Reminders" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { household, user } = await requireActiveUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{household.name}</span>
            <nav className="flex gap-4 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  {link.label}
                </Link>
              ))}
              {user.role === "admin" && (
                <Link
                  href="/household"
                  className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                  Household
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="text-lg">{user.avatarEmoji}</span>
              <span>{user.name}</span>
              <span className="text-neutral-500">· {user.points} pts</span>
            </span>
            <form action={switchToPicker}>
              <button className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
                Switch
              </button>
            </form>
            <form action={logout}>
              <button className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
