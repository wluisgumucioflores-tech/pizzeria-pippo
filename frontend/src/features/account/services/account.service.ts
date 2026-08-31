import { nestFetch } from "@/lib/nestFetch";

export const AccountService = {
  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch("/auth/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error };
    }
    return { ok: true };
  },
};
