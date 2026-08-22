"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Trailer = {
  id: string;
  company_id?: string | null;
  trailer_number: string | null;
  trailer_type: string | null;
  year: string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  license_plate: string | null;
  license_state: string | null;
  status: "active" | "available" | "maintenance" | "inactive" | string | null;
  registration_expiration: string | null;
  inspection_expiration: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

const TRAILER_TYPES = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Stepdeck",
  "Conestoga",
  "Car Hauler",
  "Dump",
  "Tanker",
  "Other",
];

const STATUS_VALUES = ["active", "available", "maintenance", "inactive"];

export default function TrailersPage() {
  const supabase = createClient();

  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const emptyForm: Partial<Trailer> = {
    trailer_number: "",
    trailer_type: "",
    year: "",
    make: "",
    model: "",
    vin: "",
    license_plate: "",
    license_state: "",
    status: "active",
    registration_expiration: null,
    inspection_expiration: null,
    notes: "",
  };

  const [form, setForm] = useState<Partial<Trailer>>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadTrailers();
  }, []);

  async function loadTrailers() {
    setLoading(true);
    setError(null);
    try {
      const res = await supabase.from("trailers").select("*").order("trailer_number", { ascending: true });
      if (res.error) {
        console.error("Failed to load trailers", res.error);
        setError("Failed to load trailers.");
        setTrailers([]);
      } else {
        setTrailers((res.data as Trailer[]) ?? []);
      }
    } catch (err) {
      console.error("Unexpected error loading trailers", err);
      setError("Failed to load trailers.");
      setTrailers([]);
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function openAdd() {
    clearForm();
    setPanelOpen(true);
  }

  function openEdit(trailer: Trailer) {
    setForm({
      trailer_number: trailer.trailer_number ?? "",
      trailer_type: trailer.trailer_type ?? "",
      year: trailer.year ?? "",
      make: trailer.make ?? "",
      model: trailer.model ?? "",
      vin: trailer.vin ?? "",
      license_plate: trailer.license_plate ?? "",
      license_state: trailer.license_state ?? "",
      status: trailer.status ?? "active",
      registration_expiration: trailer.registration_expiration ?? null,
      inspection_expiration: trailer.inspection_expiration ?? null,
      notes: trailer.notes ?? "",
    });
    setEditingId(trailer.id);
    setPanelOpen(true);
  }

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  function daysUntil(dateStr: string | null | undefined) {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.setHours(0, 0, 0, 0);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function statusBadge(status: string | null | undefined) {
    const s = status ?? "inactive";
    if (s === "active") return "bg-emerald-100 text-emerald-700";
    if (s === "available") return "bg-sky-100 text-sky-700";
    if (s === "maintenance") return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-700";
  }

  async function saveTrailer() {
    if (!form.trailer_number || form.trailer_number.trim() === "") {
      setError("Trailer Number is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // get user and company_id
      const userRes = await supabase.auth.getUser();
      const user = userRes.data?.user;
      if (!user) {
        setError("Not authenticated.");
        setSaving(false);
        return;
      }
      const profile = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
      const company_id = (profile.data as any)?.company_id ?? null;

      const payload: any = {
        trailer_number: form.trailer_number,
        trailer_type: form.trailer_type,
        year: form.year,
        make: form.make,
        model: form.model,
        vin: form.vin,
        license_plate: form.license_plate,
        license_state: form.license_state,
        status: form.status,
        registration_expiration: form.registration_expiration,
        inspection_expiration: form.inspection_expiration,
        notes: form.notes,
      };

      if (editingId) {
        const res = await supabase.from("trailers").update(payload).eq("id", editingId);
        if (res.error) {
          console.error("Failed to update trailer", res.error);
          setError("Failed to update trailer.");
        } else {
          setSuccessMessage("Trailer updated.");
          setPanelOpen(false);
          clearForm();
          await loadTrailers();
        }
      } else {
        payload.company_id = company_id;
        const res = await supabase.from("trailers").insert(payload).select();
        if (res.error) {
          console.error("Failed to insert trailer", res.error);
          setError("Failed to add trailer.");
        } else {
          setSuccessMessage("Trailer added.");
          setPanelOpen(false);
          clearForm();
          await loadTrailers();
        }
      }
    } catch (err) {
      console.error("Unexpected save error", err);
      setError("Failed to save trailer.");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }

  async function deleteTrailer(id: string) {
    if (!confirm("Are you sure you want to delete this trailer?")) return;
    try {
      const res = await supabase.from("trailers").delete().eq("id", id);
      if (res.error) {
        console.error("Failed to delete trailer", res.error);
        setError("Failed to delete trailer.");
      } else {
        setSuccessMessage("Trailer deleted.");
        await loadTrailers();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Unexpected delete error", err);
      setError("Failed to delete trailer.");
    }
  }

  const filtered = trailers.filter((t) => {
    const q = search.trim().toLowerCase();
    if (statusFilter !== "All" && (t.status ?? "") !== statusFilter.toLowerCase()) return false;
    if (!q) return true;
    return (
      (t.trailer_number ?? "").toLowerCase().includes(q) ||
      (t.trailer_type ?? "").toLowerCase().includes(q) ||
      (t.make ?? "").toLowerCase().includes(q) ||
      (t.model ?? "").toLowerCase().includes(q) ||
      (t.vin ?? "").toLowerCase().includes(q) ||
      (t.license_plate ?? "").toLowerCase().includes(q)
    );
  });

  const counts = {
    total: trailers.length,
    active: trailers.filter((t) => (t.status ?? "") === "active").length,
    available: trailers.filter((t) => (t.status ?? "") === "available").length,
    maintenance: trailers.filter((t) => (t.status ?? "") === "maintenance").length,
    inactive: trailers.filter((t) => (t.status ?? "") === "inactive").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Trailers</h1>
            <p className="mt-1 text-sm text-slate-600">Manage trailer equipment, availability, registration and inspection compliance.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trailers" className="rounded-2xl border border-slate-200 px-3 py-2" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2">
              <option>All</option>
              <option>Active</option>
              <option>Available</option>
              <option>Maintenance</option>
              <option>Inactive</option>
            </select>
            <button onClick={openAdd} className="rounded-2xl bg-slate-950 px-4 py-2 text-white">+ Add Trailer</button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-5">
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Total Trailers</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.total}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.active}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Available</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.available}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Maintenance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.maintenance}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Inactive</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{counts.inactive}</p>
          </div>
        </div>

        <div className="mt-6">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div> : null}
          {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{successMessage}</div> : null}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-4 pr-6">Trailer #</th>
                <th className="py-4 pr-6">Type</th>
                <th className="py-4 pr-6">Year</th>
                <th className="py-4 pr-6">Make / Model</th>
                <th className="py-4 pr-6">License Plate</th>
                <th className="py-4 pr-6">Status</th>
                <th className="py-4 pr-6">Registration</th>
                <th className="py-4 pr-6">Inspection</th>
                <th className="py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">Loading trailers…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">No trailers found. Add your first trailer to get started.</td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const regDays = daysUntil(t.registration_expiration);
                  const insDays = daysUntil(t.inspection_expiration);
                  const regClass = regDays < 0 ? "bg-rose-50 text-rose-700" : regDays <= 30 ? "bg-amber-50 text-amber-700" : "";
                  const insClass = insDays < 0 ? "bg-rose-50 text-rose-700" : insDays <= 30 ? "bg-amber-50 text-amber-700" : "";
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-4 pr-6 font-medium">{t.trailer_number ?? "—"}</td>
                      <td className="py-4 pr-6">{t.trailer_type ?? "—"}</td>
                      <td className="py-4 pr-6">{t.year ?? "—"}</td>
                      <td className="py-4 pr-6">{(t.make ?? "") + (t.model ? ` / ${t.model}` : "")}</td>
                      <td className="py-4 pr-6">{t.license_plate ?? "—"} {t.license_state ? <span className="text-slate-400">{t.license_state}</span> : null}</td>
                      <td className="py-4 pr-6"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(t.status)}`}>{t.status ?? "inactive"}</span></td>
                      <td className="py-4 pr-6">
                        <div className={regClass}>{formatDate(t.registration_expiration)}</div>
                        {t.registration_expiration ? <div className="text-xs text-slate-500">{regDays < 0 ? "Expired" : regDays <= 30 ? `${regDays} days` : null}</div> : null}
                      </td>
                      <td className="py-4 pr-6">
                        <div className={insClass}>{formatDate(t.inspection_expiration)}</div>
                        {t.inspection_expiration ? <div className="text-xs text-slate-500">{insDays < 0 ? "Expired" : insDays <= 30 ? `${insDays} days` : null}</div> : null}
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(t)} className="rounded-2xl border px-3 py-1 text-sm">Edit</button>
                          <button onClick={() => deleteTrailer(t.id)} className="rounded-2xl border border-rose-200 px-3 py-1 text-sm text-rose-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel */}
      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setPanelOpen(false)} />
          <div className="w-full max-w-md bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Trailer" : "Add Trailer"}</h2>
              <button onClick={() => setPanelOpen(false)} className="text-slate-500">Close</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-slate-600">Trailer Number *</label>
                <input value={form.trailer_number ?? ""} onChange={(e) => setForm({ ...form, trailer_number: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm text-slate-600">Trailer Type</label>
                <select value={form.trailer_type ?? ""} onChange={(e) => setForm({ ...form, trailer_type: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2">
                  <option value="">Select type</option>
                  {TRAILER_TYPES.map((tt) => (
                    <option key={tt} value={tt}>{tt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Year</label>
                  <input value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Make</label>
                  <input value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-600">Model</label>
                <input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm text-slate-600">VIN</label>
                <input value={form.vin ?? ""} onChange={(e) => setForm({ ...form, vin: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">License Plate</label>
                  <input value={form.license_plate ?? ""} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">License State</label>
                  <input value={form.license_state ?? ""} onChange={(e) => setForm({ ...form, license_state: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-600">Status</label>
                <select value={form.status ?? "active"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2">
                  {STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Registration Expiration</label>
                  <input type="date" value={form.registration_expiration ?? ""} onChange={(e) => setForm({ ...form, registration_expiration: e.target.value ?? null })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Inspection Expiration</label>
                  <input type="date" value={form.inspection_expiration ?? ""} onChange={(e) => setForm({ ...form, inspection_expiration: e.target.value ?? null })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-600">Notes</label>
                <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => { setPanelOpen(false); clearForm(); }} className="rounded-2xl border px-4 py-2">Cancel</button>
                <button onClick={saveTrailer} disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-2 text-white">{saving ? "Saving..." : editingId ? "Update Trailer" : "Create Trailer"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
