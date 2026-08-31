"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getAuthRole,
  roleLabel,
  type AuthRoleContext,
} from "@/lib/auth-role";

type DriverRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
};

type DriverLoad = {
  id: string;
  load_number: string;
  pickup_location: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_date: string | null;
  delivery_location: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_date: string | null;
  status: string;
  truck_id: string | null;
  trailer_id: string | null;
};

type Settlement = {
  id: string;
  settlement_number: string;
  period_start: string;
  period_end: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status: string;
  paid_date: string | null;
};

export default function DriverPage() {
  const router = useRouter();
  const supabase = createClient();

  const [auth, setAuth] = useState<AuthRoleContext | null>(null);
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [loads, setLoads] = useState<DriverLoad[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    void loadDriverPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDriverPortal() {
    setLoading(true);
    setError("");

    try {
      const authContext = await getAuthRole(supabase);

      if (!authContext) {
        router.replace("/login");
        return;
      }

      if (authContext.role !== "driver") {
        router.replace("/");
        return;
      }

      if (!authContext.driverId) {
        throw new Error(
          "Your FleetOS login is not linked to a driver record."
        );
      }

      setAuth(authContext);

      const [
        driverResult,
        loadsResult,
        settlementsResult,
      ] = await Promise.all([
        supabase
          .from("drivers")
          .select(`
            id,
            first_name,
            last_name,
            email,
            phone,
            status
          `)
          .eq("id", authContext.driverId)
          .maybeSingle(),

        supabase
          .from("loads")
          .select(`
            id,
            load_number,
            pickup_location,
            pickup_city,
            pickup_state,
            pickup_date,
            delivery_location,
            delivery_city,
            delivery_state,
            delivery_date,
            status,
            truck_id,
            trailer_id
          `)
          .order("pickup_date", { ascending: true }),

        supabase
          .from("driver_settlements")
          .select(`
            id,
            settlement_number,
            period_start,
            period_end,
            gross_pay,
            total_deductions,
            net_pay,
            status,
            paid_date
          `)
          .order("period_end", { ascending: false })
          .limit(5),
      ]);

      if (driverResult.error) {
        console.error(
          "Driver profile query error:",
          driverResult.error
        );
        throw driverResult.error;
      }

      if (loadsResult.error) {
        console.error(
          "Driver loads query error:",
          loadsResult.error
        );
        throw loadsResult.error;
      }

      if (settlementsResult.error) {
        console.error(
          "Driver settlements query error:",
          settlementsResult.error
        );
        throw settlementsResult.error;
      }

      setDriver(
        driverResult.data as DriverRecord | null
      );

      setLoads(
        (loadsResult.data ?? []) as unknown as DriverLoad[]
      );

      setSettlements(
        (settlementsResult.data ?? []) as unknown as Settlement[]
      );
    } catch (err) {
      console.error("Driver portal load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the driver portal."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        console.error(
          "Driver logout error:",
          signOutError
        );
        throw signOutError;
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      setLoggingOut(false);
    }
  }

  const driverName = useMemo(() => {
    if (!driver) {
      return "Driver";
    }

    const name = [
      driver.first_name,
      driver.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return name || "Driver";
  }, [driver]);

  const activeLoads = useMemo(() => {
  const activeStatuses = [
    "booked",
    "dispatched",
    "picked_up",
    "in_transit",
  ];

  return loads.filter((load) =>
    activeStatuses.includes(load.status)
  );
}, [loads]);

const deliveredLoads = useMemo(() => {
  const completedStatuses = [
    "delivered",
    "pod_received",
    "invoiced",
    "paid",
  ];

  return loads.filter((load) =>
    completedStatuses.includes(load.status)
  );
}, [loads]);

  const latestSettlement = settlements[0] ?? null;

  function formatLocation(
    location: string | null,
    city: string | null,
    state: string | null
  ) {
    if (location) {
      return location;
    }

    const parts = [city, state].filter(Boolean);

    return parts.length
      ? parts.join(", ")
      : "—";
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  }

  function money(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-6xl">
          Loading Driver Portal...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
              FleetOS
            </p>

            <h1 className="mt-1 text-2xl font-bold">
              Driver Portal
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold">
                {driverName}
              </p>

              <p className="text-xs text-slate-300">
                {roleLabel(auth?.role)}
              </p>
            </div>

            <button
              type="button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section>
          <p className="text-sm font-medium text-slate-500">
            Welcome back
          </p>

          <h2 className="mt-1 text-3xl font-bold text-slate-950">
            {driverName}
          </h2>

          <p className="mt-2 text-slate-600">
            View your assigned loads, delivery information,
            documents and pay.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Active Loads"
            value={String(activeLoads.length)}
          />

          <SummaryCard
            label="Delivered Loads"
            value={String(deliveredLoads.length)}
          />

          <SummaryCard
            label="Latest Net Pay"
            value={
              latestSettlement
                ? money(Number(latestSettlement.net_pay))
                : "$0.00"
            }
          />

          <SummaryCard
            label="Driver Status"
            value={driver?.status ?? "—"}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-xl font-bold text-slate-950">
              My Loads
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Only loads assigned to your driver account are shown.
            </p>
          </div>

          {loads.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              No loads are currently assigned to you.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {loads.map((load) => (
                <div
                  key={load.id}
                  className="grid gap-5 px-6 py-6 lg:grid-cols-[140px_1fr_1fr_160px]"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Load #
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {load.load_number}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Pickup
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {formatLocation(
                        load.pickup_location,
                        load.pickup_city,
                        load.pickup_state
                      )}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(load.pickup_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Delivery
                    </p>

                    <p className="mt-1 font-semibold text-slate-800">
                      {formatLocation(
                        load.delivery_location,
                        load.delivery_city,
                        load.delivery_state
                      )}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(load.delivery_date)}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <StatusBadge status={load.status} />

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/driver/load/${load.id}`
                        )
                      }
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      View Load
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-xl font-bold text-slate-950">
              My Recent Pay
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Only your own settlement records are shown.
            </p>
          </div>

          {settlements.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              No settlement records are available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">
                      Settlement
                    </th>

                    <th className="px-6 py-3">
                      Period
                    </th>

                    <th className="px-6 py-3">
                      Gross
                    </th>

                    <th className="px-6 py-3">
                      Deductions
                    </th>

                    <th className="px-6 py-3">
                      Net Pay
                    </th>

                    <th className="px-6 py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {settlements.map((settlement) => (
                    <tr key={settlement.id}>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {settlement.settlement_number}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {new Date(
                          `${settlement.period_start}T00:00:00`
                        ).toLocaleDateString()}
                        {" - "}
                        {new Date(
                          `${settlement.period_end}T00:00:00`
                        ).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {money(
                          Number(settlement.gross_pay)
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {money(
                          Number(
                            settlement.total_deductions
                          )
                        )}
                      </td>

                      <td className="px-6 py-4 font-bold text-slate-950">
                        {money(
                          Number(settlement.net_pay)
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge
                          status={settlement.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (
    status === "active" ||
    status === "delivered" ||
    status === "paid"
  ) {
    classes =
      "bg-emerald-100 text-emerald-700";
  } else if (
    status === "booked" ||
    status === "in_transit"
  ) {
    classes =
      "bg-blue-100 text-blue-700";
  } else if (
    status === "maintenance" ||
    status === "pending"
  ) {
    classes =
      "bg-amber-100 text-amber-700";
  } else if (
    status === "cancelled" ||
    status === "inactive"
  ) {
    classes =
      "bg-red-100 text-red-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}