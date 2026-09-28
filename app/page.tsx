"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import FleetOSBrand from "@/components/FleetOSBrand";
import FleetOSShell from "@/components/FleetOSShell";

import { createClient } from "@/lib/supabase/client";

import {
  getAuthRole,
  roleLabel,
  type AuthRoleContext,
} from "@/lib/auth-role";

/* ============================================================
   TYPES
============================================================ */

type TruckProfitability = {
  truckId: string;
  truckNumber: string;
  status: string;
  revenue: number;
  expenses: number;
  payroll: number;
  netProfit: number;
};

type RecentInvoice = {
  id: string;
  invoiceNumber: string;
  broker: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  status: string;
};

type RecentLoad = {
  id: string;
  loadNumber: string;
  broker: string;
  driver: string;
  truck: string;
  pickup: string;
  pickupDate: string | null;
  delivery: string;
  deliveryDate: string | null;
  revenue: number;
  status: string;
};

type DashboardData = {
  activeTrucks: number;
  availableTrucks: number;
  maintenanceTrucks: number;
  inactiveTrucks: number;

  activeLoads: number;
  deliveredLoads: number;
  awaitingPod: number;
  invoicedLoads: number;

  totalRevenue: number;
  driverPayroll: number;
  operatingExpenses: number;
  netProfit: number;

  dispatcherWeeklyRevenue: number;
  dispatcherMonthlyRevenue: number;
  dispatcherWeekStart: string;
  dispatcherWeekEnd: string;
  dispatcherMonthStart: string;
  dispatcherMonthEnd: string;

  outstandingReceivables: number;
  overdueReceivables: number;
  dueThisWeek: number;

  recentInvoices: RecentInvoice[];
  recentLoads: RecentLoad[];
  truckProfitability: TruckProfitability[];
};

