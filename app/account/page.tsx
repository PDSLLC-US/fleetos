"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FleetOSBrand from "@/components/FleetOSBrand";
import { createClient } from "@/lib/supabase/client";
import { getAuthRole, roleLabel, type AuthRoleContext } from "@/lib/auth-role";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const [auth, setAuth] = useState<AuthRoleContext | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    void loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAccount() {
    setLoading(true);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.replace("/login");
        return;
      }
      const authContext = await getAuthRole(supabase);
      if (!authContext) {
        router.replace("/login");
        return;
      }
      setAuth(authContext);
      setEmail(user.email ?? "");
    } catch (err) {
      console.error("Account load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function returnToWorkspace() {
    router.push(auth?.role === "driver" ? "/driver" : "/");
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      console.error("Password update error:", err);
      setPasswordError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      setLoggingOut(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-4xl">Loading My Account...</div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <FleetOSBrand variant="sidebar" />
            <div className="hidden h-12 w-px bg-slate-700 sm:block" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Personal Account</p>
              <h1 className="mt-1 text-lg font-bold text-white">My Account</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={returnToWorkspace} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Return to Workspace</button>
            <button type="button" disabled={loggingOut} onClick={() => void handleLogout()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">{loggingOut ? "Logging out..." : "Logout"}</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-950">Account Information</h2>
            <p className="mt-1 text-sm text-slate-500">Your personal FleetOS login information.</p>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <InfoField label="Email" value={email || "—"} />
            <InfoField label="Role" value={roleLabel(auth?.role)} />
          </div>
        </section>

        <form onSubmit={changePassword} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-950">Security</h2>
            <p className="mt-1 text-sm text-slate-500">Change the password for your own FleetOS account.</p>
          </div>
          <div className="space-y-5 p-6">
            {passwordError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{passwordError}</div>}
            {passwordSuccess && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{passwordSuccess}</div>}
            <PasswordField label="New Password" value={newPassword} placeholder="Minimum 8 characters" disabled={passwordSaving} onChange={(value) => { setNewPassword(value); setPasswordError(""); setPasswordSuccess(""); }} />
            <PasswordField label="Confirm New Password" value={confirmPassword} placeholder="Re-enter your new password" disabled={passwordSaving} onChange={(value) => { setConfirmPassword(value); setPasswordError(""); setPasswordSuccess(""); }} />
            <div className="flex justify-end">
              <button type="submit" disabled={passwordSaving} className="rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{passwordSaving ? "Updating..." : "Update Password"}</button>
            </div>
          </div>
        </form>
        <footer className="border-t border-slate-200 py-5"><FleetOSBrand variant="footer" /></footer>
      </div>
    </main>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 break-words font-semibold text-slate-900">{value}</p></div>;
}

function PasswordField({ label, value, placeholder, disabled, onChange }: { label: string; value: string; placeholder: string; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input type="password" autoComplete="new-password" value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" /></label>;
}
