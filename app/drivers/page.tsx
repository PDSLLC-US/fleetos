"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Driver = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  cdl_number: string | null;
  cdl_state: string | null;
  cdl_expiration: string | null;
  medical_card_expiration: string | null;
  pay_type: "percentage" | "per_mile" | "flat_rate" | "hourly";
  pay_rate: number | null;
  status: "active" | "inactive" | "on_leave";
  hire_date?: string | null;
  notes?: string | null;
};

export default function DriversPage() {
  const supabase = createClient();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cdlNumber, setCdlNumber] = useState("");
  const [cdlState, setCdlState] = useState("");
  const [cdlExpiration, setCdlExpiration] = useState("");
  const [medicalCardExpiration, setMedicalCardExpiration] = useState("");
  const [payType, setPayType] = useState<Driver["pay_type"]>("percentage");
  const [payRate, setPayRate] = useState<string>("");
  const [status, setStatus] = useState<Driver["status"]>("active");
  const [hireDate, setHireDate] = useState("");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Driver["status"]>("all");
  const [successMessage, setSuccessMessage] = useState("");

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setCdlNumber("");
    setCdlState("");
    setCdlExpiration("");
    setMedicalCardExpiration("");
    setPayType("percentage");
    setPayRate("");
    setStatus("active");
    setHireDate("");
    setNotes("");
    setEditingId(null);
    setIsEditing(false);
  }

  async function loadDrivers() {
    try {
      setLoading(true);
      setError("");

      const res = await supabase.from("drivers").select("*").order("last_name", { ascending: true });
      const data = res.data as Driver[] | null;
      const loadErr = res.error;

      if (loadErr) {
        console.error(loadErr);
        setError("Failed to load drivers.");
        setDrivers([]);
        return;
      }

      setDrivers(data ?? []);
    } catch (err) {
      console.error(err);
      setError("Could not load drivers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function withinDays(dateStr?: string | null, days = 30) {
    if (!dateStr) return false;
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return false;
    const now = new Date();
    const diff = dt.getTime() - now.getTime();
    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
  }

  function isExpired(dateStr?: string | null) {
    if (!dateStr) return false;
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return false;
    return dt.getTime() < new Date().getTime();
  }

  function formatPayRate(type: Driver["pay_type"], rate: number | null | undefined) {
    if (rate == null) return "—";
    if (type === "percentage") return `${rate}%`;
    const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(rate);
    if (type === "per_mile") return `${formatted}/mi`;
    if (type === "hourly") return `${formatted}/hr`;
    return formatted; // flat_rate
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) throw new Error("Unable to determine authenticated user.");

      const { data: profile, error: profileErr } = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
      if (profileErr) {
        console.error(profileErr);
        throw new Error("Could not determine company for user.");
      }

      const company_id = (profile as any)?.company_id ?? null;

      const payload: any = {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        cdl_number: cdlNumber || null,
        cdl_state: cdlState || null,
        cdl_expiration: cdlExpiration || null,
        medical_card_expiration: medicalCardExpiration || null,
        pay_type: payType,
        pay_rate: payRate ? Number(payRate) : null,
        status,
        hire_date: hireDate || null,
        notes: notes || null,
      };

      if (!isEditing) {
        const { error: insertErr } = await supabase.from("drivers").insert([{ ...payload, company_id }]);
        if (insertErr) {
          console.error(insertErr);
          throw new Error(insertErr.message || "Failed to insert driver.");
        }
        setSuccessMessage("Driver added.");
      } else {
        const { error: updateErr } = await supabase.from("drivers").update(payload).eq("id", editingId);
        if (updateErr) {
          console.error(updateErr);
          throw new Error(updateErr.message || "Failed to update driver.");
        }
        setSuccessMessage("Driver updated.");
      }

      resetForm();
      setShowForm(false);
      await loadDrivers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  function openEditor(d: Driver) {
    setIsEditing(true);
    setEditingId(d.id);
    setFirstName(d.first_name || "");
    setLastName(d.last_name || "");
    setPhone(d.phone ?? "");
    setEmail(d.email ?? "");
    setCdlNumber(d.cdl_number ?? "");
    setCdlState(d.cdl_state ?? "");
    setCdlExpiration(d.cdl_expiration ?? "");
    setMedicalCardExpiration(d.medical_card_expiration ?? "");
    setPayType(d.pay_type);
    setPayRate(d.pay_rate != null ? String(d.pay_rate) : "");
    setStatus(d.status);
    setHireDate(d.hire_date ?? "");
    setNotes(d.notes ?? "");
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this driver?")) return;
    try {
      setLoading(true);
      const { error: delErr } = await supabase.from("drivers").delete().eq("id", id);
      if (delErr) {
        console.error(delErr);
        setError("Failed to delete driver.");
      } else {
        setSuccessMessage("Driver deleted.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
      await loadDrivers();
    } catch (err) {
      console.error(err);
      setError("Failed to delete driver.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = drivers.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.first_name.toLowerCase().includes(q) ||
      d.last_name.toLowerCase().includes(q) ||
      (d.phone || "").toLowerCase().includes(q) ||
      (d.email || "").toLowerCase().includes(q) ||
      (d.cdl_number || "").toLowerCase().includes(q)
    );
  });

  const totals = {
    total: drivers.length,
    active: drivers.filter((d) => d.status === "active").length,
    on_leave: drivers.filter((d) => d.status === "on_leave").length,
    inactive: drivers.filter((d) => d.status === "inactive").length,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Drivers</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Drivers</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Manage drivers, pay rates, CDL information and compliance dates.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <input placeholder="Search first, last, phone, email, CDL" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm" />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>

            <button onClick={() => { resetForm(); setShowForm((s) => !s); }} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">+ Add Driver</button>
          </div>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {successMessage && <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total Drivers</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.total}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.active}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">On Leave</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.on_leave}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Inactive</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.inactive}</p>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">{isEditing ? "Edit Driver" : "Add Driver"}</h2>
              <div>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="rounded-2xl bg-slate-100 px-3 py-1 text-sm">Cancel</button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={cdlNumber} onChange={(e) => setCdlNumber(e.target.value)} placeholder="CDL Number" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={cdlState} onChange={(e) => setCdlState(e.target.value)} placeholder="CDL State" className="rounded-xl border border-slate-300 px-4 py-3" />

              <div>
                <label className="mb-2 block text-sm text-slate-600">CDL Expiration</label>
                <input type="date" value={cdlExpiration} onChange={(e) => setCdlExpiration(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-600">Medical Card Expiration</label>
                <input type="date" value={medicalCardExpiration} onChange={(e) => setMedicalCardExpiration(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>

              <select value={payType} onChange={(e) => setPayType(e.target.value as any)} className="rounded-xl border border-slate-300 px-4 py-3">
                <option value="percentage">percentage</option>
                <option value="per_mile">per_mile</option>
                <option value="flat_rate">flat_rate</option>
                <option value="hourly">hourly</option>
              </select>

              <input type="number" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} placeholder="Pay Rate" className="rounded-xl border border-slate-300 px-4 py-3" />

              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-xl border border-slate-300 px-4 py-3">
                <option value="active">active</option>
                <option value="on_leave">on_leave</option>
                <option value="inactive">inactive</option>
              </select>

              <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" />

              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="col-span-full rounded-xl border border-slate-300 px-4 py-3" rows={3} />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button disabled={saving} type="submit" className="rounded-2xl bg-slate-950 px-6 py-2 text-sm font-semibold text-white">{saving ? "Saving..." : isEditing ? "Update Driver" : "Save Driver"}</button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-950">Driver Roster</h2>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">Loading drivers...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-slate-500">No drivers found. Add your first driver to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-4 pr-6">Name</th>
                    <th className="py-4 pr-6">Phone</th>
                    <th className="py-4 pr-6">Email</th>
                    <th className="py-4 pr-6">CDL #</th>
                    <th className="py-4 pr-6">CDL State</th>
                    <th className="py-4 pr-6">CDL Exp</th>
                    <th className="py-4 pr-6">Medical Card</th>
                    <th className="py-4 pr-6">Pay Type</th>
                    <th className="py-4 pr-6">Pay Rate</th>
                    <th className="py-4">Status</th>
                    <th className="py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-4 pr-6 font-medium">{d.first_name} {d.last_name}</td>
                      <td className="py-4 pr-6">{d.phone || '—'}</td>
                      <td className="py-4 pr-6">{d.email || '—'}</td>
                      <td className="py-4 pr-6">{d.cdl_number || '—'}</td>
                      <td className="py-4 pr-6">{d.cdl_state || '—'}</td>
                      <td className="py-4 pr-6"><span className={`${isExpired(d.cdl_expiration) ? 'text-rose-600 font-semibold' : withinDays(d.cdl_expiration) ? 'text-amber-600 font-semibold' : 'text-slate-700'}`}>{d.cdl_expiration ? new Date(d.cdl_expiration).toLocaleDateString() : '—'}</span></td>
                      <td className="py-4 pr-6"><span className={`${isExpired(d.medical_card_expiration) ? 'text-rose-600 font-semibold' : withinDays(d.medical_card_expiration) ? 'text-amber-600 font-semibold' : 'text-slate-700'}`}>{d.medical_card_expiration ? new Date(d.medical_card_expiration).toLocaleDateString() : '—'}</span></td>
                      <td className="py-4 pr-6">{d.pay_type}</td>
                      <td className="py-4 pr-6 font-medium">{formatPayRate(d.pay_type, d.pay_rate ?? null)}</td>
                      <td className="py-4 pr-6"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${d.status === 'active' ? 'bg-emerald-100 text-emerald-700' : d.status === 'on_leave' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{d.status}</span></td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditor(d)} className="rounded-2xl bg-slate-100 px-3 py-1 text-sm">Edit</button>
                          <button onClick={() => handleDelete(d.id)} className="rounded-2xl bg-rose-50 px-3 py-1 text-sm text-rose-600">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}