import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import AppShell from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import SwitchProfilePage from "@/pages/SwitchProfilePage";
import HubPage from "@/pages/HubPage";
import ChoresPage from "@/pages/ChoresPage";
import CalendarPage from "@/pages/CalendarPage";
import HouseholdPage from "@/pages/HouseholdPage";
import RemindersPage from "@/pages/RemindersPage";
import RewardsPage from "@/pages/RewardsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function ThemeEffect() {
  const { household } = useAuth();
  useEffect(() => {
    const pref = household?.themePreference ?? "system";
    if (pref === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", pref);
    }
  }, [household?.themePreference]);
  return null;
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (status === "authed") return <Navigate to="/" replace />;
  if (status === "need-profile") return <Navigate to="/switch-profile" replace />;
  return <>{children}</>;
}

function NeedProfileRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "authed") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  useRealtime(status === "authed");

  if (status === "loading") return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  if (status === "need-profile") return <Navigate to="/switch-profile" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/switch-profile"
        element={
          <NeedProfileRoute>
            <SwitchProfilePage />
          </NeedProfileRoute>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HubPage />} />
        <Route path="/chores" element={<ChoresPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/household" element={<HouseholdPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeEffect />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
