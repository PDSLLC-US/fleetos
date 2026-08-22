"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MaintenanceRecord = {
  id: string;
  company_id?: string | null;
  truck_id?: string | null;
  trailer_id?: string | null;
  service_date?: string | null;
  service_type?: string | null;
  description?: string | null;
  mileage?: number | null;
  cost?: number | null;
  vendor_name?: string | null;
  next_service_mileage?: number | null;
  next_service_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  trucks?: { truck_number?: string | null }[];
  trailers?: { trailer_number?: string | null }[];
};

type TruckOption = { id: string; truck_number?: string | null };
type TrailerOption = { id: string; trailer_number?: string | null };

const SERVICE_TYPES = [
  "Oil Change",
  "Tires",
  "Brakes",
  "Engine",
  "Transmission",
  "Preventive Maintenance",
  "Inspection",
  "Electrical",
  "Suspension",
  "Cooling System",
  "Repair",
  "Other",
];

export default function MaintenancePage() {
  const supabase = createClient();

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [trailers, setTrailers] = useState<TrailerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<MaintenanceRecord>>({
    service_type: "",
    service_date: null,
    truck_id: null,
    trailer_id: null,
    description: "",
    mileage: null,
    cost: null,
    vendor_name: "",
    next_service_mileage: null,
    next_service_date: null,
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [recRes, truckRes, trailerRes] = await Promise.all([
        supabase
          .from("maintenance_records")
          .select(`
            *,
            trucks ( truck_number ),
            trailers ( trailer_number )
          `)
          .order("service_date", { ascending: false }),
        supabase.from("trucks").select("id,truck_number").order("truck_number", { ascending: true }),
        supabase.from("trailers").select("id,trailer_number").order("trailer_number", { ascending: true }),
      ]);

      if (recRes.error) {
        console.error("Failed to load maintenance records", recRes.error);
        setError("Failed to load maintenance records.");
        setRecords([]);
      } else {
        setRecords((recRes.data as MaintenanceRecord[]) ?? []);
      }

      if (truckRes.error) {
        console.error("Failed to load trucks", truckRes.error);
        setTrucks([]);
      } else {
        setTrucks((truckRes.data as TruckOption[]) ?? []);
      }

      if (trailerRes.error) {
        console.error("Failed to load trailers", trailerRes.error);
        setTrailers([]);
      } else {
        setTrailers((trailerRes.data as TrailerOption[]) ?? []);
      }
    } catch (err) {
      console.error("Unexpected load error", err);
      setError("Failed to load maintenance data.");
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setForm({
      service_type: "",
      service_date: null,
      truck_id: null,
      trailer_id: null,
      description: "",
      mileage: null,
      cost: null,
      vendor_name: "",
      next_service_mileage: null,
      next_service_date: null,
      notes: "",
    });
    setEditingId(null);
  }

  function openAdd() {
    clearForm();
    setPanelOpen(true);
  }

  function openEdit(r: MaintenanceRecord) {
    setForm({
      service_date: r.service_date ?? null,
      service_type: r.service_type ?? "",
      description: r.description ?? "",
      mileage: r.mileage ?? null,
      cost: r.cost ?? null,
      vendor_name: r.vendor_name ?? "",
      next_service_mileage: r.next_service_mileage ?? null,
      next_service_date: r.next_service_date ?? null,
      notes: r.notes ?? "",
      truck_id: r.truck_id ?? null,
      trailer_id: r.trailer_id ?? null,
    });
    setEditingId(r.id);
    setPanelOpen(true);
  }

  function formatCurrency(value?: number | null) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value ?? 0));
  }

  function formatNumber(value?: number | null) {
    if (value == null) return "—";
    return new Intl.NumberFormat("en-US").format(value);
  }

  function daysUntil(dateStr?: string | null) {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = d.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const summary = useMemo(() => {
    const totalCost = records.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const serviceCount = records.length;
    const dueSoon = records.filter((r) => {
      if (!r.next_service_date) return false;
      const days = daysUntil(r.next_service_date);
      return days >= 0 && days <= 30;
    }).length;
    const overdue = records.filter((r) => r.next_service_date && daysUntil(r.next_service_date) < 0).length;
    return { totalCost, serviceCount, dueSoon, overdue };
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (equipmentFilter === "Trucks" && !r.truck_id) return false;
      if (equipmentFilter === "Trailers" && !r.trailer_id) return false;

      if (statusFilter === "Due Soon" && !(r.next_service_date && daysUntil(r.next_service_date) >= 0 && daysUntil(r.next_service_date) <= 30)) return false;
      if (statusFilter === "Overdue" && !(r.next_service_date && daysUntil(r.next_service_date) < 0)) return false;
      if (statusFilter === "Scheduled" && !(r.next_service_date && daysUntil(r.next_service_date) > 30)) return false;
      if (statusFilter === "No Schedule" && r.next_service_date) return false;

      if (!q) return true;
      const truckNum = (r.trucks?.[0]?.truck_number ?? "").toLowerCase();
      const trailerNum = (r.trailers?.[0]?.trailer_number ?? "").toLowerCase();
      return (
        (r.service_type ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.vendor_name ?? "").toLowerCase().includes(q) ||
        truckNum.includes(q) ||
        trailerNum.includes(q)
      );
    });
  }, [records, search, equipmentFilter, statusFilter]);

  async function saveRecord() {
    setError(null);
    if (!form.service_type || !form.service_date) {
      setError("Service Date and Service Type are required.");
      return;
    }
    if (!form.truck_id && !form.trailer_id) {
      setError("Select a truck or a trailer.");
      return;
    }

    setSaving(true);
    try {
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
        service_date: form.service_date,
        service_type: form.service_type,
        description: form.description ?? null,
        mileage: form.mileage ? Number(form.mileage) : null,
        cost: form.cost ? Number(form.cost) : null,
        vendor_name: form.vendor_name ?? null,
        next_service_mileage: form.next_service_mileage ? Number(form.next_service_mileage) : null,
        next_service_date: form.next_service_date ?? null,
        notes: form.notes ?? null,
      };

      if (form.truck_id) payload.truck_id = form.truck_id;
      else payload.truck_id = null;

      if (form.trailer_id) payload.trailer_id = form.trailer_id;
      else payload.trailer_id = null;

      if (editingId) {
        const res = await supabase.from("maintenance_records").update(payload).eq("id", editingId);
        if (res.error) {
          console.error("Failed to update maintenance record", res.error);
          setError("Failed to update record.");
        } else {
          setSuccessMsg("Record updated.");
          setPanelOpen(false);
          clearForm();
          await loadAll();
        }
      } else {
        payload.company_id = company_id;
        const res = await supabase.from("maintenance_records").insert(payload).select();
        if (res.error) {
          console.error("Failed to insert maintenance record", res.error);
          setError("Failed to add record.");
        } else {
          setSuccessMsg("Record added.");
          setPanelOpen(false);
          clearForm();
          await loadAll();
        }
      }
    } catch (err) {
      console.error("Unexpected save error", err);
      setError("Failed to save record.");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm("Are you sure you want to delete this maintenance record?")) return;
    try {
      const res = await supabase.from("maintenance_records").delete().eq("id", id);
      if (res.error) {
        console.error("Failed to delete maintenance record", res.error);
        setError("Failed to delete record.");
      } else {
        setSuccessMsg("Record deleted.");
        await loadAll();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Unexpected delete error", err);
      setError("Failed to delete record.");
    }
  }

  function prettyEquipment(r: MaintenanceRecord) {
    const t = r.trucks?.[0]?.truck_number;
    const tr = r.trailers?.[0]?.trailer_number;
    if (t) return `Truck ${t}`;
    if (tr) return `Trailer ${tr}`;
    return "—";
  }

  function statusBadge(r: MaintenanceRecord) {
    if (!r.next_service_date) return { label: "No Schedule", cls: "bg-slate-100 text-slate-700" };
    const days = daysUntil(r.next_service_date);
    if (days < 0) return { label: "Overdue", cls: "bg-rose-50 text-rose-700" };
    if (days <= 30) return { label: "Due Soon", cls: "bg-amber-50 text-amber-700" };
    return { label: "Scheduled", cls: "bg-emerald-50 text-emerald-700" };
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Maintenance</h1>
            <p className="mt-1 text-sm text-slate-600">Track repairs, preventive maintenance, service costs and upcoming maintenance.</p>
          </div>
          <div className="flex items-center gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search maintenance" className="rounded-2xl border border-slate-200 px-3 py-2" />
            <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2">
              <option>All</option>
              <option>Trucks</option>
              <option>Trailers</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-2">
              <option>All</option>
              <option>Due Soon</option>
              <option>Overdue</option>
              <option>Scheduled</option>
              <option>No Schedule</option>
            </select>
            <button onClick={openAdd} className="rounded-2xl bg-slate-950 px-4 py-2 text-white">+ Add Maintenance</button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Total Maintenance Cost</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(summary.totalCost)}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Service Records</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.serviceCount}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Due Soon</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.dueSoon}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <p className="text-sm text-slate-500">Overdue</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.overdue}</p>
          </div>
        </div>

        <div className="mt-6">
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div> : null}
          {successMsg ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{successMsg}</div> : null}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-4 pr-6">Service Date</th>
                <th className="py-4 pr-6">Equipment</th>
                <th className="py-4 pr-6">Service Type</th>
                <th className="py-4 pr-6">Description</th>
                <th className="py-4 pr-6">Mileage</th>
                <th className="py-4 pr-6">Cost</th>
                <th className="py-4 pr-6">Vendor</th>
                <th className="py-4 pr-6">Next Service</th>
                <th className="py-4">Status</th>
                <th className="py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">Loading records…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">No maintenance records found. Add your first service record to get started.</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const status = statusBadge(r);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-4 pr-6 font-medium">{r.service_date ? new Date(r.service_date).toLocaleDateString() : "—"}</td>
                      <td className="py-4 pr-6">{prettyEquipment(r)}</td>
                      <td className="py-4 pr-6">{r.service_type ?? "—"}</td>
                      <td className="py-4 pr-6">{r.description ?? "—"}</td>
                      <td className="py-4 pr-6">{formatNumber(r.mileage)}</td>
                      <td className="py-4 pr-6">{r.cost ? formatCurrency(r.cost) : "—"}</td>
                      <td className="py-4 pr-6">{r.vendor_name ?? "—"}</td>
                      <td className="py-4 pr-6">
                        <div>{r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : "—"}</div>
                        {r.next_service_mileage ? <div className="text-xs text-slate-500">{formatNumber(r.next_service_mileage)} mi</div> : null}
                      </td>
                      <td className="py-4 pr-6"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span></td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(r)} className="rounded-2xl border px-3 py-1 text-sm">Edit</button>
                          <button onClick={() => deleteRecord(r.id)} className="rounded-2xl border border-rose-200 px-3 py-1 text-sm text-rose-700">Delete</button>
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

      {panelOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setPanelOpen(false)} />
          <div className="w-full max-w-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Maintenance" : "Add Maintenance"}</h2>
              <button onClick={() => setPanelOpen(false)} className="text-slate-500">Close</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm text-slate-600">Equipment Type</label>
                <select value={form.truck_id ? "Truck" : form.trailer_id ? "Trailer" : ""} onChange={(e) => {
                  const v = e.target.value;
                  if (v === "Truck") { setForm({ ...form, truck_id: trucks[0]?.id ?? null, trailer_id: null }); }
                  else if (v === "Trailer") { setForm({ ...form, trailer_id: trailers[0]?.id ?? null, truck_id: null }); }
                  else setForm({ ...form, truck_id: null, trailer_id: null });
                }} className="mt-1 w-full rounded-2xl border px-3 py-2">
                  <option value="">Select equipment</option>
                  <option value="Truck">Truck</option>
                  <option value="Trailer">Trailer</option>
                </select>
              </div>

              {form.trailer_id ? (
                <div>
                  <label className="text-sm text-slate-600">Trailer</label>
                  <select value={form.trailer_id ?? ""} onChange={(e) => setForm({ ...form, trailer_id: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2">
                    <option value="">Select trailer</option>
                    {trailers.map((tr) => (<option key={tr.id} value={tr.id}>{tr.trailer_number}</option>))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-sm text-slate-600">Truck</label>
                  <select value={form.truck_id ?? ""} onChange={(e) => setForm({ ...form, truck_id: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2">
                    <option value="">Select truck</option>
                    {trucks.map((tr) => (<option key={tr.id} value={tr.id}>{tr.truck_number}</option>))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Service Date</label>
                  <input type="date" value={form.service_date ?? ""} onChange={(e) => setForm({ ...form, service_date: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Service Type</label>
                  <select value={form.service_type ?? ""} onChange={(e) => setForm({ ...form, service_type: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2">
                    <option value="">Select type</option>
                    {SERVICE_TYPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600">Description</label>
                <input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Mileage</label>
                  <input type="number" value={form.mileage ?? ""} onChange={(e) => setForm({ ...form, mileage: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Cost</label>
                  <input type="number" step="0.01" value={form.cost ?? ""} onChange={(e) => setForm({ ...form, cost: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Vendor</label>
                  <input value={form.vendor_name ?? ""} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Next Service Mileage</label>
                  <input type="number" value={form.next_service_mileage ?? ""} onChange={(e) => setForm({ ...form, next_service_mileage: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Next Service Date</label>
                  <input type="date" value={form.next_service_date ?? ""} onChange={(e) => setForm({ ...form, next_service_date: e.target.value ?? null })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600">Notes</label>
                <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-2xl border px-3 py-2" />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button onClick={() => { setPanelOpen(false); clearForm(); }} className="rounded-2xl border px-4 py-2">Cancel</button>
                <button onClick={saveRecord} disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-2 text-white">{saving ? "Saving..." : editingId ? "Update" : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
