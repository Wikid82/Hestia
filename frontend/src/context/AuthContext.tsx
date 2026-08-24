import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "@/api/auth";
import * as profilesApi from "@/api/profiles";
import * as invitesApi from "@/api/invites";
import type { Household, Profile } from "@/types";

type Status = "loading" | "unauthenticated" | "need-profile" | "authed";

type AuthState = {
  status: Status;
  household: Household | null;
  profile: Profile | null;
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  login: (input: authApi.LoginInput) => Promise<void>;
  signup: (input: authApi.SignupInput) => Promise<void>;
  acceptInvite: (token: string, input: invitesApi.AcceptInviteInput) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (userId: string, pin?: string) => Promise<void>;
  switchToPicker: () => Promise<void>;
  setHousehold: (household: Household) => void;
  setProfile: (profile: Profile) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    household: null,
    profile: null,
  });

  // GET /auth/me reports the full session state in one call: 401 means no
  // household session at all, 200 with user:null means a household
  // session but no profile picked yet, 200 with user set means fully
  // authed. No client-side caching needed.
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const { household, user } = await authApi.me();
      setState({ status: user ? "authed" : "need-profile", household, profile: user });
    } catch {
      setState({ status: "unauthenticated", household: null, profile: null });
    }
  }, []);

  useEffect(() => {
    // refresh's synchronous setState (loading) is intentional; it's how we
    // kick off the initial session check on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (input: authApi.LoginInput) => {
      await authApi.login(input);
      await refresh();
    },
    [refresh],
  );

  const signup = useCallback(async (input: authApi.SignupInput) => {
    const { household, user } = await authApi.signup(input);
    setState({ status: "authed", household, profile: user });
  }, []);

  const acceptInvite = useCallback(async (token: string, input: invitesApi.AcceptInviteInput) => {
    const { household, user } = await invitesApi.acceptInvite(token, input);
    setState({ status: "authed", household, profile: user });
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({ status: "unauthenticated", household: null, profile: null });
  }, []);

  const switchProfile = useCallback(async (userId: string, pin?: string) => {
    const { user } = await profilesApi.switchProfile(userId, pin);
    setState((s) => ({ status: "authed", household: s.household, profile: user }));
  }, []);

  const switchToPicker = useCallback(async () => {
    await profilesApi.switchToPicker();
    setState((s) => ({ status: "need-profile", household: s.household, profile: null }));
  }, []);

  const setHousehold = useCallback((household: Household) => {
    setState((s) => ({ ...s, household }));
  }, []);

  const setProfile = useCallback((profile: Profile) => {
    setState((s) => ({ ...s, profile }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refresh,
      login,
      signup,
      acceptInvite,
      logout,
      switchProfile,
      switchToPicker,
      setHousehold,
      setProfile,
    }),
    [
      state,
      refresh,
      login,
      signup,
      acceptInvite,
      logout,
      switchProfile,
      switchToPicker,
      setHousehold,
      setProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
