"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Driver = {
  id: string;
  first_name: string;
  last_name: string;
};

type Truck = {
  id: string;
  truck_number: string;
};

type Trailer = {
  id: string;
  trailer_number: string;
};

type Broker = {
  id: string;
  company_name: string;
};

type Load = {
  id: string;
  load_number: string;
  broker_id?: string | null;
  driver_id?: string | null;
  truck_id?: string | null;
  trailer_id?: string | null;
  equipment_type?: string | null;
  pickup_location?: string | null;
  pickup_city?: string | null;
  pickup_state?: string | null;
  pickup_date?: string | null;
  delivery_location?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_date?: string | null;
  miles?: number | null;
  linehaul?: number | null;
  detention?: number | null;
  layover?: number | null;
  lumper?: number | null;
  tolls?: number | null;
  other_charges?: number | null;
  status?: string | null;
  notes?: string | null;
  brokers?: { company_name?: string } | null;
  drivers?: { first_name?: string; last_name?: string } | null;
  trucks?: { truck_number?: string } | null;
  trailers?: { trailer_number?: string } | null;
};

type DriverOption = { id: string; first_name: string; last_name: string; status?: string };
type TruckOption = { id: string; truck_number: string; status?: string };
type TrailerOption = { id: string; trailer_number: string; status?: string };
type BrokerOption = { id: string; company_name: string };