/* ============================================================
   PAGE
============================================================ */

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = useMemo(() => createClient(), []);

  const [loggingOut, setLoggingOut] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  const [authContext, setAuthContext] =
    useState<AuthRoleContext | null>(null);

  const [userFullName, setUserFullName] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [dashboardData, setDashboardData] =
    useState<DashboardData>({
      activeTrucks: 0,
      availableTrucks: 0,
      maintenanceTrucks: 0,
      inactiveTrucks: 0,

      activeLoads: 0,
      deliveredLoads: 0,
      awaitingPod: 0,
      invoicedLoads: 0,

      totalRevenue: 0,
      driverPayroll: 0,
      operatingExpenses: 0,
      netProfit: 0,

      dispatcherWeeklyRevenue: 0,
      dispatcherMonthlyRevenue: 0,
      dispatcherWeekStart: "",
      dispatcherWeekEnd: "",
      dispatcherMonthStart: "",
      dispatcherMonthEnd: "",

      outstandingReceivables: 0,
      overdueReceivables: 0,
      dueThisWeek: 0,

      recentInvoices: [],
      recentLoads: [],
      truckProfitability: [],
    });

  /* ============================================================
     ROLE HELPERS
  ============================================================ */

  const isDispatcher = authContext?.role === "dispatcher";
  const isAccountant = authContext?.role === "accountant";

  const canViewFullFinancialDashboard =
    authContext?.role === "owner" ||
    authContext?.role === "admin" ||
    authContext?.role === "accountant";

  const canViewFleet =
    authContext?.role === "owner" ||
    authContext?.role === "admin" ||
    authContext?.role === "dispatcher" ||
    authContext?.role === "fleet_manager";

  /* ============================================================
     FORMATTERS
  ============================================================ */

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

 function navigate(path: string | undefined) {
  if (!path) {
    return;
  }

  router.push(path);
}

  /* ============================================================
     LOGOUT
  ============================================================ */

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  }

  /* ============================================================
     LOAD DASHBOARD
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    async function initializeDashboard() {
      try {
        const auth = await getAuthRole(supabase);

        if (!mounted) return;

        if (!auth) {
          router.replace("/login");
          return;
        }

        if (auth.role === "driver") {
          router.replace("/driver");
          return;
        }

        setAuthContext(auth);

        const [profileResult, companyResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("id", auth.userId)
              .maybeSingle(),

            supabase
              .from("companies")
              .select("name")
              .eq("id", auth.companyId)
              .maybeSingle(),
          ]);

        if (profileResult.error) {
          console.error(
            "Unable to load profile:",
            profileResult.error
          );
        }

        if (companyResult.error) {
          console.error(
            "Unable to load company:",
            companyResult.error
          );
        }

        if (!mounted) return;

        setUserFullName(
          profileResult.data?.full_name?.trim() ||
            auth.email ||
            "FleetOS User"
        );

        setCompanyName(
          companyResult.data?.name?.trim() || "FleetOS"
        );

        const response = await fetch("/api/dashboard", {
          cache: "no-store",
        });

        if (!response.ok) {
          console.error(
            "Failed to fetch dashboard:",
            response.status
          );
          return;
        }

        const data = await response.json();

        if (!mounted) return;

        setDashboardData((previous) => ({
          ...previous,
          ...data,

          recentInvoices: Array.isArray(data.recentInvoices)
            ? data.recentInvoices
            : [],

          recentLoads: Array.isArray(data.recentLoads)
            ? data.recentLoads
            : [],

          truckProfitability: Array.isArray(
            data.truckProfitability
          )
            ? data.truckProfitability
            : [],
        }));
      } catch (error) {
        console.error(
          "Error initializing FleetOS dashboard:",
          error
        );
      } finally {
        if (mounted) {
          setCheckingRole(false);
        }
      }
    }

    void initializeDashboard();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  /* ============================================================
     DERIVED DASHBOARD VALUES
  ============================================================ */

  const firstName =
    userFullName.trim().split(/\s+/)[0] || "there";

  const totalLoadStatus =
    dashboardData.activeLoads +
    dashboardData.deliveredLoads +
    dashboardData.awaitingPod +
    dashboardData.invoicedLoads;

  const deliveredPercent =
    totalLoadStatus > 0
      ? Math.round(
          (dashboardData.deliveredLoads /
            totalLoadStatus) *
            100
        )
      : 0;

  const activePercent =
    totalLoadStatus > 0
      ? Math.round(
          (dashboardData.activeLoads /
            totalLoadStatus) *
            100
        )
      : 0;

  const podPercent =
    totalLoadStatus > 0
      ? Math.round(
          (dashboardData.awaitingPod /
            totalLoadStatus) *
            100
        )
      : 0;

  const invoicedPercent =
    totalLoadStatus > 0
      ? Math.max(
          0,
          100 -
            deliveredPercent -
            activePercent -
            podPercent
        )
      : 0;

  const financialMaximum = Math.max(
    dashboardData.totalRevenue,
    dashboardData.driverPayroll,
    dashboardData.operatingExpenses,
    Math.abs(dashboardData.netProfit),
    1
  );

  /* ============================================================
     LOADING
  ============================================================ */

  if (checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/30">
            <span className="text-xl font-bold">F</span>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
            FleetOS
          </p>

          <p className="mt-2 text-lg font-semibold">
            Loading your command center...
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     DASHBOARD
  ============================================================ */

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="relative lg:flex lg:items-stretch">
        <FleetOSShell
          companyName={companyName}
          userFullName={userFullName}
          role={authContext?.role}
          pathname={pathname}
          loggingOut={loggingOut}
          onNavigate={navigate}
          onLogout={handleLogout}
        />

        <main className="min-w-0 flex-1 bg-[#f4f7fb]">
          {/* ==================================================
              TOP COMMAND BAR
          ================================================== */}

          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
            <div className="flex min-h-[74px] items-center gap-4 px-4 sm:px-6 lg:px-8">
              <div className="hidden min-w-0 flex-1 md:block">
                <div className="relative max-w-xl">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path
                      d="m20 20-3.5-3.5"
                      strokeLinecap="round"
                    />
                  </svg>

                  <input
                    type="search"
                    placeholder="Search loads, drivers, trucks, invoices..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 21h4"
                      strokeLinecap="round"
                    />
                  </svg>

                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/account")}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-sm">
                    {(userFullName || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[170px] truncate text-sm font-semibold text-slate-900">
                      {userFullName || "FleetOS User"}
                    </span>

                    <span className="block text-xs text-slate-500">
                      {roleLabel(authContext?.role)}
                    </span>
                  </span>

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="hidden h-4 w-4 text-slate-400 sm:block"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
            {/* ==================================================
                HERO
            ================================================== */}

            <section className="relative min-h-[330px] overflow-hidden rounded-[28px] bg-[#07172b] shadow-[0_18px_50px_rgba(15,23,42,0.14)] sm:min-h-[360px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('/branding/fleetos-dashboard-hero.png')",
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-r from-[#061426]/95 via-[#07182c]/72 to-[#07182c]/10" />

              <div className="absolute inset-0 bg-gradient-to-t from-[#071426]/60 via-transparent to-transparent" />

              <div className="relative z-10 flex min-h-[330px] max-w-3xl flex-col justify-center px-6 pb-24 pt-10 sm:min-h-[360px] sm:px-10 lg:px-14">
                <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Fleet command center
                </div>

                <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[46px] lg:leading-[1.08]">
                  Welcome back, {firstName}
                </h1>

                <p className="mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
                  Manage your fleet. Move your business forward.
                </p>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  {isDispatcher
                    ? "Stay on top of active loads, deliveries, drivers, and dispatch revenue."
                    : isAccountant
                      ? "Track revenue, expenses, receivables, payroll, and fleet profitability."
                      : canViewFullFinancialDashboard
                        ? "Your live operations and financial performance are together in one place."
                        : "Monitor fleet readiness, drivers, equipment, and daily operations."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {!isAccountant ? (
                    <button
                      type="button"
                      onClick={() => navigate("/loads")}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500"
                    >
                      View Loads

                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          d="M5 12h14M13 6l6 6-6 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : null}

                  {canViewFullFinancialDashboard ? (
                    <button
                      type="button"
                      onClick={() => navigate("/invoices")}
                      className="inline-flex h-11 items-center rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      View Finance
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            {/* ==================================================
                OVERLAPPING KPI CARDS
            ================================================== */}

            <section className="relative z-10 -mt-16 grid gap-4 px-2 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
              <DashboardKpiCard
                title="Active Trucks"
                value={String(dashboardData.activeTrucks)}
                subtitle={`${dashboardData.availableTrucks} available`}
                tone="blue"
                icon="truck"
              />

              <DashboardKpiCard
                title="Active Loads"
                value={String(dashboardData.activeLoads)}
                subtitle={`${dashboardData.awaitingPod} awaiting POD`}
                tone="cyan"
                icon="load"
              />

              <DashboardKpiCard
                title="Delivered"
                value={String(dashboardData.deliveredLoads)}
                subtitle="Completed loads"
                tone="green"
                icon="check"
              />

              <DashboardKpiCard
                title={
                  isDispatcher
                    ? "Monthly Revenue"
                    : canViewFullFinancialDashboard
                      ? "Total Revenue"
                      : "Fleet Ready"
                }
                value={
                  isDispatcher
                    ? formatCurrency(
                        dashboardData.dispatcherMonthlyRevenue
                      )
                    : canViewFullFinancialDashboard
                      ? formatCurrency(
                          dashboardData.totalRevenue
                        )
                      : String(
                          dashboardData.activeTrucks +
                            dashboardData.availableTrucks
                        )
                }
                subtitle={
                  isDispatcher
                    ? "Pickup-based revenue"
                    : canViewFullFinancialDashboard
                      ? "Current financial data"
                      : "Active + available"
                }
                tone="purple"
                icon="revenue"
              />
            </section>

            {/* ==================================================
                MAIN CONTENT GRID
            ================================================== */}

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.65fr)]">
              {/* ==================================================
                  RECENT LOADS
              ================================================== */}

              {!isAccountant ? (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Recent Loads
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Latest fleet activity and load status
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("/loads")}
                      className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                    >
                      View All
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-5 py-4 sm:px-6">
                            Load
                          </th>

                          <th className="px-5 py-4">
                            Driver / Truck
                          </th>

                          <th className="px-5 py-4">
                            Route
                          </th>

                          <th className="px-5 py-4">
                            Rate
                          </th>

                          <th className="px-5 py-4">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {dashboardData.recentLoads.length > 0 ? (
                          dashboardData.recentLoads
                            .slice(0, 6)
                            .map((load) => (
                              <tr
                                key={load.id}
                                className="transition hover:bg-slate-50/80"
                              >
                                <td className="px-5 py-4 sm:px-6">
                                  <div className="font-semibold text-slate-900">
                                    {load.loadNumber}
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    {load.broker || "—"}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="font-medium text-slate-800">
                                    {load.driver || "Unassigned"}
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    Truck {load.truck || "—"}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="max-w-[230px]">
                                    <div className="truncate font-medium text-slate-800">
                                      {load.pickup || "—"}
                                    </div>

                                    <div className="my-1 flex items-center gap-2 text-xs text-slate-400">
                                      <span>
                                        {formatDate(
                                          load.pickupDate
                                        )}
                                      </span>

                                      <span>→</span>

                                      <span>
                                        {formatDate(
                                          load.deliveryDate
                                        )}
                                      </span>
                                    </div>

                                    <div className="truncate text-xs text-slate-500">
                                      {load.delivery || "—"}
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-4 font-semibold text-slate-900">
                                  {formatCurrency(
                                    load.revenue
                                  )}
                                </td>

                                <td className="px-5 py-4">
                                  <LoadStatusBadge
                                    status={load.status}
                                  />
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-6 py-16 text-center"
                            >
                              <EmptyState
                                title="No recent loads"
                                description="New load activity will appear here."
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <ReceivablesPanel
                  data={dashboardData}
                  formatCurrency={formatCurrency}
                  navigate={navigate}
                />
              )}

              {/* ==================================================
                  RIGHT COLUMN
              ================================================== */}

              <div className="grid gap-6">
                {/* LOAD STATUS */}

                {!isAccountant ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          Load Status
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Current operations
                        </p>
                      </div>

                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                        Live
                      </span>
                    </div>

                    <div className="mt-6 flex items-center justify-center">
                      <div
                        className="relative flex h-44 w-44 items-center justify-center rounded-full"
                        style={{
                          background:
                            totalLoadStatus > 0
                              ? `conic-gradient(
                                  #2563eb 0% ${activePercent}%,
                                  #10b981 ${activePercent}% ${
                                    activePercent +
                                    deliveredPercent
                                  }%,
                                  #f59e0b ${
                                    activePercent +
                                    deliveredPercent
                                  }% ${
                                    activePercent +
                                    deliveredPercent +
                                    podPercent
                                  }%,
                                  #8b5cf6 ${
                                    activePercent +
                                    deliveredPercent +
                                    podPercent
                                  }% 100%
                                )`
                              : "#e2e8f0",
                        }}
                      >
                        <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
                          <span className="text-3xl font-bold text-slate-900">
                            {totalLoadStatus}
                          </span>

                          <span className="mt-1 text-xs font-medium text-slate-500">
                            Total Loads
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <StatusLegend
                        color="bg-blue-600"
                        label="Active"
                        value={dashboardData.activeLoads}
                      />

                      <StatusLegend
                        color="bg-emerald-500"
                        label="Delivered"
                        value={dashboardData.deliveredLoads}
                      />

                      <StatusLegend
                        color="bg-amber-500"
                        label="Awaiting POD"
                        value={dashboardData.awaitingPod}
                      />

                      <StatusLegend
                        color="bg-violet-500"
                        label="Invoiced"
                        value={dashboardData.invoicedLoads}
                      />
                    </div>
                  </section>
                ) : null}

                {/* FLEET STATUS */}

                {canViewFleet ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          Fleet Status
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Vehicle readiness
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate("/trucks")}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Fleet
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      <FleetStatusRow
                        label="Active"
                        value={dashboardData.activeTrucks}
                        dotClass="bg-emerald-500"
                      />

                      <FleetStatusRow
                        label="Available"
                        value={dashboardData.availableTrucks}
                        dotClass="bg-blue-500"
                      />

                      <FleetStatusRow
                        label="Maintenance"
                        value={dashboardData.maintenanceTrucks}
                        dotClass="bg-amber-500"
                      />

                      <FleetStatusRow
                        label="Inactive"
                        value={dashboardData.inactiveTrucks}
                        dotClass="bg-slate-400"
                      />
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            {/* ==================================================
                SECOND ROW
            ================================================== */}

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {/* FINANCIAL OVERVIEW */}

              {canViewFullFinancialDashboard ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Revenue Overview
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Revenue, payroll, expenses and profit
                      </p>
                    </div>

                    <span className="w-fit rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      Current Data
                    </span>
                  </div>

                  <div className="mt-8 grid h-[230px] grid-cols-4 items-end gap-4 sm:gap-7">
                    <FinancialBar
                      label="Revenue"
                      value={dashboardData.totalRevenue}
                      maximum={financialMaximum}
                      barClass="bg-blue-600"
                      formattedValue={formatCurrency(
                        dashboardData.totalRevenue
                      )}
                    />

                    <FinancialBar
                      label="Payroll"
                      value={dashboardData.driverPayroll}
                      maximum={financialMaximum}
                      barClass="bg-cyan-500"
                      formattedValue={formatCurrency(
                        dashboardData.driverPayroll
                      )}
                    />

                    <FinancialBar
                      label="Expenses"
                      value={dashboardData.operatingExpenses}
                      maximum={financialMaximum}
                      barClass="bg-amber-500"
                      formattedValue={formatCurrency(
                        dashboardData.operatingExpenses
                      )}
                    />

                    <FinancialBar
                      label="Profit"
                      value={Math.abs(
                        dashboardData.netProfit
                      )}
                      maximum={financialMaximum}
                      barClass={
                        dashboardData.netProfit >= 0
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                      }
                      formattedValue={formatCurrency(
                        dashboardData.netProfit
                      )}
                    />
                  </div>
                </section>
              ) : isDispatcher ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Dispatch Revenue
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Pickup-based revenue performance
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <MiniMetric
                      label="This Week"
                      value={formatCurrency(
                        dashboardData.dispatcherWeeklyRevenue
                      )}
                      description="Weekly pickup revenue"
                    />

                    <MiniMetric
                      label="This Month"
                      value={formatCurrency(
                        dashboardData.dispatcherMonthlyRevenue
                      )}
                      description="Monthly pickup revenue"
                    />
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Operations Overview
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Current fleet activity
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <MiniMetric
                      label="Active Trucks"
                      value={String(
                        dashboardData.activeTrucks
                      )}
                      description="Currently active"
                    />

                    <MiniMetric
                      label="Available Trucks"
                      value={String(
                        dashboardData.availableTrucks
                      )}
                      description="Ready for assignment"
                    />
                  </div>
                </section>
              )}

              {/* PROFITABILITY / QUICK OPERATIONS */}

              {canViewFullFinancialDashboard ? (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Truck Performance
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Revenue vs operating cost
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("/trucks")}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      View Fleet
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-6 py-4">
                            Truck
                          </th>

                          <th className="px-4 py-4">
                            Revenue
                          </th>

                          <th className="px-4 py-4">
                            Cost
                          </th>

                          <th className="px-4 py-4">
                            Profit
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {dashboardData.truckProfitability.length >
                        0 ? (
                          dashboardData.truckProfitability
                            .slice(0, 5)
                            .map((truck) => (
                              <tr
                                key={truck.truckId}
                                className="hover:bg-slate-50"
                              >
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-slate-900">
                                    {truck.truckNumber}
                                  </div>

                                  <div className="mt-1">
                                    <TruckStatusBadge
                                      status={truck.status}
                                    />
                                  </div>
                                </td>

                                <td className="px-4 py-4 text-slate-700">
                                  {formatCurrency(
                                    truck.revenue
                                  )}
                                </td>

                                <td className="px-4 py-4 text-slate-700">
                                  {formatCurrency(
                                    truck.expenses +
                                      truck.payroll
                                  )}
                                </td>

                                <td
                                  className={`px-4 py-4 font-semibold ${
                                    truck.netProfit >= 0
                                      ? "text-emerald-600"
                                      : "text-rose-600"
                                  }`}
                                >
                                  {formatCurrency(
                                    truck.netProfit
                                  )}
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-14 text-center"
                            >
                              <EmptyState
                                title="No truck performance data"
                                description="Profitability data will appear as fleet activity is recorded."
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <QuickActions
                  role={authContext?.role}
                  navigate={navigate}
                />
              )}
            </div>

            {/* ==================================================
                RECEIVABLES
            ================================================== */}

            {canViewFullFinancialDashboard &&
            !isAccountant ? (
              <div className="mt-6">
                <ReceivablesPanel
                  data={dashboardData}
                  formatCurrency={formatCurrency}
                  navigate={navigate}
                />
              </div>
            ) : null}

            {/* ==================================================
                QUICK ACTIONS
            ================================================== */}

            {!isAccountant &&
            canViewFullFinancialDashboard ? (
              <div className="mt-6">
                <QuickActions
                  role={authContext?.role}
                  navigate={navigate}
                />
              </div>
            ) : null}

            <footer className="mt-8 border-t border-slate-200 py-7">
              <FleetOSBrand variant="footer" />
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   KPI CARD
============================================================ */

function DashboardKpiCard({
  title,
  value,
  subtitle,
  tone,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "blue" | "cyan" | "green" | "purple";
  icon: "truck" | "load" | "check" | "revenue";
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600",
    cyan: "bg-cyan-50 text-cyan-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
  };

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.09)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          <KpiIcon type={icon} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-3.5 w-3.5"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path
              d="m7 14 5-5 5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className="truncate text-xs font-medium text-slate-500">
          {subtitle}
        </span>
      </div>

      <div className="mt-4 flex h-7 items-end gap-1">
        {[35, 48, 42, 60, 52, 70, 62, 78, 72, 90].map(
          (height, index) => (
            <span
              key={index}
              className="flex-1 rounded-sm bg-blue-100"
              style={{
                height: `${height}%`,
                opacity: 0.55 + index * 0.04,
              }}
            />
          )
        )}
      </div>
    </article>
  );
}

function KpiIcon({
  type,
}: {
  type: "truck" | "load" | "check" | "revenue";
}) {
  if (type === "truck") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d="M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }

  if (type === "load") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d="M5 4h14v16H5V4Z"
          strokeLinejoin="round"
        />
        <path
          d="M8 8h8M8 12h8M8 16h5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "check") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          d="m8 12 2.5 2.5L16 9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 18V9M10 18V5M16 18v-7M22 18V3"
        strokeLinecap="round"
      />
      <path
        d="M3 18h19"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ============================================================
   STATUS LEGEND
============================================================ */

function StatusLegend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
        />

        <span className="truncate text-xs font-medium text-slate-600">
          {label}
        </span>
      </div>

      <span className="ml-2 text-sm font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   FLEET STATUS
============================================================ */

function FleetStatusRow({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
        />

        <span className="text-sm font-medium text-slate-700">
          {label}
        </span>
      </div>

      <span className="text-lg font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   FINANCIAL BAR
============================================================ */

function FinancialBar({
  label,
  value,
  maximum,
  barClass,
  formattedValue,
}: {
  label: string;
  value: number;
  maximum: number;
  barClass: string;
  formattedValue: string;
}) {
  const percentage =
    value === 0
      ? 4
      : Math.max(
          8,
          Math.min(
            100,
            (Math.abs(value) / maximum) * 100
          )
        );

  return (
    <div className="flex h-full min-w-0 flex-col justify-end">
      <div className="mb-2 truncate text-center text-[11px] font-semibold text-slate-600 sm:text-xs">
        {formattedValue}
      </div>

      <div className="flex h-[160px] items-end justify-center rounded-xl bg-slate-50 px-2 pt-3">
        <div
          className={`w-full max-w-[52px] rounded-t-lg ${barClass} shadow-sm transition-all`}
          style={{
            height: `${percentage}%`,
          }}
        />
      </div>

      <p className="mt-3 truncate text-center text-xs font-semibold text-slate-500">
        {label}
      </p>
    </div>
  );
}

/* ============================================================
   MINI METRIC
============================================================ */

function MiniMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   RECEIVABLES
============================================================ */

function ReceivablesPanel({
  data,
  formatCurrency,
  navigate,
}: {
  data: DashboardData;
  formatCurrency: (value: number) => string;
  navigate: (path: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Accounts Receivable
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Outstanding and upcoming customer payments
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/invoices")}
          className="w-fit rounded-xl bg-[#0b1729] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Review Invoices
        </button>
      </div>

      <div className="grid gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-3">
        <ReceivableMetric
          label="Outstanding"
          value={formatCurrency(
            data.outstandingReceivables
          )}
          valueClass="text-slate-900"
        />

        <ReceivableMetric
          label="Overdue"
          value={formatCurrency(
            data.overdueReceivables
          )}
          valueClass="text-rose-600"
        />

        <ReceivableMetric
          label="Due This Week"
          value={formatCurrency(data.dueThisWeek)}
          valueClass="text-amber-600"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-6 py-4">
                Invoice
              </th>

              <th className="px-4 py-4">
                Broker
              </th>

              <th className="px-4 py-4">
                Amount
              </th>

              <th className="px-4 py-4">
                Balance
              </th>

              <th className="px-4 py-4">
                Status
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {data.recentInvoices.length > 0 ? (
              data.recentInvoices
                .slice(0, 5)
                .map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {invoice.invoiceNumber}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {invoice.broker}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {formatCurrency(invoice.amount)}
                    </td>

                    <td className="px-4 py-4 font-medium text-slate-900">
                      {formatCurrency(invoice.balance)}
                    </td>

                    <td className="px-4 py-4">
                      <InvoiceStatusBadge
                        status={invoice.status}
                      />
                    </td>
                  </tr>
                ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-14 text-center"
                >
                  <EmptyState
                    title="No recent invoices"
                    description="Invoice activity will appear here."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceivableMetric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="bg-white px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   QUICK ACTIONS
============================================================ */

function QuickActions({
  role,
  navigate,
}: {
  role: AuthRoleContext["role"] | undefined;
  navigate: (path: string) => void;
}) {
  const actions: {
    label: string;
    description: string;
    path: string;
    allowed: AuthRoleContext["role"][];
  }[] = [
    {
      label: "Add Load",
      description: "Create a new load",
      path: "/loads",
      allowed: [
        "owner",
        "admin",
        "dispatcher",
      ],
    },

    {
      label: "Add Driver",
      description: "Manage drivers",
      path: "/drivers",
      allowed: [
        "owner",
        "admin",
        "fleet_manager",
      ],
    },

    {
      label: "Add Truck",
      description: "Manage fleet equipment",
      path: "/trucks",
      allowed: [
        "owner",
        "admin",
        "fleet_manager",
      ],
    },

    {
      label: "Add Expense",
      description: "Record operating costs",
      path: "/expenses",
      allowed: [
        "owner",
        "admin",
        "accountant",
      ],
    },
  ];

  const visibleActions = role
    ? actions.filter((action) =>
        action.allowed.includes(role)
      )
    : [];

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#081527] to-[#10233d] p-6 text-white shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          Quick Actions
        </p>

        <h2 className="mt-2 text-xl font-bold">
          Keep operations moving
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Jump directly into your most common workflows.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {visibleActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => navigate(action.path)}
            className="group rounded-xl border border-white/10 bg-white/[0.06] p-4 text-left transition hover:border-blue-400/30 hover:bg-white/10"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-white">
                {action.label}
              </span>

              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white transition group-hover:bg-blue-500">
                +
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              {action.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M5 4h14v16H5V4Z"
            strokeLinejoin="round"
          />

          <path
            d="M8 9h8M8 13h6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   INVOICE STATUS
============================================================ */

function InvoiceStatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (status === "invoiced") {
    classes =
      "bg-blue-50 text-blue-700";
  } else if (status === "due") {
    classes =
      "bg-amber-50 text-amber-700";
  } else if (status === "overdue") {
    classes =
      "bg-rose-50 text-rose-600";
  } else if (status === "partially_paid") {
    classes =
      "bg-amber-50 text-amber-700";
  } else if (status === "paid") {
    classes =
      "bg-emerald-50 text-emerald-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {prettyStatus(status)}
    </span>
  );
}

/* ============================================================
   TRUCK STATUS
============================================================ */

function TruckStatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (status === "active") {
    classes =
      "bg-emerald-50 text-emerald-700";
  } else if (status === "available") {
    classes =
      "bg-blue-50 text-blue-700";
  } else if (status === "maintenance") {
    classes =
      "bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {prettyStatus(status)}
    </span>
  );
}

/* ============================================================
   LOAD STATUS
============================================================ */

function LoadStatusBadge({
  status,
}: {
  status: string;
}) {
  const statusClasses: Record<string, string> = {
    booked:
      "bg-blue-50 text-blue-700",

    dispatched:
      "bg-cyan-50 text-cyan-700",

    picked_up:
      "bg-amber-50 text-amber-700",

    in_transit:
      "bg-blue-50 text-blue-700",

    delivered:
      "bg-emerald-50 text-emerald-700",

    pod_received:
      "bg-emerald-50 text-emerald-700",

    invoiced:
      "bg-violet-50 text-violet-700",

    paid:
      "bg-emerald-50 text-emerald-700",

    cancelled:
      "bg-slate-100 text-slate-700",
  };

  const classes =
    statusClasses[status] ??
    "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {prettyStatus(status)}
    </span>
  );
}

/* ============================================================
   PRETTY STATUS
============================================================ */

function prettyStatus(status: string) {
  if (!status) {
    return "";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}