import { AuthProvider } from "@refinedev/core";
import { getUserProfile, getToken, signIn, signOut, UserRole } from "./auth";

function redirectForRole(role: UserRole | undefined): string {
  if (role === "cocinero") return "/kitchen";
  if (role === "cajero") return "/pos";
  return "/login";
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      await signIn(email, password);
      return { success: true, redirectTo: "/dashboard" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credenciales incorrectas";
      return { success: false, error: { message, name: "Login failed" } };
    }
  },

  logout: async () => {
    await signOut();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = await getToken();
    if (!token) {
      return { authenticated: false, redirectTo: "/login" };
    }

    const profile = await getUserProfile();
    if (profile?.role !== "admin") {
      return { authenticated: false, redirectTo: redirectForRole(profile?.role) };
    }

    return { authenticated: true };
  },

  getPermissions: async () => {
    const profile = await getUserProfile();
    return profile?.role ?? null;
  },

  getIdentity: async () => {
    const profile = await getUserProfile();
    if (!profile) return null;

    return {
      id: profile.id,
      name: profile.full_name ?? profile.email,
      role: profile.role,
      branch_id: profile.branch_id,
      avatar: null,
    };
  },

  onError: async (error) => {
    if (error?.status === 401) {
      return { logout: true };
    }
    return { error };
  },
};