export default function LoadsPage() {
  const supabase = createClient();

  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [trailers, setTrailers] = useState<TrailerOption[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [loadNumber, setLoadNumber] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [notes, setNotes] = useState("");
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [trailerId, setTrailerId] = useState("");

  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupDate, setPickupDate] = useState("");

  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const [equipmentType, setEquipmentType] = useState("");
  const [miles, setMiles] = useState("");
  const [tolls, setTolls] = useState("");

  const [linehaul, setLinehaul] = useState("");
  const [detention, setDetention] = useState("");
  const [layover, setLayover] = useState("");
  const [lumper, setLumper] = useState("");
  const [otherCharges, setOtherCharges] = useState("");

  const [status, setStatus] = useState("booked");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const res = await supabase
        .from("loads")
        .select(`
          *,
          brokers ( company_name ),
          drivers ( first_name, last_name ),
          trucks ( truck_number ),
          trailers ( trailer_number )
        `)
        .order("pickup_date", { ascending: false });

      const data = res.data as Load[] | null;
      const loadErr = res.error;

      if (loadErr) {
        console.error(loadErr);
        setError("Failed to load loads.");
        setLoads([]);
      } else {
        setLoads(data ?? []);
      }

      // fetch options
      const drvRes = await supabase.from("drivers").select("id,first_name,last_name,status");
      const trRes = await supabase.from("trucks").select("id,truck_number,status");
      const tlRes = await supabase.from("trailers").select("id,trailer_number,status");
      const brRes = await supabase.from("brokers").select("id,company_name");

      setDrivers((drvRes.data as DriverOption[] | null) ?? []);
      setTrucks((trRes.data as TruckOption[] | null) ?? []);
      setTrailers((tlRes.data as TrailerOption[] | null) ?? []);
      setBrokers((brRes.data as BrokerOption[] | null) ?? []);
    } catch (err) {
      console.error(err);
      setError("Could not load loads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setLoadNumber("");
    setBrokerId("");
    setDriverId("");
    setTruckId("");
    setTrailerId("");
    setPickupCity("");
    setPickupState("");
    setPickupDate("");
    setDeliveryCity("");
    setDeliveryState("");
    setDeliveryDate("");
    setEquipmentType("");
    setMiles("");
    setLinehaul("");
    setDetention("");
    setLayover("");
    setLumper("");
    setTolls("");
    setOtherCharges("");
    setStatus("booked");
    setIsEditing(false);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");

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
        load_number: loadNumber,
        broker_id: brokerId || null,
        driver_id: driverId || null,
        truck_id: truckId || null,
        trailer_id: trailerId || null,
        equipment_type: equipmentType || null,

        pickup_location: null,
        pickup_city: pickupCity || null,
        pickup_state: pickupState || null,
        pickup_date: pickupDate || null,

        delivery_location: null,
        delivery_city: deliveryCity || null,
        delivery_state: deliveryState || null,
        delivery_date: deliveryDate || null,

        miles: miles ? Number(miles) : 0,

        linehaul: linehaul ? Number(linehaul) : 0,
        detention: detention ? Number(detention) : 0,
        layover: layover ? Number(layover) : 0,
        lumper: lumper ? Number(lumper) : 0,
        tolls: tolls ? Number(tolls) : 0,
        other_charges: otherCharges ? Number(otherCharges) : 0,

        status,
        notes: notes || null,
      };

      if (!isEditing) {
        const { error: insertErr } = await supabase.from("loads").insert([{ ...payload, company_id }]);
        if (insertErr) {
          console.error(insertErr);
          throw new Error(insertErr.message || "Failed to insert load.");
        }
        setSuccessMessage("Load added.");
      } else {
        const { error: updateErr } = await supabase.from("loads").update(payload).eq("id", editingId);
        if (updateErr) {
          console.error(updateErr);
          throw new Error(updateErr.message || "Failed to update load.");
        }
        setSuccessMessage("Load updated.");
      }

      resetForm();
      setShowForm(false);
      await loadData();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Could not add load.");
    } finally {
      setSaving(false);
    }
  }

  function money(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function loadRevenue(load: Load) {
    return (
      Number(load.linehaul ?? 0) +
      Number(load.detention ?? 0) +
      Number(load.layover ?? 0) +
      Number(load.lumper ?? 0) +
      Number(load.other_charges ?? 0)
    );
  }

  function formatMiles(v?: number | null) {
    return (v ?? 0).toLocaleString();
  }

  function openEditor(l: Load) {
    setIsEditing(true);
    setEditingId(l.id);
    setLoadNumber(l.load_number ?? "");
    setBrokerId(l.broker_id ?? "");
    setDriverId(l.driver_id ?? "");
    setTruckId(l.truck_id ?? "");
    setTrailerId(l.trailer_id ?? "");
    setEquipmentType(l.equipment_type ?? "");
    setPickupCity(l.pickup_city ?? "");
    setPickupState(l.pickup_state ?? "");
    setPickupDate(l.pickup_date ?? "");
    setDeliveryCity(l.delivery_city ?? "");
    setDeliveryState(l.delivery_state ?? "");
    setDeliveryDate(l.delivery_date ?? "");
    setMiles(l.miles != null ? String(l.miles) : "");
    setLinehaul(l.linehaul != null ? String(l.linehaul) : "");
    setDetention(l.detention != null ? String(l.detention) : "");
    setLayover(l.layover != null ? String(l.layover) : "");
    setLumper(l.lumper != null ? String(l.lumper) : "");
    setTolls(l.tolls != null ? String(l.tolls) : "");
    setOtherCharges(l.other_charges != null ? String(l.other_charges) : "");
    setStatus(l.status ?? "booked");
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this load?")) return;
    try {
      setLoading(true);
      const { error: delErr } = await supabase.from("loads").delete().eq("id", id);
      if (delErr) {
        console.error(delErr);
        setError("Failed to delete load.");
      } else {
        setSuccessMessage("Load deleted.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Failed to delete load.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = loads.filter((l) => {
    if (statusFilter !== "all") {
      if ((l.status ?? "") !== statusFilter) return false;
    }

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.load_number || "").toLowerCase().includes(q) ||
      (l.brokers?.company_name || "").toLowerCase().includes(q) ||
      (l.drivers ? `${l.drivers.first_name} ${l.drivers.last_name}`.toLowerCase() : "").includes(q) ||
      (l.trucks?.truck_number || "").toLowerCase().includes(q) ||
      (l.pickup_city || "").toLowerCase().includes(q) ||
      (l.pickup_state || "").toLowerCase().includes(q) ||
      (l.delivery_city || "").toLowerCase().includes(q) ||
      (l.delivery_state || "").toLowerCase().includes(q)
    );
  });

  const totals = {
    total: loads.length,
    active: loads.filter((l) => ["booked", "dispatched", "picked_up", "in_transit"].includes(l.status ?? "")).length,
    delivered: loads.filter((l) => ["delivered", "pod_received", "invoiced", "paid"].includes(l.status ?? "")).length,
    awaitingPod: loads.filter((l) => (l.status ?? "") === "delivered").length,
    invoiced: loads.filter((l) => (l.status ?? "") === "invoiced").length,
    paid: loads.filter((l) => (l.status ?? "") === "paid").length,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] text-blue-600">FLEETOS</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Loads</h1>
            <p className="mt-2 text-slate-500">Manage dispatch, revenue, drivers, trucks and load status.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <input placeholder="Search loads, broker, driver, truck, city/state" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm" />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
              <option value="all">All</option>
              <option value="booked">Booked</option>
              <option value="dispatched">Dispatched</option>
              <option value="picked_up">Picked Up</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="pod_received">POD Received</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button onClick={() => { resetForm(); setShowForm((s) => !s); }} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500">{showForm ? "Close" : "+ Add Load"}</button>
          </div>
        </div>

        {error && (<div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>)}

        {successMessage && (<div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>)}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-slate-500">Total Loads</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.total}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-slate-500">Active Loads</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.active}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-slate-500">Delivered</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.delivered}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-slate-500">Awaiting POD</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.awaitingPod}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-slate-500">Invoiced</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.invoiced}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-1">
            <p className="text-sm text-slate-500">Paid</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totals.paid}</p>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-6 text-xl font-semibold text-slate-950">
              Add Load
            </h2>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <input
                required
                value={loadNumber}
                onChange={(e) => setLoadNumber(e.target.value)}
                placeholder="Load #"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <select
                value={brokerId}
                onChange={(e) => setBrokerId(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Select Broker</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.company_name}
                  </option>
                ))}
              </select>

              {/* optional new broker creation removed — use existing brokers */}

              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Select Driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name}
                  </option>
                ))}
              </select>

              <select value={truckId} onChange={(e) => setTruckId(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">
                <option value="">Select Truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>{truck.truck_number}</option>
                ))}
              </select>

              <select value={trailerId} onChange={(e) => setTrailerId(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">
                <option value="">Select Trailer</option>
                {trailers.map((t) => (
                  <option key={t.id} value={t.id}>{t.trailer_number}</option>
                ))}
              </select>

              <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3">
                <option value="">Select Equipment</option>
                <option>Dry Van</option>
                <option>Reefer</option>
                <option>Flatbed</option>
                <option>Stepdeck</option>
                <option>Power Only</option>
                <option>Box Truck</option>
                <option>Hotshot</option>
                <option>Other</option>
              </select>

              <input
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
                placeholder="Pickup City"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={pickupState}
                onChange={(e) => setPickupState(e.target.value)}
                placeholder="Pickup State"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <div>
                <label className="mb-2 block text-sm text-slate-600">
                  Pickup Date
                </label>
                <input
                  type="datetime-local"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <input
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
                placeholder="Delivery City"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={deliveryState}
                onChange={(e) => setDeliveryState(e.target.value)}
                placeholder="Delivery State"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <div>
                <label className="mb-2 block text-sm text-slate-600">
                  Delivery Date
                </label>
                <input
                  type="datetime-local"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <input
                type="number"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                placeholder="Miles"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="number"
                step="0.01"
                value={linehaul}
                onChange={(e) => setLinehaul(e.target.value)}
                placeholder="Linehaul $"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="number"
                step="0.01"
                value={detention}
                onChange={(e) => setDetention(e.target.value)}
                placeholder="Detention $"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="number"
                step="0.01"
                value={layover}
                onChange={(e) => setLayover(e.target.value)}
                placeholder="Layover $"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="number"
                step="0.01"
                value={lumper}
                onChange={(e) => setLumper(e.target.value)}
                placeholder="Lumper $"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="number"
                step="0.01"
                value={tolls}
                onChange={(e) => setTolls(e.target.value)}
                placeholder="Tolls $"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="number"
                step="0.01"
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                placeholder="Other Charges $"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <div className="col-span-full">
                <label className="mb-2 block text-sm text-slate-600">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" rows={2} placeholder="Notes" />
              </div>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="booked">Booked</option>
                <option value="dispatched">Dispatched</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="pod_received">POD Received</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              disabled={saving}
              type="submit"
              className="mt-6 rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Load"}
            </button>
          </form>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Load Board
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">
              Loading loads...
            </div>
          ) : loads.length === 0 ? (
            <div className="p-8 text-slate-500">
              No loads have been added yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-4 pr-6">Load #</th>
                    <th className="py-4 pr-6">Broker</th>
                    <th className="py-4 pr-6">Driver</th>
                    <th className="py-4 pr-6">Truck</th>
                    <th className="py-4 pr-6">Pickup</th>
                    <th className="py-4 pr-6">Delivery</th>
                    <th className="py-4 pr-6">Miles</th>
                    <th className="py-4 pr-6">Revenue</th>
                    <th className="py-4 pr-6">Status</th>
                    <th className="py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filtered.map((load) => (
                    <tr key={load.id} className="hover:bg-slate-50">
                      <td className="py-4 pr-6 font-medium">{load.load_number}</td>
                      <td className="py-4 pr-6">{load.brokers?.company_name || '—'}</td>
                      <td className="py-4 pr-6">{load.drivers ? `${load.drivers.first_name} ${load.drivers.last_name}` : '—'}</td>
                      <td className="py-4 pr-6">{load.trucks?.truck_number || '—'}</td>
                      <td className="py-4 pr-6">
                        <div>{(load.pickup_city || '—') + (load.pickup_state ? `, ${load.pickup_state}` : '')}</div>
                        <div className="text-xs text-slate-500">{load.pickup_date ? new Date(load.pickup_date).toLocaleString() : '—'}</div>
                      </td>
                      <td className="py-4 pr-6">
                        <div>{(load.delivery_city || '—') + (load.delivery_state ? `, ${load.delivery_state}` : '')}</div>
                        <div className="text-xs text-slate-500">{load.delivery_date ? new Date(load.delivery_date).toLocaleString() : '—'}</div>
                      </td>
                      <td className="py-4 pr-6">{formatMiles(load.miles)}</td>
                      <td className="py-4 pr-6 font-semibold text-slate-900">{money(loadRevenue(load))}</td>
                      <td className="py-4 pr-6">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${load.status === 'booked' ? 'bg-sky-100 text-sky-700' : load.status === 'dispatched' ? 'bg-indigo-100 text-indigo-700' : load.status === 'picked_up' ? 'bg-purple-100 text-purple-700' : load.status === 'in_transit' ? 'bg-amber-100 text-amber-700' : load.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : load.status === 'pod_received' ? 'bg-teal-100 text-teal-700' : load.status === 'invoiced' ? 'bg-sky-50 text-sky-700' : load.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : load.status === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>{(load.status || '').replaceAll('_', ' ')}</span>
                      </td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditor(load)} className="rounded-2xl bg-slate-100 px-3 py-1 text-sm">Edit</button>
                          <button onClick={() => handleDelete(load.id)} className="rounded-2xl bg-rose-50 px-3 py-1 text-sm text-rose-600">Delete</button>
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