"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Truck = {
  id: string;
  truck_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  license_plate: string | null;
  license_state: string | null;
  current_mileage: number | null;
  status: "active" | "available" | "maintenance" | "inactive";
  registration_expiration?: string | null;
  inspection_expiration?: string | null;
  insurance_expiration?: string | null;
  notes?: string | null;
};

export default function TrucksPage() {
  const supabase = createClient();

  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // form fields (kept as individual hooks to preserve simple bindings)
  const [truckNumber, setTruckNumber] = useState("");
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [currentMileage, setCurrentMileage] = useState<string>("");
  const [status, setStatus] = useState<Truck["status"]>("active");
  const [registrationExpiration, setRegistrationExpiration] = useState<string>("");
  const [inspectionExpiration, setInspectionExpiration] = useState<string>("");
  const [insuranceExpiration, setInsuranceExpiration] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Truck["status"]>("all");
  const [successMessage, setSuccessMessage] = useState("");

  function resetForm() {
    setTruckNumber("");
    setYear("");
    setMake("");
    setModel("");
    setVin("");
    setLicensePlate("");
    setLicenseState("");
    setCurrentMileage("");
    setStatus("active");
    setRegistrationExpiration("");
    setInspectionExpiration("");
    setInsuranceExpiration("");
    setNotes("");
    setEditingId(null);
    setIsEditing(false);
  }

  async function loadTrucks() {
    try {
      setLoading(true);
      setError("");

      const res = await supabase
        .from("trucks")
        .select("*")
        .order("truck_number", { ascending: true });

      const data = res.data as Truck[] | null;
      const error = res.error;

      if (error) {
        console.error(error);
        setError("Failed to load trucks.");
        setTrucks([]);
        return;
      }

      setTrucks(data ?? []);
    } catch (err) {
      console.error(err);
      setError("Could not load trucks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrucks();
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

  function formatMileage(value: number | null | undefined) {
    return (value ?? 0).toLocaleString();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // get user
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        throw new Error("Unable to determine authenticated user.");
      }

      // fetch company_id from profiles
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.error(profileErr);
        throw new Error("Could not determine company for user.");
      }

      const company_id = (profile as any)?.company_id ?? null;

      const payload: any = {
        truck_number: truckNumber,
        year: year ? Number(year) : null,
        make: make || null,
        model: model || null,
        vin: vin || null,
        license_plate: licensePlate || null,
        license_state: licenseState || null,
        current_mileage: currentMileage ? Number(currentMileage) : null,
        status,
        registration_expiration: registrationExpiration || null,
        inspection_expiration: inspectionExpiration || null,
        insurance_expiration: insuranceExpiration || null,
        notes: notes || null,
      };

      if (!isEditing) {
        // insert with company_id
        const { data: insertData, error: insertErr } = await supabase
          .from("trucks")
          .insert([{ ...payload, company_id }]);

        if (insertErr) {
          console.error(insertErr);
          throw new Error(insertErr.message || "Failed to insert truck.");
        }

        setSuccessMessage("Truck added.");
      } else {
        // update existing truck (do not modify company_id)
        const { data: updateData, error: updateErr } = await supabase
          .from("trucks")
          .update(payload)
          .eq("id", editingId);

        if (updateErr) {
          console.error(updateErr);
          throw new Error(updateErr.message || "Failed to update truck.");
        }

        setSuccessMessage("Truck updated.");
      }

      resetForm();
      setShowForm(false);
      await loadTrucks();

      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  function openEditor(t: Truck) {
    setIsEditing(true);
    setEditingId(t.id);
    setTruckNumber(t.truck_number || "");
    setYear(t.year ? String(t.year) : "");
    setMake(t.make ?? "");
    setModel(t.model ?? "");
    setVin(t.vin ?? "");
    setLicensePlate(t.license_plate ?? "");
    setLicenseState(t.license_state ?? "");
    setCurrentMileage(t.current_mileage ? String(t.current_mileage) : "");
    setStatus(t.status ?? "active");
    setRegistrationExpiration(t.registration_expiration ?? "");
    setInspectionExpiration(t.inspection_expiration ?? "");
    setInsuranceExpiration(t.insurance_expiration ?? "");
    setNotes(t.notes ?? "");
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this truck?")) return;

    try {
      setLoading(true);
      const { error: delErr } = await supabase.from("trucks").delete().eq("id", id);
      if (delErr) {
        console.error(delErr);
        setError("Failed to delete truck.");
      } else {
        setSuccessMessage("Truck deleted.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
      await loadTrucks();
    } catch (err) {
      console.error(err);
      setError("Failed to delete truck.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = trucks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.truck_number || "").toLowerCase().includes(q) ||
      (t.make || "").toLowerCase().includes(q) ||
      (t.model || "").toLowerCase().includes(q) ||
      (t.vin || "").toLowerCase().includes(q) ||
      (t.license_plate || "").toLowerCase().includes(q)
    );
  });

  const totals = {
    total: trucks.length,
    active: trucks.filter((t) => t.status === "active").length,
    available: trucks.filter((t) => t.status === "available").length,
    maintenance: trucks.filter((t) => t.status === "maintenance").length,
    inactive: trucks.filter((t) => t.status === "inactive").length,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Trucks</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Trucks</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Manage trucks, equipment status, mileage and compliance dates.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <input
                placeholder="Search truck, make, model, VIN, plate"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              onClick={() => {
                resetForm();
                setShowForm((s) => !s);
              }}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + Add Truck
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
        )}

        {/* Summary cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total Trucks</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.total}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.active}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Available</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.available}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Maintenance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.maintenance}</p>
          </div>
        </div>

        {/* Form panel */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">{isEditing ? "Edit Truck" : "Add Truck"}</h2>
              <div className="space-x-2">
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="rounded-2xl bg-slate-100 px-3 py-1 text-sm">Cancel</button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <input required value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} placeholder="Truck Number" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="VIN" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="License Plate" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input value={licenseState} onChange={(e) => setLicenseState(e.target.value)} placeholder="License State" className="rounded-xl border border-slate-300 px-4 py-3" />
              <input type="number" value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} placeholder="Current Mileage" className="rounded-xl border border-slate-300 px-4 py-3" />
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-xl border border-slate-300 px-4 py-3">
                <option value="active">active</option>
                <option value="available">available</option>
                <option value="maintenance">maintenance</option>
                <option value="inactive">inactive</option>
              </select>

              <div className="col-span-full">
                <label className="text-sm text-slate-600">Registration Expiration</label>
                <input type="date" value={registrationExpiration} onChange={(e) => setRegistrationExpiration(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>

              <div className="col-span-full">
                <label className="text-sm text-slate-600">Inspection Expiration</label>
                <input type="date" value={inspectionExpiration} onChange={(e) => setInspectionExpiration(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>

              <div className="col-span-full">
                <label className="text-sm text-slate-600">Insurance Expiration</label>
                <input type="date" value={insuranceExpiration} onChange={(e) => setInsuranceExpiration(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" />
              </div>

              <div className="col-span-full">
                <label className="text-sm text-slate-600">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" rows={3} />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button disabled={saving} type="submit" className="rounded-2xl bg-slate-950 px-6 py-2 text-sm font-semibold text-white">{saving ? "Saving..." : isEditing ? "Update Truck" : "Save Truck"}</button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Fleet Trucks</h2>
            <div className="flex items-center gap-3">
              <div className="sm:hidden">
                <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">Loading trucks...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-slate-500">No trucks found. Add your first truck to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-4 pr-6">Truck #</th>
                    <th className="py-4 pr-6">Year</th>
                    <th className="py-4 pr-6">Make / Model</th>
                    <th className="py-4 pr-6">License Plate</th>
                    <th className="py-4 pr-6">Mileage</th>
                    <th className="py-4 pr-6">Status</th>
                    <th className="py-4 pr-6">Registration</th>
                    <th className="py-4 pr-6">Inspection</th>
                    <th className="py-4 pr-6">Insurance</th>
                    <th className="py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-4 pr-6 font-medium">{t.truck_number}</td>
                      <td className="py-4 pr-6">{t.year ?? "—"}</td>
                      <td className="py-4 pr-6">{[t.make, t.model].filter(Boolean).join(" ") || "—"}</td>
                      <td className="py-4 pr-6">{t.license_plate || "—"}</td>
                      <td className="py-4 pr-6">{formatMileage(t.current_mileage)}</td>
                      <td className="py-4 pr-6">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${t.status === "active" ? "bg-emerald-100 text-emerald-700" : t.status === "available" ? "bg-sky-100 text-sky-700" : t.status === "maintenance" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{t.status}</span>
                      </td>
                      <td className="py-4 pr-6">
                        <span className={`${isExpired(t.registration_expiration) ? "text-rose-600 font-semibold" : withinDays(t.registration_expiration) ? "text-amber-600 font-semibold" : "text-slate-700"}`}>{t.registration_expiration ? new Date(t.registration_expiration).toLocaleDateString() : '—'}</span>
                      </td>
                      <td className="py-4 pr-6">
                        <span className={`${isExpired(t.inspection_expiration) ? "text-rose-600 font-semibold" : withinDays(t.inspection_expiration) ? "text-amber-600 font-semibold" : "text-slate-700"}`}>{t.inspection_expiration ? new Date(t.inspection_expiration).toLocaleDateString() : '—'}</span>
                      </td>
                      <td className="py-4 pr-6">
                        <span className={`${isExpired(t.insurance_expiration) ? "text-rose-600 font-semibold" : withinDays(t.insurance_expiration) ? "text-amber-600 font-semibold" : "text-slate-700"}`}>{t.insurance_expiration ? new Date(t.insurance_expiration).toLocaleDateString() : '—'}</span>
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditor(t)} className="rounded-2xl bg-slate-100 px-3 py-1 text-sm">Edit</button>
                          <button onClick={() => handleDelete(t.id)} className="rounded-2xl bg-rose-50 px-3 py-1 text-sm text-rose-600">Delete</button>
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