"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

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
  pay_type:
    | "percentage"
    | "per_mile"
    | "flat_rate"
    | "hourly";
  pay_rate: number | null;
  status:
    | "active"
    | "inactive"
    | "on_leave";
  hire_date?: string | null;
  notes?: string | null;
};

export default function DriversPage() {
  const supabase = createClient();

  const [drivers, setDrivers] =
    useState<Driver[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    invitingDriverId,
    setInvitingDriverId,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState("");

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
  ] = useState<string | null>(
    null
  );

  const [
    firstName,
    setFirstName,
  ] = useState("");

  const [
    lastName,
    setLastName,
  ] = useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [
    cdlNumber,
    setCdlNumber,
  ] = useState("");

  const [
    cdlState,
    setCdlState,
  ] = useState("");

  const [
    cdlExpiration,
    setCdlExpiration,
  ] = useState("");

  const [
    medicalCardExpiration,
    setMedicalCardExpiration,
  ] = useState("");

  const [
    payType,
    setPayType,
  ] =
    useState<Driver["pay_type"]>(
      "percentage"
    );

  const [
    payRate,
    setPayRate,
  ] = useState("");

  const [
    status,
    setStatus,
  ] =
    useState<Driver["status"]>(
      "active"
    );

  const [
    hireDate,
    setHireDate,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    "all" | Driver["status"]
  >("all");

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

      const {
        data,
        error: loadError,
      } =
        await supabase
          .from("drivers")
          .select("*")
          .order(
            "last_name",
            {
              ascending: true,
            }
          );

      if (loadError) {
        console.error(
          loadError
        );

        setError(
          "Failed to load drivers."
        );

        setDrivers([]);

        return;
      }

      setDrivers(
        (data as Driver[]) ??
          []
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not load drivers."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrivers();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function withinDays(
    dateStr?:
      | string
      | null,
    days = 30
  ) {
    if (!dateStr) {
      return false;
    }

    const dt =
      new Date(dateStr);

    if (
      Number.isNaN(
        dt.getTime()
      )
    ) {
      return false;
    }

    const now =
      new Date();

    const diff =
      dt.getTime() -
      now.getTime();

    return (
      diff >= 0 &&
      diff <=
        days *
          24 *
          60 *
          60 *
          1000
    );
  }

  function isExpired(
    dateStr?:
      | string
      | null
  ) {
    if (!dateStr) {
      return false;
    }

    const dt =
      new Date(dateStr);

    if (
      Number.isNaN(
        dt.getTime()
      )
    ) {
      return false;
    }

    return (
      dt.getTime() <
      Date.now()
    );
  }

  function formatPayRate(
    type: Driver["pay_type"],
    rate:
      | number
      | null
      | undefined
  ) {
    if (rate == null) {
      return "—";
    }

    if (
      type ===
      "percentage"
    ) {
      return `${rate}%`;
    }

    const formatted =
      new Intl.NumberFormat(
        "en-US",
        {
          style:
            "currency",
          currency: "USD",
          maximumFractionDigits:
            2,
        }
      ).format(rate);

    if (
      type ===
      "per_mile"
    ) {
      return `${formatted}/mi`;
    }

    if (
      type === "hourly"
    ) {
      return `${formatted}/hr`;
    }

    return formatted;
  }

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "Unable to determine authenticated user."
        );
      }

      const {
        data: profile,
        error: profileError,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(
            "company_id"
          )
          .eq(
            "id",
            user.id
          )
          .maybeSingle();

      if (
        profileError
      ) {
        console.error(
          profileError
        );

        throw new Error(
          "Could not determine company for user."
        );
      }

      const companyId =
        profile?.company_id ??
        null;

      if (!companyId) {
        throw new Error(
          "No company is assigned to this user."
        );
      }

      const payload = {
        first_name:
          firstName,

        last_name:
          lastName,

        phone:
          phone || null,

        email:
          email
            .trim()
            .toLowerCase() ||
          null,

        cdl_number:
          cdlNumber ||
          null,

        cdl_state:
          cdlState || null,

        cdl_expiration:
          cdlExpiration ||
          null,

        medical_card_expiration:
          medicalCardExpiration ||
          null,

        pay_type:
          payType,

        pay_rate:
          payRate
            ? Number(
                payRate
              )
            : null,

        status,

        hire_date:
          hireDate || null,

        notes:
          notes || null,
      };

      if (!isEditing) {
        const response = await fetch(
          "/api/drivers",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Failed to add driver."
          );
        }

        setSuccessMessage("Driver added.");
      } else {
        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              "drivers"
            )
            .update(
              payload
            )
            .eq(
              "id",
              editingId
            );

        if (
          updateError
        ) {
          console.error(
            updateError
          );

          throw new Error(
            updateError.message ||
              "Failed to update driver."
          );
        }

        setSuccessMessage(
          "Driver updated."
        );
      }

      resetForm();

      setShowForm(
        false
      );

      await loadDrivers();

      setTimeout(
        () =>
          setSuccessMessage(
            ""
          ),
        3000
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "An error occurred."
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditor(
    driver: Driver
  ) {
    setIsEditing(true);

    setEditingId(
      driver.id
    );

    setFirstName(
      driver.first_name ||
        ""
    );

    setLastName(
      driver.last_name ||
        ""
    );

    setPhone(
      driver.phone ?? ""
    );

    setEmail(
      driver.email ?? ""
    );

    setCdlNumber(
      driver.cdl_number ??
        ""
    );

    setCdlState(
      driver.cdl_state ??
        ""
    );

    setCdlExpiration(
      driver.cdl_expiration ??
        ""
    );

    setMedicalCardExpiration(
      driver.medical_card_expiration ??
        ""
    );

    setPayType(
      driver.pay_type
    );

    setPayRate(
      driver.pay_rate !=
      null
        ? String(
            driver.pay_rate
          )
        : ""
    );

    setStatus(
      driver.status
    );

    setHireDate(
      driver.hire_date ??
        ""
    );

    setNotes(
      driver.notes ?? ""
    );

    setShowForm(true);
  }

  async function handleDelete(
    id: string
  ) {
    if (
      !confirm(
        "Are you sure you want to delete this driver?"
      )
    ) {
      return;
    }

    try {
      setLoading(true);

      const {
        error:
          deleteError,
      } =
        await supabase
          .from("drivers")
          .delete()
          .eq("id", id);

      if (
        deleteError
      ) {
        console.error(
          deleteError
        );

        setError(
          "Failed to delete driver."
        );
      } else {
        setSuccessMessage(
          "Driver deleted."
        );

        setTimeout(
          () =>
            setSuccessMessage(
              ""
            ),
          3000
        );
      }

      await loadDrivers();
    } catch (err) {
      console.error(err);

      setError(
        "Failed to delete driver."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteDriver(
    driver: Driver
  ) {
    setError("");
    setSuccessMessage("");

    if (
      !driver.email
    ) {
      setError(
        "Add an email address to this driver before sending an invitation."
      );

      return;
    }

    if (
      driver.status !==
      "active"
    ) {
      setError(
        "Only active drivers can be invited."
      );

      return;
    }

    const confirmed =
      confirm(
        `Send a FleetOS Driver Portal invitation to ${driver.email}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setInvitingDriverId(
        driver.id
      );

      const response =
        await fetch(
          "/api/drivers/invite",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  driverId:
                    driver.id,
                }
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to invite driver."
        );
      }

      setSuccessMessage(
        `Driver invitation sent to ${driver.email}.`
      );

      setTimeout(
        () =>
          setSuccessMessage(
            ""
          ),
        5000
      );
    } catch (err) {
      console.error(
        "Driver invitation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to invite driver."
      );
    } finally {
      setInvitingDriverId(
        null
      );
    }
  }

  const filtered =
    drivers.filter(
      (driver) => {
        if (
          statusFilter !==
            "all" &&
          driver.status !==
            statusFilter
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const query =
          search.toLowerCase();

        return (
          driver.first_name
            .toLowerCase()
            .includes(
              query
            ) ||
          driver.last_name
            .toLowerCase()
            .includes(
              query
            ) ||
          (
            driver.phone ||
            ""
          )
            .toLowerCase()
            .includes(
              query
            ) ||
          (
            driver.email ||
            ""
          )
            .toLowerCase()
            .includes(
              query
            ) ||
          (
            driver.cdl_number ||
            ""
          )
            .toLowerCase()
            .includes(
              query
            )
        );
      }
    );

  const totals = {
    total:
      drivers.length,

    active:
      drivers.filter(
        (driver) =>
          driver.status ===
          "active"
      ).length,

    onLeave:
      drivers.filter(
        (driver) =>
          driver.status ===
          "on_leave"
      ).length,

    inactive:
      drivers.filter(
        (driver) =>
          driver.status ===
          "inactive"
      ).length,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Drivers
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-slate-950">
              Drivers
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Manage
              drivers, pay
              rates, CDL
              information,
              compliance
              dates and
              Driver Portal
              access.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <input
                placeholder="Search first, last, phone, email, CDL"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event
                      .target
                      .value
                  )
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
              />
            </div>

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event
                    .target
                    .value as
                    | "all"
                    | Driver["status"]
                )
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
            >
              <option value="all">
                All
              </option>

              <option value="active">
                Active
              </option>

              <option value="on_leave">
                On Leave
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>

            <button
              type="button"
              onClick={() => {
                resetForm();

                setShowForm(
                  (value) =>
                    !value
                );
              }}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + Add Driver
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {
              successMessage
            }
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Total Drivers
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {
                totals.total
              }
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Active
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {
                totals.active
              }
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              On Leave
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {
                totals.onLeave
              }
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">
              Inactive
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {
                totals.inactive
              }
            </p>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={
              handleSubmit
            }
            className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">
                {isEditing
                  ? "Edit Driver"
                  : "Add Driver"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(
                    false
                  );
                }}
                className="rounded-2xl bg-slate-100 px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <input
                required
                value={
                  firstName
                }
                onChange={(
                  event
                ) =>
                  setFirstName(
                    event
                      .target
                      .value
                  )
                }
                placeholder="First Name"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                required
                value={
                  lastName
                }
                onChange={(
                  event
                ) =>
                  setLastName(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Last Name"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={
                  phone
                }
                onChange={(
                  event
                ) =>
                  setPhone(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Phone"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                type="email"
                value={
                  email
                }
                onChange={(
                  event
                ) =>
                  setEmail(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Email"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={
                  cdlNumber
                }
                onChange={(
                  event
                ) =>
                  setCdlNumber(
                    event
                      .target
                      .value
                  )
                }
                placeholder="CDL Number"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={
                  cdlState
                }
                onChange={(
                  event
                ) =>
                  setCdlState(
                    event
                      .target
                      .value
                  )
                }
                placeholder="CDL State"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <div>
                <label className="mb-2 block text-sm text-slate-600">
                  CDL
                  Expiration
                </label>

                <input
                  type="date"
                  value={
                    cdlExpiration
                  }
                  onChange={(
                    event
                  ) =>
                    setCdlExpiration(
                      event
                        .target
                        .value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-600">
                  Medical
                  Card
                  Expiration
                </label>

                <input
                  type="date"
                  value={
                    medicalCardExpiration
                  }
                  onChange={(
                    event
                  ) =>
                    setMedicalCardExpiration(
                      event
                        .target
                        .value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <select
                value={
                  payType
                }
                onChange={(
                  event
                ) =>
                  setPayType(
                    event
                      .target
                      .value as Driver["pay_type"]
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="percentage">
                  percentage
                </option>

                <option value="per_mile">
                  per_mile
                </option>

                <option value="flat_rate">
                  flat_rate
                </option>

                <option value="hourly">
                  hourly
                </option>
              </select>

              <input
                type="number"
                step="0.01"
                value={
                  payRate
                }
                onChange={(
                  event
                ) =>
                  setPayRate(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Pay Rate"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <select
                value={
                  status
                }
                onChange={(
                  event
                ) =>
                  setStatus(
                    event
                      .target
                      .value as Driver["status"]
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="active">
                  active
                </option>

                <option value="on_leave">
                  on_leave
                </option>

                <option value="inactive">
                  inactive
                </option>
              </select>

              <input
                type="date"
                value={
                  hireDate
                }
                onChange={(
                  event
                ) =>
                  setHireDate(
                    event
                      .target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <textarea
                value={
                  notes
                }
                onChange={(
                  event
                ) =>
                  setNotes(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Notes"
                className="col-span-full rounded-xl border border-slate-300 px-4 py-3"
                rows={3}
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                disabled={
                  saving
                }
                type="submit"
                className="rounded-2xl bg-slate-950 px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Update Driver"
                    : "Save Driver"}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();

                  setShowForm(
                    false
                  );
                }}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Driver Roster
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Invite an
              active driver
              to create their
              own FleetOS
              Driver Portal
              login.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">
              Loading
              drivers...
            </div>
          ) : filtered.length ===
            0 ? (
            <div className="p-8 text-slate-500">
              No drivers
              found. Add your
              first driver to
              get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-4 pr-6">
                      Name
                    </th>

                    <th className="py-4 pr-6">
                      Phone
                    </th>

                    <th className="py-4 pr-6">
                      Email
                    </th>

                    <th className="py-4 pr-6">
                      CDL #
                    </th>

                    <th className="py-4 pr-6">
                      CDL
                      State
                    </th>

                    <th className="py-4 pr-6">
                      CDL Exp
                    </th>

                    <th className="py-4 pr-6">
                      Medical
                      Card
                    </th>

                    <th className="py-4 pr-6">
                      Pay Type
                    </th>

                    <th className="py-4 pr-6">
                      Pay Rate
                    </th>

                    <th className="py-4 pr-6">
                      Status
                    </th>

                    <th className="py-4">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filtered.map(
                    (
                      driver
                    ) => {
                      const inviting =
                        invitingDriverId ===
                        driver.id;

                      const canInvite =
                        driver.status ===
                          "active" &&
                        Boolean(
                          driver.email
                        );

                      return (
                        <tr
                          key={
                            driver.id
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="py-4 pr-6 font-medium">
                            {
                              driver.first_name
                            }{" "}
                            {
                              driver.last_name
                            }
                          </td>

                          <td className="py-4 pr-6">
                            {driver.phone ||
                              "—"}
                          </td>

                          <td className="py-4 pr-6">
                            {driver.email ||
                              "—"}
                          </td>

                          <td className="py-4 pr-6">
                            {driver.cdl_number ||
                              "—"}
                          </td>

                          <td className="py-4 pr-6">
                            {driver.cdl_state ||
                              "—"}
                          </td>

                          <td className="py-4 pr-6">
                            <span
                              className={
                                isExpired(
                                  driver.cdl_expiration
                                )
                                  ? "font-semibold text-rose-600"
                                  : withinDays(
                                        driver.cdl_expiration
                                      )
                                    ? "font-semibold text-amber-600"
                                    : "text-slate-700"
                              }
                            >
                              {driver.cdl_expiration
                                ? new Date(
                                    driver.cdl_expiration
                                  ).toLocaleDateString()
                                : "—"}
                            </span>
                          </td>

                          <td className="py-4 pr-6">
                            <span
                              className={
                                isExpired(
                                  driver.medical_card_expiration
                                )
                                  ? "font-semibold text-rose-600"
                                  : withinDays(
                                        driver.medical_card_expiration
                                      )
                                    ? "font-semibold text-amber-600"
                                    : "text-slate-700"
                              }
                            >
                              {driver.medical_card_expiration
                                ? new Date(
                                    driver.medical_card_expiration
                                  ).toLocaleDateString()
                                : "—"}
                            </span>
                          </td>

                          <td className="py-4 pr-6">
                            {
                              driver.pay_type
                            }
                          </td>

                          <td className="py-4 pr-6 font-medium">
                            {formatPayRate(
                              driver.pay_type,
                              driver.pay_rate
                            )}
                          </td>

                          <td className="py-4 pr-6">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                driver.status ===
                                "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : driver.status ===
                                      "on_leave"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {
                                driver.status
                              }
                            </span>
                          </td>

                          <td className="py-4 pr-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditor(
                                    driver
                                  )
                                }
                                className="rounded-2xl bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleInviteDriver(
                                    driver
                                  )
                                }
                                disabled={
                                  !canInvite ||
                                  inviting
                                }
                                title={
                                  !driver.email
                                    ? "Add a driver email first"
                                    : driver.status !==
                                        "active"
                                      ? "Only active drivers can be invited"
                                      : "Send Driver Portal invitation"
                                }
                                className="rounded-2xl bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {inviting
                                  ? "Sending..."
                                  : "Invite Driver"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleDelete(
                                    driver.id
                                  )
                                }
                                className="rounded-2xl bg-rose-50 px-3 py-1 text-sm text-rose-600 hover:bg-rose-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
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