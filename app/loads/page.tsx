"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import {
  getAuthRole,
  roleLabel,
  type AuthRoleContext,
} from "@/lib/auth-role";

type DriverOption = {
  id: string;
  first_name: string;
  last_name: string;
  status?: string | null;
};

type TruckOption = {
  id: string;
  truck_number: string;
  status?: string | null;
};

type TrailerOption = {
  id: string;
  trailer_number: string;
  status?: string | null;
};

type Load = {
  id: string;
  company_id?: string;

  load_number: string;

  broker_id?: string | null;
  broker_name?: string | null;
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

  brokers?: {
    company_name?: string | null;
  } | null;

  drivers?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;

  trucks?: {
    truck_number?: string | null;
  } | null;

  trailers?: {
    trailer_number?: string | null;
  } | null;
};

const ACTIVE_STATUSES = [
  "booked",
  "dispatched",
  "picked_up",
  "in_transit",
];

const COMPLETED_STATUSES = [
  "delivered",
  "pod_received",
  "invoiced",
  "paid",
];

const DELETE_LOCKED_STATUSES = [
  "delivered",
  "pod_received",
  "invoiced",
  "paid",
];

export default function LoadsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [
    authContext,
    setAuthContext,
  ] =
    useState<AuthRoleContext | null>(
      null
    );

  const [
    checkingRole,
    setCheckingRole,
  ] = useState(true);

  const [
    loads,
    setLoads,
  ] = useState<Load[]>([]);

  const [
    drivers,
    setDrivers,
  ] = useState<DriverOption[]>(
    []
  );

  const [
    trucks,
    setTrucks,
  ] = useState<TruckOption[]>([]);

  const [
    trailers,
    setTrailers,
  ] = useState<TrailerOption[]>(
    []
  );

  const [
    brokerName,
    setBrokerName,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(null);

  const [
    loadNumber,
    setLoadNumber,
  ] = useState("");

  const [
    brokerId,
    setBrokerId,
  ] = useState("");

  const [
    driverId,
    setDriverId,
  ] = useState("");

  const [
    truckId,
    setTruckId,
  ] = useState("");

  const [
    trailerId,
    setTrailerId,
  ] = useState("");

  const [
    equipmentType,
    setEquipmentType,
  ] = useState("");

  const [
    pickupCity,
    setPickupCity,
  ] = useState("");

  const [
    pickupState,
    setPickupState,
  ] = useState("");

  const [
    pickupDate,
    setPickupDate,
  ] = useState("");

  const [
    deliveryCity,
    setDeliveryCity,
  ] = useState("");

  const [
    deliveryState,
    setDeliveryState,
  ] = useState("");

  const [
    deliveryDate,
    setDeliveryDate,
  ] = useState("");

  const [
    miles,
    setMiles,
  ] = useState("");

  const [
    linehaul,
    setLinehaul,
  ] = useState("");

  const [
    detention,
    setDetention,
  ] = useState("");

  const [
    layover,
    setLayover,
  ] = useState("");

  const [
    lumper,
    setLumper,
  ] = useState("");

  const [
    tolls,
    setTolls,
  ] = useState("");

  const [
    otherCharges,
    setOtherCharges,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("booked");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  // ============================================================
  // ROLE PERMISSIONS
  // ============================================================

  const role =
    authContext?.role;

  const canCreate =
    role === "owner" ||
    role === "admin" ||
    role === "dispatcher";

  const canEdit =
    role === "owner" ||
    role === "admin" ||
    role === "dispatcher";

  const canAttemptDelete =
    role === "owner" ||
    role === "admin";

  const isFleetManager =
    role === "fleet_manager";

  const isReadOnly =
    !canCreate && !canEdit;

  // ============================================================
  // INITIALIZE AUTH
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setCheckingRole(true);

        const auth =
          await getAuthRole(
            supabase
          );

        if (!mounted) {
          return;
        }

        if (!auth) {
          router.replace(
            "/login"
          );

          return;
        }

        if (
          auth.role === "driver"
        ) {
          router.replace(
            "/driver"
          );

          return;
        }

        setAuthContext(auth);
      } catch (err) {
        console.error(
          "Loads auth error:",
          err
        );

        if (mounted) {
          setError(
            "Unable to verify your FleetOS permissions."
          );
        }
      } finally {
        if (mounted) {
          setCheckingRole(false);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // LOAD DATA AFTER AUTH
  // ============================================================

  useEffect(() => {
    if (!authContext) {
      return;
    }

    void loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authContext]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        loadResult,
        driverResult,
        truckResult,
        trailerResult,
      ] = await Promise.all([
        supabase
          .from("loads")
          .select(`
            *,
            brokers (
              company_name
            ),
            drivers (
              first_name,
              last_name
            ),
            trucks (
              truck_number
            ),
            trailers (
              trailer_number
            )
          `)
          .order(
            "pickup_date",
            {
              ascending: false,
            }
          ),

        supabase
          .from("drivers")
          .select(`
            id,
            first_name,
            last_name,
            status
          `)
          .order(
            "first_name",
            {
              ascending: true,
            }
          ),

        supabase
          .from("trucks")
          .select(`
            id,
            truck_number,
            status
          `)
          .order(
            "truck_number",
            {
              ascending: true,
            }
          ),

        supabase
          .from("trailers")
          .select(`
            id,
            trailer_number,
            status
          `)
          .order(
            "trailer_number",
            {
              ascending: true,
            }
          ),

      ]);

      if (loadResult.error) {
        console.error(
          "Loads query error:",
          loadResult.error
        );

        throw new Error(
          "Failed to load loads."
        );
      }

      setLoads(
        (loadResult.data ??
          []) as unknown as Load[]
      );

      if (
        !driverResult.error
      ) {
        setDrivers(
          (driverResult.data ??
            []) as DriverOption[]
        );
      }

      if (
        !truckResult.error
      ) {
        setTrucks(
          (truckResult.data ??
            []) as TruckOption[]
        );
      }

      if (
        !trailerResult.error
      ) {
        setTrailers(
          (trailerResult.data ??
            []) as TrailerOption[]
        );
      }

    } catch (err) {
      console.error(
        "Load board error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load loads."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // RESET FORM
  // ============================================================

  function resetForm() {
    setLoadNumber("");
    setBrokerName("");
    setDriverId("");
    setTruckId("");
    setTrailerId("");

    setEquipmentType("");

    setPickupCity("");
    setPickupState("");
    setPickupDate("");

    setDeliveryCity("");
    setDeliveryState("");
    setDeliveryDate("");

    setMiles("");

    setLinehaul("");
    setDetention("");
    setLayover("");
    setLumper("");
    setTolls("");
    setOtherCharges("");

    setNotes("");

    setStatus("booked");

    setIsEditing(false);
    setEditingId(null);
  }

  // ============================================================
  // CREATE / UPDATE LOAD
  // ============================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!authContext) {
      setError(
        "Authentication required."
      );

      return;
    }

    if (
      isEditing &&
      !canEdit
    ) {
      setError(
        "Your role does not have permission to edit loads."
      );

      return;
    }

    if (
      !isEditing &&
      !canCreate
    ) {
      setError(
        "Your role does not have permission to create loads."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        load_number:
          loadNumber.trim(),

        broker_id:
          null,

        broker_name:
          brokerName.trim() || null,

        driver_id:
          driverId || null,

        truck_id:
          truckId || null,

        trailer_id:
          trailerId || null,

        equipment_type:
          equipmentType ||
          null,

        pickup_location:
          null,

        pickup_city:
          pickupCity.trim() ||
          null,

        pickup_state:
          pickupState.trim() ||
          null,

        pickup_date:
          pickupDate ||
          null,

        delivery_location:
          null,

        delivery_city:
          deliveryCity.trim() ||
          null,

        delivery_state:
          deliveryState.trim() ||
          null,

        delivery_date:
          deliveryDate ||
          null,

        miles:
          miles
            ? Number(miles)
            : 0,

        linehaul:
          linehaul
            ? Number(linehaul)
            : 0,

        detention:
          detention
            ? Number(detention)
            : 0,

        layover:
          layover
            ? Number(layover)
            : 0,

        lumper:
          lumper
            ? Number(lumper)
            : 0,

        tolls:
          tolls
            ? Number(tolls)
            : 0,

        other_charges:
          otherCharges
            ? Number(
                otherCharges
              )
            : 0,

        status,

        notes:
          notes.trim() ||
          null,
      };

      if (!isEditing) {
        const {
          error: insertError,
        } = await supabase
          .from("loads")
          .insert([
            {
              ...payload,

              company_id:
                authContext.companyId,
            },
          ]);

        if (insertError) {
          console.error(
            "Load insert error:",
            insertError
          );

          throw new Error(
            insertError.message ||
              "Failed to add load."
          );
        }

        setSuccessMessage(
          "Load added successfully."
        );
      } else {
        if (!editingId) {
          throw new Error(
            "No load selected for editing."
          );
        }

        const {
          error: updateError,
        } = await supabase
          .from("loads")
          .update(payload)
          .eq(
            "id",
            editingId
          )
          .eq(
            "company_id",
            authContext.companyId
          );

        if (updateError) {
          console.error(
            "Load update error:",
            updateError
          );

          throw new Error(
            updateError.message ||
              "Failed to update load."
          );
        }

        setSuccessMessage(
          "Load updated successfully."
        );
      }

      resetForm();
      setShowForm(false);

      await loadData();

      window.setTimeout(
        () =>
          setSuccessMessage(
            ""
          ),
        3000
      );
    } catch (err) {
      console.error(
        "Save load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not save load."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // EDIT
  // ============================================================

  function openEditor(
    load: Load
  ) {
    if (!canEdit) {
      setError(
        "Your role has read-only access to loads."
      );

      return;
    }

    setError("");

    setIsEditing(true);

    setEditingId(
      load.id
    );

    setLoadNumber(
      load.load_number ?? ""
    );

    setBrokerName(
      load.broker_name ??
        load.brokers?.company_name ??
        ""
    );

    setDriverId(
      load.driver_id ?? ""
    );

    setTruckId(
      load.truck_id ?? ""
    );

    setTrailerId(
      load.trailer_id ?? ""
    );

    setEquipmentType(
      load.equipment_type ??
        ""
    );

    setPickupCity(
      load.pickup_city ?? ""
    );

    setPickupState(
      load.pickup_state ?? ""
    );

    setPickupDate(
      toDateTimeLocal(
        load.pickup_date
      )
    );

    setDeliveryCity(
      load.delivery_city ?? ""
    );

    setDeliveryState(
      load.delivery_state ?? ""
    );

    setDeliveryDate(
      toDateTimeLocal(
        load.delivery_date
      )
    );

    setMiles(
      load.miles != null
        ? String(load.miles)
        : ""
    );

    setLinehaul(
      load.linehaul != null
        ? String(
            load.linehaul
          )
        : ""
    );

    setDetention(
      load.detention != null
        ? String(
            load.detention
          )
        : ""
    );

    setLayover(
      load.layover != null
        ? String(load.layover)
        : ""
    );

    setLumper(
      load.lumper != null
        ? String(load.lumper)
        : ""
    );

    setTolls(
      load.tolls != null
        ? String(load.tolls)
        : ""
    );

    setOtherCharges(
      load.other_charges !=
        null
        ? String(
            load.other_charges
          )
        : ""
    );

    setStatus(
      load.status ??
        "booked"
    );

    setNotes(
      load.notes ?? ""
    );

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ============================================================
  // DELETE
  // ============================================================

  async function handleDelete(
    load: Load
  ) {
    if (
      !authContext ||
      !canAttemptDelete
    ) {
      setError(
        "Your role does not have permission to delete loads."
      );

      return;
    }

    const currentStatus =
      load.status ?? "";

    if (
      DELETE_LOCKED_STATUSES.includes(
        currentStatus
      )
    ) {
      setError(
        "Completed, POD-received, invoiced, and paid loads cannot be deleted because they are part of the operational and financial history."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete load ${load.load_number}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const {
        error: deleteError,
      } = await supabase
        .from("loads")
        .delete()
        .eq(
          "id",
          load.id
        )
        .eq(
          "company_id",
          authContext.companyId
        );

      if (deleteError) {
        console.error(
          "Load delete error:",
          deleteError
        );

        throw new Error(
          deleteError.message ||
            "Failed to delete load."
        );
      }

      setSuccessMessage(
        "Load deleted."
      );

      await loadData();

      window.setTimeout(
        () =>
          setSuccessMessage(
            ""
          ),
        3000
      );
    } catch (err) {
      console.error(
        "Delete load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete load."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // FILTER
  // ============================================================

  const filtered =
    useMemo(() => {
      return loads.filter(
        (load) => {
          if (
            statusFilter !==
              "all" &&
            (load.status ??
              "") !==
              statusFilter
          ) {
            return false;
          }

          if (!search.trim()) {
            return true;
          }

          const query =
            search
              .trim()
              .toLowerCase();

          const driverName =
            load.drivers
              ? `${load.drivers.first_name ?? ""} ${load.drivers.last_name ?? ""}`
                  .trim()
                  .toLowerCase()
              : "";

          return (
            load.load_number
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              load.broker_name ??
              load.brokers
                ?.company_name ??
              ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            driverName.includes(
              query
            ) ||
            (
              load.trucks
                ?.truck_number ??
              ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              load.pickup_city ??
              ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              load.pickup_state ??
              ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              load.delivery_city ??
              ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              load.delivery_state ??
              ""
            )
              .toLowerCase()
              .includes(
                query
              )
          );
        }
      );
    }, [
      loads,
      search,
      statusFilter,
    ]);

  // ============================================================
  // TOTALS
  // ============================================================

  const totals =
    useMemo(() => {
      return {
        total:
          loads.length,

        active:
          loads.filter(
            (load) =>
              ACTIVE_STATUSES.includes(
                load.status ??
                  ""
              )
          ).length,

        delivered:
          loads.filter(
            (load) =>
              COMPLETED_STATUSES.includes(
                load.status ??
                  ""
              )
          ).length,

        awaitingPod:
          loads.filter(
            (load) =>
              load.status ===
              "delivered"
          ).length,

        invoiced:
          loads.filter(
            (load) =>
              load.status ===
              "invoiced"
          ).length,

        paid:
          loads.filter(
            (load) =>
              load.status ===
              "paid"
          ).length,
      };
    }, [loads]);

  // ============================================================
  // LOADING ROLE
  // ============================================================

  if (checkingRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            FleetOS
          </p>

          <p className="mt-3 text-lg font-semibold">
            Loading Loads...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold tracking-[0.25em] text-blue-600">
                FLEETOS
              </p>

              {authContext && (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                  {roleLabel(
                    authContext.role
                  )}
                </span>
              )}
            </div>

            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Loads
            </h1>

            <p className="mt-2 text-slate-500">
              {isFleetManager
                ? "View company loads, assignments, equipment, routes, status and load revenue."
                : isReadOnly
                  ? "Review company loads, assignments, routes, status and revenue."
                  : "Manage dispatch, load revenue, drivers, trucks and load status."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              placeholder="Search loads, broker, driver, truck, city/state"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              className="min-w-64 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none focus:border-blue-400"
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
            >
              <option value="all">
                All
              </option>

              <option value="booked">
                Booked
              </option>

              <option value="dispatched">
                Dispatched
              </option>

              <option value="picked_up">
                Picked Up
              </option>

              <option value="in_transit">
                In Transit
              </option>

              <option value="delivered">
                Delivered
              </option>

              <option value="pod_received">
                POD Received
              </option>

              <option value="invoiced">
                Invoiced
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  resetForm();

                  setShowForm(
                    (
                      current
                    ) =>
                      !current
                  );
                }}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
              >
                {showForm
                  ? "Close"
                  : "+ Add Load"}
              </button>
            )}
          </div>
        </div>

        {/* READ ONLY NOTICE */}

        {isReadOnly && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Your{" "}
            <strong>
              {roleLabel(role)}
            </strong>{" "}
            account has read-only
            access to the Load
            Board.
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {/* SUMMARY */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            label="Total Loads"
            value={
              totals.total
            }
          />

          <StatCard
            label="Active Loads"
            value={
              totals.active
            }
          />

          <StatCard
            label="Delivered"
            value={
              totals.delivered
            }
          />

          <StatCard
            label="Awaiting POD"
            value={
              totals.awaitingPod
            }
          />

          <StatCard
            label="Invoiced"
            value={
              totals.invoiced
            }
          />

          <StatCard
            label="Paid"
            value={
              totals.paid
            }
          />
        </div>

        {/* FORM */}

        {showForm &&
          (canCreate ||
            canEdit) && (
            <form
              onSubmit={
                handleSubmit
              }
              className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {isEditing
                      ? "Edit Load"
                      : "Add Load"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {isEditing
                      ? "Update load, assignment, financial and operational details."
                      : "Create a new company load."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetForm();

                    setShowForm(
                      false
                    );
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Field>
                  <input
                    required
                    value={
                      loadNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setLoadNumber(
                        event.target
                          .value
                      )
                    }
                    placeholder="Load #"
                    className={inputClass}
                  />
                </Field>

                <Field>
                  <input
                    value={brokerName}
                    onChange={(event) =>
                      setBrokerName(
                        event.target.value
                      )
                    }
                    placeholder="Broker Name"
                    className={inputClass}
                  />
                </Field>

                <Field>
                  <select
                    value={
                      driverId
                    }
                    onChange={(
                      event
                    ) =>
                      setDriverId(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select Driver
                    </option>

                    {drivers.map(
                      (driver) => (
                        <option
                          key={
                            driver.id
                          }
                          value={
                            driver.id
                          }
                        >
                          {
                            driver.first_name
                          }{" "}
                          {
                            driver.last_name
                          }
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field>
                  <select
                    value={
                      truckId
                    }
                    onChange={(
                      event
                    ) =>
                      setTruckId(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select Truck
                    </option>

                    {trucks.map(
                      (truck) => (
                        <option
                          key={
                            truck.id
                          }
                          value={
                            truck.id
                          }
                        >
                          {
                            truck.truck_number
                          }
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field>
                  <select
                    value={
                      trailerId
                    }
                    onChange={(
                      event
                    ) =>
                      setTrailerId(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select Trailer
                    </option>

                    {trailers.map(
                      (
                        trailer
                      ) => (
                        <option
                          key={
                            trailer.id
                          }
                          value={
                            trailer.id
                          }
                        >
                          {
                            trailer.trailer_number
                          }
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field>
                  <select
                    value={
                      equipmentType
                    }
                    onChange={(
                      event
                    ) =>
                      setEquipmentType(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select Equipment
                    </option>

                    <option value="Dry Van">
                      Dry Van
                    </option>

                    <option value="Reefer">
                      Reefer
                    </option>

                    <option value="Flatbed">
                      Flatbed
                    </option>

                    <option value="Stepdeck">
                      Stepdeck
                    </option>

                    <option value="Power Only">
                      Power Only
                    </option>

                    <option value="Box Truck">
                      Box Truck
                    </option>

                    <option value="Hotshot">
                      Hotshot
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </Field>

                <Field>
                  <input
                    value={
                      pickupCity
                    }
                    onChange={(
                      event
                    ) =>
                      setPickupCity(
                        event.target
                          .value
                      )
                    }
                    placeholder="Pickup City"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    value={
                      pickupState
                    }
                    onChange={(
                      event
                    ) =>
                      setPickupState(
                        event.target
                          .value
                      )
                    }
                    placeholder="Pickup State"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field
                  label="Pickup Date"
                >
                  <input
                    type="datetime-local"
                    value={
                      pickupDate
                    }
                    onChange={(
                      event
                    ) =>
                      setPickupDate(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    value={
                      deliveryCity
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryCity(
                        event.target
                          .value
                      )
                    }
                    placeholder="Delivery City"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    value={
                      deliveryState
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryState(
                        event.target
                          .value
                      )
                    }
                    placeholder="Delivery State"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field
                  label="Delivery Date"
                >
                  <input
                    type="datetime-local"
                    value={
                      deliveryDate
                    }
                    onChange={(
                      event
                    ) =>
                      setDeliveryDate(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    value={miles}
                    onChange={(
                      event
                    ) =>
                      setMiles(
                        event.target
                          .value
                      )
                    }
                    placeholder="Miles"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    step="0.01"
                    value={
                      linehaul
                    }
                    onChange={(
                      event
                    ) =>
                      setLinehaul(
                        event.target
                          .value
                      )
                    }
                    placeholder="Linehaul $"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    step="0.01"
                    value={
                      detention
                    }
                    onChange={(
                      event
                    ) =>
                      setDetention(
                        event.target
                          .value
                      )
                    }
                    placeholder="Detention $"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    step="0.01"
                    value={
                      layover
                    }
                    onChange={(
                      event
                    ) =>
                      setLayover(
                        event.target
                          .value
                      )
                    }
                    placeholder="Layover $"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    step="0.01"
                    value={lumper}
                    onChange={(
                      event
                    ) =>
                      setLumper(
                        event.target
                          .value
                      )
                    }
                    placeholder="Lumper $"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    step="0.01"
                    value={tolls}
                    onChange={(
                      event
                    ) =>
                      setTolls(
                        event.target
                          .value
                      )
                    }
                    placeholder="Tolls $"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <input
                    type="number"
                    step="0.01"
                    value={
                      otherCharges
                    }
                    onChange={(
                      event
                    ) =>
                      setOtherCharges(
                        event.target
                          .value
                      )
                    }
                    placeholder="Other Charges $"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field>
                  <select
                    value={status}
                    onChange={(
                      event
                    ) =>
                      setStatus(
                        event.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="booked">
                      Booked
                    </option>

                    <option value="dispatched">
                      Dispatched
                    </option>

                    <option value="picked_up">
                      Picked Up
                    </option>

                    <option value="in_transit">
                      In Transit
                    </option>

                    <option value="delivered">
                      Delivered
                    </option>

                    <option value="pod_received">
                      POD Received
                    </option>

                    <option value="invoiced">
                      Invoiced
                    </option>

                    <option value="paid">
                      Paid
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </Field>

                <div className="col-span-full">
                  <label className="mb-2 block text-sm text-slate-600">
                    Notes
                  </label>

                  <textarea
                    value={notes}
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    rows={3}
                    placeholder="Notes"
                    className={`${inputClass} w-full`}
                  />
                </div>
              </div>

              <button
                disabled={saving}
                type="submit"
                className="mt-6 rounded-xl bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update Load"
                    : "Save Load"}
              </button>
            </form>
          )}

        {/* LOAD BOARD */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Load Board
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filtered.length}{" "}
                {filtered.length ===
                1
                  ? "load"
                  : "loads"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">
              Loading loads...
            </div>
          ) : loads.length ===
            0 ? (
            <div className="p-8 text-slate-500">
              No loads have been
              added yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-4">
                      Load #
                    </th>

                    <th className="px-5 py-4">
                      Broker
                    </th>

                    <th className="px-5 py-4">
                      Driver
                    </th>

                    <th className="px-5 py-4">
                      Truck
                    </th>

                    <th className="px-5 py-4">
                      Pickup
                    </th>

                    <th className="px-5 py-4">
                      Delivery
                    </th>

                    <th className="px-5 py-4">
                      Miles
                    </th>

                    <th className="px-5 py-4">
                      Revenue
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    {(canEdit ||
                      canAttemptDelete) && (
                      <th className="px-5 py-4">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filtered.map(
                    (load) => {
                      const locked =
                        DELETE_LOCKED_STATUSES.includes(
                          load.status ??
                            ""
                        );

                      return (
                        <tr
                          key={
                            load.id
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {
                              load.load_number
                            }
                          </td>

                          <td className="px-5 py-4">
                            {load.broker_name ||
                              load.brokers
                                ?.company_name ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            {formatDriverName(
                              load
                            )}
                          </td>

                          <td className="px-5 py-4">
                            {load
                              .trucks
                              ?.truck_number ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium">
                              {formatLocation(
                                load.pickup_city,
                                load.pickup_state
                              )}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(
                                load.pickup_date
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium">
                              {formatLocation(
                                load.delivery_city,
                                load.delivery_state
                              )}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(
                                load.delivery_date
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {formatMiles(
                              load.miles
                            )}
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {money(
                              loadRevenue(
                                load
                              )
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <LoadStatusBadge
                              status={
                                load.status ??
                                ""
                              }
                            />
                          </td>

                          {(canEdit ||
                            canAttemptDelete) && (
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditor(
                                        load
                                      )
                                    }
                                    className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                                  >
                                    Edit
                                  </button>
                                )}

                                {canAttemptDelete &&
                                  !locked && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDelete(
                                          load
                                        )
                                      }
                                      className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                                    >
                                      Delete
                                    </button>
                                  )}

                                {canAttemptDelete &&
                                  locked && (
                                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                                      History
                                      Locked
                                    </span>
                                  )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================================
// COMPONENTS / HELPERS
// ============================================================

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function Field({
  label,
  children,
}: {
  label?: string;
  children:
    React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="mb-2 block text-sm text-slate-600">
          {label}
        </label>
      )}

      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function money(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function loadRevenue(
  load: Load
) {
  return (
    Number(
      load.linehaul ?? 0
    ) +
    Number(
      load.detention ?? 0
    ) +
    Number(
      load.layover ?? 0
    ) +
    Number(
      load.lumper ?? 0
    ) +
    Number(
      load.other_charges ??
        0
    )
  );
}

function formatMiles(
  value?: number | null
) {
  return (
    value ?? 0
  ).toLocaleString();
}

function formatDriverName(
  load: Load
) {
  if (!load.drivers) {
    return "—";
  }

  const name = [
    load.drivers
      .first_name,
    load.drivers
      .last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "—";
}

function formatLocation(
  city?: string | null,
  state?: string | null
) {
  const parts = [
    city,
    state,
  ].filter(Boolean);

  return parts.length
    ? parts.join(", ")
    : "—";
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString();
}

function toDateTimeLocal(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const offset =
    date.getTimezoneOffset();

  const localDate =
    new Date(
      date.getTime() -
        offset * 60000
    );

  return localDate
    .toISOString()
    .slice(0, 16);
}

function LoadStatusBadge({
  status,
}: {
  status: string;
}) {
  const classes: Record<
    string,
    string
  > = {
    booked:
      "bg-sky-100 text-sky-700",

    dispatched:
      "bg-indigo-100 text-indigo-700",

    picked_up:
      "bg-purple-100 text-purple-700",

    in_transit:
      "bg-amber-100 text-amber-700",

    delivered:
      "bg-emerald-100 text-emerald-700",

    pod_received:
      "bg-teal-100 text-teal-700",

    invoiced:
      "bg-sky-50 text-sky-700",

    paid:
      "bg-emerald-100 text-emerald-700",

    cancelled:
      "bg-rose-50 text-rose-600",
  };

  const className =
    classes[status] ??
    "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {prettyStatus(
        status
      )}
    </span>
  );
}

function prettyStatus(
  status: string
) {
  if (!status) {
    return "—";
  }

  return status
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}