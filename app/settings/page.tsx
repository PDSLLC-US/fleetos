"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CompanySettings = {
  id: string;
  name: string;
  legal_name: string | null;
  mc_number: string | null;
  dot_number: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  invoice_name: string | null;
  invoice_email: string | null;
  payment_terms: number | null;
  invoice_notes: string | null;
};

type FormState = {
  name: string;
  legal_name: string;
  mc_number: string;
  dot_number: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  invoice_name: string;
  invoice_email: string;
  payment_terms: string;
  invoice_notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  legal_name: "",
  mc_number: "",
  dot_number: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "USA",
  invoice_name: "",
  invoice_email: "",
  payment_terms: "30",
  invoice_notes: "",
};

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [role, setRole] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/company/settings", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load company settings."
        );
      }

      const company: CompanySettings = data.company;

      setRole(data.role ?? "");
      setCanEdit(Boolean(data.canEdit));

      setForm({
        name: company.name ?? "",
        legal_name: company.legal_name ?? "",
        mc_number: company.mc_number ?? "",
        dot_number: company.dot_number ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        website: company.website ?? "",
        address: company.address ?? "",
        city: company.city ?? "",
        state: company.state ?? "",
        zip_code: company.zip_code ?? "",
        country: company.country ?? "USA",
        invoice_name: company.invoice_name ?? "",
        invoice_email: company.invoice_email ?? "",
        payment_terms: String(company.payment_terms ?? 30),
        invoice_notes: company.invoice_notes ?? "",
      });
    } catch (err) {
      console.error("Settings load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load company settings."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(
    field: keyof FormState,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setSuccess("");
  }

  async function saveSettings(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canEdit) {
      setError(
        "You do not have permission to edit company settings."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/company/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          payment_terms: Number(form.payment_terms),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save company settings."
        );
      }

      setSuccess("Company settings saved successfully.");

      const company: CompanySettings = data.company;

      setForm({
        name: company.name ?? "",
        legal_name: company.legal_name ?? "",
        mc_number: company.mc_number ?? "",
        dot_number: company.dot_number ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        website: company.website ?? "",
        address: company.address ?? "",
        city: company.city ?? "",
        state: company.state ?? "",
        zip_code: company.zip_code ?? "",
        country: company.country ?? "USA",
        invoice_name: company.invoice_name ?? "",
        invoice_email: company.invoice_email ?? "",
        payment_terms: String(company.payment_terms ?? 30),
        invoice_notes: company.invoice_notes ?? "",
      });
    } catch (err) {
      console.error("Settings save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save company settings."
      );
    } finally {
      setSaving(false);
    }
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
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated successfully.");
    } catch (err) {
      console.error("Password update error:", err);
      setPasswordError(
        err instanceof Error ? err.message : "Unable to update password."
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-slate-500">
            Loading company settings...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-600">
            FleetOS
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Company Settings
          </h1>

          <p className="mt-2 text-slate-500">
            Manage your carrier profile, business information and
            invoice defaults.
          </p>

          <div className="mt-3">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
              {role.replaceAll("_", " ")}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {success}
          </div>
        )}

        {!canEdit && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            You can view these settings, but only the company Owner
            or Administrator can make changes.
          </div>
        )}

        <form onSubmit={saveSettings} className="space-y-6">
          <Section
            title="Company Information"
            description="Basic information about your trucking company."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                label="Company Name *"
                value={form.name}
                disabled={!canEdit}
                onChange={(value) => updateField("name", value)}
              />

              <InputField
                label="Legal Business Name"
                value={form.legal_name}
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("legal_name", value)
                }
              />

              <InputField
                label="Company Email"
                type="email"
                value={form.email}
                disabled={!canEdit}
                onChange={(value) => updateField("email", value)}
              />

              <InputField
                label="Phone Number"
                value={form.phone}
                disabled={!canEdit}
                onChange={(value) => updateField("phone", value)}
              />

              <div className="md:col-span-2">
                <InputField
                  label="Website"
                  value={form.website}
                  placeholder="https://yourcompany.com"
                  disabled={!canEdit}
                  onChange={(value) =>
                    updateField("website", value)
                  }
                />
              </div>
            </div>
          </Section>

          <Section
            title="Carrier Information"
            description="Federal motor carrier identifiers used by your operation."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                label="MC Number"
                value={form.mc_number}
                placeholder="MC123456"
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("mc_number", value)
                }
              />

              <InputField
                label="USDOT Number"
                value={form.dot_number}
                placeholder="1234567"
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("dot_number", value)
                }
              />
            </div>
          </Section>

          <Section
            title="Business Address"
            description="Primary company mailing and business address."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <InputField
                  label="Street Address"
                  value={form.address}
                  disabled={!canEdit}
                  onChange={(value) =>
                    updateField("address", value)
                  }
                />
              </div>

              <InputField
                label="City"
                value={form.city}
                disabled={!canEdit}
                onChange={(value) => updateField("city", value)}
              />

              <InputField
                label="State"
                value={form.state}
                disabled={!canEdit}
                onChange={(value) => updateField("state", value)}
              />

              <InputField
                label="ZIP Code"
                value={form.zip_code}
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("zip_code", value)
                }
              />

              <InputField
                label="Country"
                value={form.country}
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("country", value)
                }
              />
            </div>
          </Section>

          <Section
            title="Billing & Invoices"
            description="Defaults that FleetOS can use when generating invoices."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                label="Invoice Company Name"
                value={form.invoice_name}
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("invoice_name", value)
                }
              />

              <InputField
                label="Invoice Email"
                type="email"
                value={form.invoice_email}
                disabled={!canEdit}
                onChange={(value) =>
                  updateField("invoice_email", value)
                }
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Terms
                </label>

                <select
                  value={form.payment_terms}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateField(
                      "payment_terms",
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="0">Due on Receipt</option>
                  <option value="7">Net 7</option>
                  <option value="15">Net 15</option>
                  <option value="30">Net 30</option>
                  <option value="45">Net 45</option>
                  <option value="60">Net 60</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Default Invoice Notes
                </label>

                <textarea
                  rows={5}
                  value={form.invoice_notes}
                  disabled={!canEdit}
                  onChange={(event) =>
                    updateField(
                      "invoice_notes",
                      event.target.value
                    )
                  }
                  placeholder="Thank you for your business."
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
            </div>
          </Section>

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </form>

        <form onSubmit={changePassword} className="mt-6">
          <Section
            title="Security"
            description="Change the password for your own FleetOS account."
          >
            <div className="max-w-2xl space-y-5">
              {passwordError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                  {passwordSuccess}
                </div>
              )}

              <InputField
                label="New Password"
                type="password"
                value={newPassword}
                disabled={passwordSaving}
                placeholder="Minimum 8 characters"
                onChange={(value) => {
                  setNewPassword(value);
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
              />

              <InputField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                disabled={passwordSaving}
                placeholder="Re-enter your new password"
                onChange={(value) => {
                  setConfirmPassword(value);
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </Section>
        </form>
      </div>
    </main>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-bold text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </div>
  );
}