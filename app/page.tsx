"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

import FleetOSBrand from "@/components/FleetOSBrand";

import {
  getAuthRole,
  roleLabel,
  type AuthRoleContext,
} from "@/lib/auth-role";

type Role =
  AuthRoleContext["role"];

type NavChild = {
  label: string;
  roles: Role[];
};

type NavItem = {
  label: string;
  icon: string;
  roles: Role[];
  children?: NavChild[];
};

const ALL_MANAGEMENT_ROLES: Role[] =
  [
    "owner",
    "admin",
    "dispatcher",
    "accountant",
    "fleet_manager",
  ];

const OWNER_ADMIN: Role[] = [
  "owner",
  "admin",
];

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: "M3 12h18M3 6h18M3 18h18",
    roles:
      ALL_MANAGEMENT_ROLES,
  },

  {
    label: "Loads",
    icon: "M4 6h16M4 12h16M4 18h16",
    roles: [
      "owner",
      "admin",
      "dispatcher",
      "fleet_manager",
    ],
  },

  {
    label: "Fleet",
    icon: "M5 12h14M7 6h10M9 18h6",
    roles: [
      "owner",
      "admin",
      "fleet_manager",
    ],

    children: [
      {
        label: "Trucks",
        roles: [
          "owner",
          "admin",
          "fleet_manager",
        ],
      },
      {
        label: "Trailers",
        roles: [
          "owner",
          "admin",
          "fleet_manager",
        ],
      },
      {
        label:
          "Maintenance",
        roles: [
          "owner",
          "admin",
          "fleet_manager",
        ],
      },
    ],
  },

  {
    label: "Drivers",
    icon:
      "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z M6 20c0-2.21 1.79-4 4-4h0c2.21 0 4 1.79 4 4v2",

    roles: [
      "owner",
      "admin",
      "dispatcher",
      "fleet_manager",
      "accountant",
    ],

    children: [
      {
        label: "Drivers",
        roles: [
          "owner",
          "admin",
          "dispatcher",
          "fleet_manager",
        ],
      },
      {
        label:
          "Settlements",
        roles: [
          "owner",
          "admin",
          "accountant",
        ],
      },
    ],
  },

  {
    label: "Finance",
    icon:
      "M4 6h16M8 20h8M12 6v14",

    roles: [
      "owner",
      "admin",
      "accountant",
      "dispatcher",
    ],

    children: [
      {
        label: "Expenses",
        roles: [
          "owner",
          "admin",
          "accountant",
        ],
      },
      {
        label: "Invoices",
        roles: [
          "owner",
          "admin",
          "accountant",
          "dispatcher",
        ],
      },
    ],
  },

  {
    label: "Documents",
    icon:
      "M6 4h12l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",

    roles:
      ALL_MANAGEMENT_ROLES,
  },

  {
    label: "Team",
    icon:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",

    roles: OWNER_ADMIN,
  },

  {
    label: "Billing",
    icon: "M4 6h16v12H4z M4 10h16 M8 15h4",
    roles: OWNER_ADMIN,
  },

  {
    label: "Settings",
    icon:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.6 4a5.96 5.96 0 0 0-.28-1.46l2.1-1.64-2.5-4.33-2.5 1a6.02 6.02 0 0 0-1.74-1L13.5 2h-5l-.68 2.56a6.02 6.02 0 0 0-1.74 1l-2.5-1-2.5 4.33 2.1 1.64A5.96 5.96 0 0 0 3.4 12a5.96 5.96 0 0 0 .28 1.46l-2.1 1.64 2.5 4.33 2.5-1a6.02 6.02 0 0 0 1.74 1L8.5 22h5l.68-2.56a6.02 6.02 0 0 0 1.74 1l2.5 1 2.5-4.33-2.1-1.64c.18-.46.28-.95.28-1.46z",

    roles: OWNER_ADMIN,
  },

  {
    label: "My Account",
    icon:
      "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",

    roles: ALL_MANAGEMENT_ROLES,
  },
];

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
  dueDate:
    | string
    | null;
  status: string;
};

type RecentLoad = {
  id: string;
  loadNumber: string;
  broker: string;
  driver: string;
  truck: string;
  pickup: string;
  pickupDate:
    | string
    | null;
  delivery: string;
  deliveryDate:
    | string
    | null;
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

  recentInvoices:
    RecentInvoice[];

  truckProfitability:
    TruckProfitability[];

  recentLoads:
    RecentLoad[];
};

type NumericKpiKey =
  | "totalRevenue"
  | "driverPayroll"
  | "operatingExpenses"
  | "netProfit"
  | "dispatcherWeeklyRevenue"
  | "dispatcherMonthlyRevenue";

type KpiCard = {
  title: string;
  dataKey: NumericKpiKey;
  trendLabel: string;
  color: string;
  icon: string;
};

const fullFinanceKpiCards: KpiCard[] = [
  {
    title: "Total Revenue",
    dataKey: "totalRevenue",
    trendLabel: "Current data",
    color: "text-emerald-600",
    icon: "M5 12h14M5 18h14M9 6h6",
  },
  {
    title: "Driver Payroll",
    dataKey: "driverPayroll",
    trendLabel: "Current data",
    color: "text-emerald-600",
    icon: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-6 14v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2",
  },
  {
    title: "Operating Expenses",
    dataKey: "operatingExpenses",
    trendLabel: "Current data",
    color: "text-amber-600",
    icon: "M4 6h16M4 10h16M4 14h10",
  },
  {
    title: "Net Profit",
    dataKey: "netProfit",
    trendLabel: "Current data",
    color: "text-emerald-600",
    icon: "M5 12l5 5 9-10",
  },
];

const dispatcherKpiCards: KpiCard[] = [
  {
    title: "Total Revenue Weekly",
    dataKey: "dispatcherWeeklyRevenue",
    trendLabel: "Pickup dates Monday through Sunday",
    color: "text-emerald-600",
    icon: "M5 12h14M5 18h14M9 6h6",
  },
  {
    title: "Total Revenue Monthly",
    dataKey: "dispatcherMonthlyRevenue",
    trendLabel: "Pickup dates in the current calendar month",
    color: "text-emerald-600",
    icon: "M4 6h16M4 12h16M4 18h16",
  },
];

const quickActionsByRole: Record<
  Role,
  string[]
> = {
  owner: [
    "+ Add Load",
    "+ Add Driver",
    "+ Add Truck",
    "+ Add Expense",
  ],

  admin: [
    "+ Add Load",
    "+ Add Driver",
    "+ Add Truck",
    "+ Add Expense",
  ],

  dispatcher: [
    "+ Add Load",
  ],

  fleet_manager: [
    "+ Add Driver",
    "+ Add Truck",
  ],

  accountant: [
    "+ Add Expense",
  ],

  driver: [],
};

export default function Home() {
  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const router =
    useRouter();

  const pathname =
    usePathname();

  const supabase =
    createClient();

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

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
    userFullName,
    setUserFullName,
  ] = useState("");

  const [
    companyName,
    setCompanyName,
  ] = useState("");

  const [
    dashboardData,
    setDashboardData,
  ] =
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

  const visibleNavItems =
    authContext
      ? navItems
          .filter(
            (item) =>
              item.roles.includes(
                authContext.role
              )
          )
          .map(
            (item) => ({
              ...item,

              children:
                item.children?.filter(
                  (
                    child
                  ) =>
                    child.roles.includes(
                      authContext.role
                    )
                ),
            })
          )
      : [];

  const visibleQuickActions =
    authContext
      ? quickActionsByRole[
          authContext.role
        ]
      : [];

  const isDispatcher =
    authContext?.role ===
    "dispatcher";

  const isAccountant =
    authContext?.role ===
    "accountant";

  const canViewFullFinancialDashboard =
    authContext?.role ===
      "owner" ||
    authContext?.role ===
      "admin" ||
    authContext?.role ===
      "accountant";

  const visibleKpiCards =
    isDispatcher
      ? dispatcherKpiCards
      : canViewFullFinancialDashboard
        ? fullFinanceKpiCards
        : [];

  function formatCurrency(
    value: number
  ) {
    return new Intl.NumberFormat(
      "en-US",
      {
        style:
          "currency",
        currency:
          "USD",
        maximumFractionDigits: 0,
      }
    ).format(value);
  }

  function navigate(
    path:
      | string
      | undefined
  ) {
    if (!path) {
      return;
    }

    setSidebarOpen(false);

    router.push(path);
  }

  function getRouteForLabel(
    label: string
  ) {
    switch (
      label.toLowerCase()
    ) {
      case "dashboard":
        return "/";

      case "loads":
        return "/loads";

      case "drivers":
        return "/drivers";

      case "trucks":
        return "/trucks";

      case "trailers":
        return "/trailers";

      case "maintenance":
        return "/maintenance";

      case "expenses":
        return "/expenses";

      case "payroll":
      case "settlements":
        return "/payroll";

      case "invoices":
        return "/invoices";

      case "documents":
        return "/documents";

      case "team":
        return "/team";

      case "billing":
        return "/billing";

      case "settings":
        return "/settings";

      case "my account":
        return "/account";

      default:
        return undefined;
    }
  }

  function getQuickActionRoute(
    action: string
  ) {
    const normalized =
      action.toLowerCase();

    if (
      normalized.includes(
        "load"
      )
    ) {
      return "/loads";
    }

    if (
      normalized.includes(
        "driver"
      )
    ) {
      return "/drivers";
    }

    if (
      normalized.includes(
        "truck"
      )
    ) {
      return "/trucks";
    }

    if (
      normalized.includes(
        "expense"
      )
    ) {
      return "/expenses";
    }

    return undefined;
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await supabase.auth.signOut();

      router.replace(
        "/login"
      );

      router.refresh();
    } catch (err) {
      console.error(
        "Logout failed",
        err
      );

      setLoggingOut(false);
    }
  }

  const deliveryTotal =
    dashboardData.activeLoads +
    dashboardData.deliveredLoads;

  const deliveryPercent =
    deliveryTotal > 0
      ? Math.round(
          (dashboardData.deliveredLoads /
            deliveryTotal) *
            100
        )
      : null;

  useEffect(() => {
    let mounted = true;

    async function initializeDashboard() {
      try {
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
          auth.role ===
          "driver"
        ) {
          router.replace(
            "/driver"
          );

          return;
        }

        setAuthContext(auth);

        // ====================================================
        // LOAD REAL USER + COMPANY IDENTITY
        // ====================================================

        const [
          profileResult,
          companyResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "profiles"
              )
              .select(
                "full_name"
              )
              .eq(
                "id",
                auth.userId
              )
              .maybeSingle(),

            supabase
              .from(
                "companies"
              )
              .select(
                "name"
              )
              .eq(
                "id",
                auth.companyId
              )
              .maybeSingle(),
          ]);

        if (
          profileResult.error
        ) {
          console.error(
            "Unable to load profile:",
            profileResult.error
          );
        }

        if (
          companyResult.error
        ) {
          console.error(
            "Unable to load company:",
            companyResult.error
          );
        }

        if (mounted) {
          setUserFullName(
            profileResult
              .data
              ?.full_name
              ?.trim() ||
              auth.email ||
              "FleetOS User"
          );

          setCompanyName(
            companyResult
              .data
              ?.name
              ?.trim() ||
              "FleetOS"
          );
        }

        // ====================================================
        // LOAD DASHBOARD METRICS
        // ====================================================

        const res =
          await fetch(
            "/api/dashboard",
            {
              cache:
                "no-store",
            }
          );

        if (!res.ok) {
          console.error(
            "Failed to fetch dashboard",
            res.status
          );

          return;
        }

        const data =
          await res.json();

        if (!mounted) {
          return;
        }

        setDashboardData(
          data
        );
      } catch (err) {
        console.error(
          "Error initializing FleetOS dashboard",
          err
        );
      } finally {
        if (mounted) {
          setCheckingRole(
            false
          );
        }
      }
    }

    void initializeDashboard();

    return () => {
      mounted = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="flex justify-center">
            <FleetOSBrand variant="sidebar" />
          </div>

          <p className="mt-5 text-lg font-semibold">
            Loading your
            portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative lg:flex lg:items-stretch">
        {/* ================================================
            DESKTOP SIDEBAR
        ================================================ */}

        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-80 lg:self-start lg:flex-col lg:overflow-hidden lg:bg-slate-950 lg:px-6 lg:py-8 lg:text-slate-100">
          <div className="flex min-h-0 flex-1 flex-col">
            {/* COMPANY BRAND */}

            <div className="shrink-0 space-y-4">
              <FleetOSBrand variant="sidebar" />

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-400">
                  Active Company
                </p>

                <p className="mt-1 truncate text-base font-semibold text-white">
                  {companyName ||
                    "Operations Portal"}
                </p>
              </div>
            </div>

            {/* NAV */}

            <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 pb-4 text-sm leading-6">
              {visibleNavItems.map(
                (item) => {
                  const route =
                    getRouteForLabel(
                      item.label
                    );

                  const isActive =
                    Boolean(
                      route &&
                        pathname ===
                          route
                    );

                  return (
                    <div
                      key={
                        item.label
                      }
                      className="space-y-1"
                    >
                      <button
                        type="button"
                        onClick={
                          route
                            ? () =>
                                navigate(
                                  route
                                )
                            : undefined
                        }
                        disabled={
                          !route
                        }
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          route
                            ? "hover:bg-slate-800 hover:text-white"
                            : "cursor-not-allowed opacity-50"
                        } ${
                          isActive
                            ? "bg-slate-800 text-white"
                            : ""
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 flex-none stroke-current"
                          fill="none"
                          strokeWidth="1.8"
                        >
                          <path
                            d={
                              item.icon
                            }
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        <span>
                          {
                            item.label
                          }
                        </span>
                      </button>

                      {item.children ? (
                        <div className="space-y-1 border-l border-slate-800 pl-8">
                          {item.children.map(
                            (
                              child
                            ) => {
                              const childRoute =
                                getRouteForLabel(
                                  child.label
                                );

                              const childActive =
                                Boolean(
                                  childRoute &&
                                    pathname ===
                                      childRoute
                                );

                              return (
                                <button
                                  key={
                                    child.label
                                  }
                                  type="button"
                                  onClick={
                                    childRoute
                                      ? () =>
                                          navigate(
                                            childRoute
                                          )
                                      : undefined
                                  }
                                  disabled={
                                    !childRoute
                                  }
                                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
                                    childRoute
                                      ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                                      : "cursor-not-allowed text-slate-500 opacity-50"
                                  } ${
                                    childActive
                                      ? "bg-slate-800 text-white"
                                      : ""
                                  }`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />

                                  {
                                    child.label
                                  }
                                </button>
                              );
                            }
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                }
              )}
            </nav>
          </div>

          {/* ACCOUNT CARD */}

          <div className="mt-4 shrink-0 rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
            <p className="truncate text-sm font-semibold text-white">
              {userFullName ||
                "FleetOS User"}
            </p>

            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
              {roleLabel(
                authContext?.role
              )}
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/account"
                  )
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                My Account
              </button>

              <button
                type="button"
                onClick={
                  handleLogout
                }
                disabled={
                  loggingOut
                }
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </button>
            </div>
          </div>
        </aside>

        {/* ================================================
            MOBILE NAV
        ================================================ */}

        <div className="lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="min-w-0">
              <FleetOSBrand variant="header" />

              <p className="mt-2 max-w-[240px] truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {companyName ||
                  "Dashboard"}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSidebarOpen(
                  true
                )
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"
              aria-label="Open menu"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
              >
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {sidebarOpen ? (
            <div className="fixed inset-0 z-40 bg-slate-950/80 px-4 py-5 sm:px-6">
              <div className="h-full overflow-y-auto rounded-3xl bg-slate-950 p-5 text-slate-100 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 space-y-3">
                    <FleetOSBrand variant="sidebar" />

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-400">
                        Active Company
                      </p>

                      <p className="mt-1 max-w-[220px] truncate text-base font-semibold text-white">
                        {companyName ||
                          "Operations Portal"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSidebarOpen(
                        false
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-white"
                    aria-label="Close menu"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                    >
                      <path
                        d="M6 6l12 12M6 18L18 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                <nav className="mt-8 space-y-3 text-sm leading-6">
                  {visibleNavItems.map(
                    (item) => {
                      const route =
                        getRouteForLabel(
                          item.label
                        );

                      return (
                        <div
                          key={
                            item.label
                          }
                          className="space-y-1"
                        >
                          <button
                            type="button"
                            onClick={
                              route
                                ? () =>
                                    navigate(
                                      route
                                    )
                                : undefined
                            }
                            disabled={
                              !route
                            }
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                              route
                                ? "hover:bg-slate-800"
                                : "cursor-not-allowed opacity-50"
                            }`}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5 flex-none stroke-current"
                              fill="none"
                              strokeWidth="1.8"
                            >
                              <path
                                d={
                                  item.icon
                                }
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>

                            <span>
                              {
                                item.label
                              }
                            </span>
                          </button>

                          {item.children ? (
                            <div className="space-y-1 border-l border-slate-800 pl-8">
                              {item.children.map(
                                (
                                  child
                                ) => {
                                  const childRoute =
                                    getRouteForLabel(
                                      child.label
                                    );

                                  return (
                                    <button
                                      key={
                                        child.label
                                      }
                                      type="button"
                                      onClick={
                                        childRoute
                                          ? () =>
                                              navigate(
                                                childRoute
                                              )
                                          : undefined
                                      }
                                      disabled={
                                        !childRoute
                                      }
                                      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
                                        childRoute
                                          ? "text-slate-300 hover:bg-slate-800"
                                          : "cursor-not-allowed text-slate-500 opacity-50"
                                      }`}
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />

                                      {
                                        child.label
                                      }
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </nav>

                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                  <p className="truncate text-sm font-semibold text-white">
                    {userFullName ||
                      "FleetOS User"}
                  </p>

                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
                    {roleLabel(
                      authContext?.role
                    )}
                  </p>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/account"
                        )
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      My Account
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleLogout
                      }
                      disabled={
                        loggingOut
                      }
                      className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {loggingOut
                        ? "Logging out..."
                        : "Logout"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ================================================
            MAIN DASHBOARD
        ================================================ */}

        <main className="flex-1 bg-slate-50 px-4 py-5 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-7xl">
            {/* HEADER */}

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  Dashboard
                </p>

                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Overview of
                  your fleet
                  operations
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  {isDispatcher
                    ? "Operational performance and pickup-based revenue for your current week and month."
                    : isAccountant
                      ? "Financial overview, receivables, expenses, payroll, and profitability."
                      : canViewFullFinancialDashboard
                        ? "Overview of your fleet operations and financial performance."
                        : "Overview of your fleet operations and equipment readiness."}
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex w-full items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:max-w-xs">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-slate-400"
                  >
                    <path
                      d="M21 21l-4.35-4.35m1.1-4.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <input
                    type="search"
                    placeholder="Search operations"
                    className="ml-3 w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-slate-700 shadow-sm transition hover:border-slate-300"
                  aria-label="Notifications"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                  >
                    <path
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 1 1-6 0h6Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/account"
                    )
                  }
                  className="inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-2 text-white shadow-sm transition hover:bg-slate-800"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-sky-400">
                    {(userFullName ||
                      "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <span className="text-left">
                    <span className="block max-w-40 truncate text-sm font-medium">
                      {userFullName ||
                        "FleetOS User"}
                    </span>

                    <span className="block text-xs text-slate-400">
                      {roleLabel(
                        authContext?.role
                      )}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* KPI CARDS */}

            {visibleKpiCards.length > 0 ? (
            <section className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
              {visibleKpiCards.map(
                (card) => (
                  <article
                    key={
                      card.title
                    }
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {
                            card.title
                          }
                        </p>

                        <p className="mt-3 text-3xl font-semibold text-slate-950">
                          {formatCurrency(
                            dashboardData[
                              card
                                .dataKey
                            ] ?? 0
                          )}
                        </p>
                      </div>

                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path
                            d={
                              card.icon
                            }
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                      <span
                        className={`${card.color} font-semibold`}
                      />

                      <span>
                        {
                          card.trendLabel
                        }
                      </span>
                    </div>
                  </article>
                )
              )}
            </section>
            ) : null}

            {/* LOAD OVERVIEW + FLEET STATUS */}

            {!isAccountant ? (
            <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Load Overview
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      Operational
                      snapshot
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                    Updated today
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      label:
                        "Active Loads",

                      value:
                        dashboardData.activeLoads,
                    },

                    {
                      label:
                        "Delivered",

                      value:
                        dashboardData.deliveredLoads,
                    },

                    {
                      label:
                        "Awaiting POD",

                      value:
                        dashboardData.awaitingPod,
                    },

                    {
                      label:
                        "Invoiced",

                      value:
                        dashboardData.invoicedLoads,
                    },
                  ].map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-sm text-slate-500">
                          {
                            item.label
                          }
                        </p>

                        <p className="mt-3 text-3xl font-semibold text-slate-950">
                          {
                            item.value
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-6 rounded-3xl bg-slate-100 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>
                      Delivery
                      progress
                    </span>

                    <span>
                      {deliveryPercent !==
                      null
                        ? `${deliveryPercent}%`
                        : "—"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{
                          width: `${
                            deliveryPercent ??
                            0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Planned
                      </span>

                      <span>
                        On track
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Fleet Status
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      Vehicle
                      readiness
                    </p>
                  </div>

                  <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                    Last 24h
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  {[
                    {
                      label:
                        "Active Trucks",

                      value:
                        dashboardData.activeTrucks,

                      status:
                        "bg-emerald-100 text-emerald-700",
                    },

                    {
                      label:
                        "Available",

                      value:
                        dashboardData.availableTrucks,

                      status:
                        "bg-sky-100 text-sky-700",
                    },

                    {
                      label:
                        "Maintenance",

                      value:
                        dashboardData.maintenanceTrucks,

                      status:
                        "bg-amber-100 text-amber-700",
                    },

                    {
                      label:
                        "Inactive",

                      value:
                        dashboardData.inactiveTrucks,

                      status:
                        "bg-slate-100 text-slate-700",
                    },
                  ].map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-500">
                            {
                              item.label
                            }
                          </p>

                          <p className="mt-2 text-2xl font-semibold text-slate-950">
                            {
                              item.value
                            }
                          </p>
                        </div>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${item.status}`}
                        >
                          {item.label ===
                          "Maintenance"
                            ? "Review"
                            : "Ready"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </section>
            </div>
            ) : null}

            {/* RECEIVABLES + PROFITABILITY */}

            {canViewFullFinancialDashboard ? (
            <div className="mt-8 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Accounts
                      Receivable
                    </p>

                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      Outstanding
                      payments
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/invoices"
                      )
                    }
                    className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Review invoices
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label:
                        "Outstanding",

                      value:
                        formatCurrency(
                          dashboardData.outstandingReceivables
                        ),
                    },

                    {
                      label:
                        "Overdue",

                      value:
                        formatCurrency(
                          dashboardData.overdueReceivables
                        ),
                    },

                    {
                      label:
                        "Due This Week",

                      value:
                        formatCurrency(
                          dashboardData.dueThisWeek
                        ),
                    },
                  ].map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-sm text-slate-500">
                          {
                            item.label
                          }
                        </p>

                        <p className="mt-3 text-2xl font-semibold text-slate-950">
                          {
                            item.value
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-3 pr-6">
                          Broker
                        </th>

                        <th className="py-3 pr-6">
                          Invoice
                        </th>

                        <th className="py-3 pr-6">
                          Amount
                        </th>

                        <th className="py-3 pr-6">
                          Due Date
                        </th>

                        <th className="py-3">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {dashboardData
                        .recentInvoices
                        .length >
                      0 ? (
                        dashboardData.recentInvoices.map(
                          (
                            inv
                          ) => (
                            <tr
                              key={
                                inv.id
                              }
                            >
                              <td className="py-4 pr-6 font-medium">
                                {
                                  inv.broker
                                }
                              </td>

                              <td className="py-4 pr-6">
                                {
                                  inv.invoiceNumber
                                }
                              </td>

                              <td className="py-4 pr-6">
                                {formatCurrency(
                                  inv.amount
                                )}
                              </td>

                              <td className="py-4 pr-6">
                                {inv.dueDate
                                  ? new Date(
                                      inv.dueDate
                                    ).toLocaleDateString()
                                  : "—"}
                              </td>

                              <td className="py-4">
                                <InvoiceStatusBadge
                                  status={
                                    inv.status
                                  }
                                />
                              </td>
                            </tr>
                          )
                        )
                      ) : (
                        <tr>
                          <td
                            colSpan={
                              5
                            }
                            className="py-12 text-center text-slate-500"
                          >
                            No recent
                            invoices.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                      Truck
                      Profitability
                    </p>

                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      Revenue vs
                      cost
                    </p>
                  </div>

                  <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                    Updated weekly
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-3 pr-6">
                          Truck
                        </th>

                        <th className="py-3 pr-6">
                          Status
                        </th>

                        <th className="py-3 pr-6">
                          Revenue
                        </th>

                        <th className="py-3 pr-6">
                          Expenses
                        </th>

                        <th className="py-3">
                          Net Profit
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {dashboardData
                        .truckProfitability
                        .length >
                      0 ? (
                        dashboardData.truckProfitability.map(
                          (
                            truck
                          ) => {
                            const profitClass =
                              truck.netProfit >
                              0
                                ? "font-semibold text-emerald-700"
                                : truck.netProfit <
                                    0
                                  ? "font-semibold text-rose-600"
                                  : "font-semibold text-slate-700";

                            return (
                              <tr
                                key={
                                  truck.truckId
                                }
                                className="hover:bg-slate-50"
                              >
                                <td className="py-4 pr-6 font-medium">
                                  {
                                    truck.truckNumber
                                  }
                                </td>

                                <td className="py-4 pr-6">
                                  <TruckStatusBadge
                                    status={
                                      truck.status
                                    }
                                  />
                                </td>

                                <td className="py-4 pr-6">
                                  {formatCurrency(
                                    truck.revenue
                                  )}
                                </td>

                                <td className="py-4 pr-6">
                                  {formatCurrency(
                                    truck.expenses
                                  )}
                                </td>

                                <td
                                  className={`py-4 ${profitClass}`}
                                >
                                  {formatCurrency(
                                    truck.netProfit
                                  )}
                                </td>
                              </tr>
                            );
                          }
                        )
                      ) : (
                        <tr>
                          <td
                            colSpan={
                              5
                            }
                            className="py-12 text-center text-slate-500"
                          >
                            No truck
                            profitability
                            data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            ) : null}

            {/* RECENT LOADS */}

            {!isAccountant ? (
            <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Recent Loads
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    Active routes
                    & statuses
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/loads"
                    )
                  }
                  className="inline-flex rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  View full
                  operations
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-4 pr-6">
                        Load #
                      </th>

                      <th className="py-4 pr-6">
                        Broker
                      </th>

                      <th className="py-4 pr-6">
                        Driver
                      </th>

                      <th className="py-4 pr-6">
                        Truck
                      </th>

                      <th className="py-4 pr-6">
                        Pickup
                      </th>

                      <th className="py-4 pr-6">
                        Delivery
                      </th>

                      <th className="py-4 pr-6">
                        Rate
                      </th>

                      <th className="py-4">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {dashboardData
                      .recentLoads
                      .length >
                    0 ? (
                      dashboardData.recentLoads.map(
                        (
                          load
                        ) => (
                          <tr
                            key={
                              load.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="py-4 pr-6 font-medium">
                              {
                                load.loadNumber
                              }
                            </td>

                            <td className="py-4 pr-6">
                              {
                                load.broker
                              }
                            </td>

                            <td className="py-4 pr-6">
                              {
                                load.driver
                              }
                            </td>

                            <td className="py-4 pr-6">
                              {
                                load.truck
                              }
                            </td>

                            <td className="py-4 pr-6">
                              <div>
                                {
                                  load.pickup
                                }
                              </div>

                              {load.pickupDate ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  {new Date(
                                    load.pickupDate
                                  ).toLocaleDateString()}
                                </div>
                              ) : null}
                            </td>

                            <td className="py-4 pr-6">
                              <div>
                                {
                                  load.delivery
                                }
                              </div>

                              {load.deliveryDate ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  {new Date(
                                    load.deliveryDate
                                  ).toLocaleDateString()}
                                </div>
                              ) : null}
                            </td>

                            <td className="py-4 pr-6">
                              {formatCurrency(
                                load.revenue
                              )}
                            </td>

                            <td className="py-4">
                              <LoadStatusBadge
                                status={
                                  load.status
                                }
                              />
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan={
                            8
                          }
                          className="py-12 text-center text-slate-500"
                        >
                          No recent
                          loads.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            ) : null}

            {/* QUICK ACTIONS */}

            {!isAccountant ? (
            <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Quick Actions
                  </p>

                  <p className="mt-2 text-xl font-semibold">
                    Create new
                    fleet entries
                  </p>
                </div>

                <p className="text-sm text-slate-400">
                  Fast access to
                  operations
                  workflows.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {visibleQuickActions.map(
                  (action) => {
                    const route =
                      getQuickActionRoute(
                        action
                      );

                    return (
                      <button
                        key={
                          action
                        }
                        type="button"
                        onClick={() =>
                          route &&
                          navigate(
                            route
                          )
                        }
                        disabled={
                          !route
                        }
                        className={`rounded-3xl border border-slate-800 bg-slate-900 px-5 py-4 text-left text-sm font-semibold text-white transition ${
                          route
                            ? "hover:bg-slate-800"
                            : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        {
                          action
                        }
                      </button>
                    );
                  }
                )}
              </div>
            </section>
            ) : null}

            <footer className="mt-8 border-t border-slate-200 py-6">
              <FleetOSBrand variant="footer" />
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   STATUS COMPONENTS
============================================================ */

function InvoiceStatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (
    status === "invoiced"
  ) {
    classes =
      "bg-sky-100 text-sky-700";
  } else if (
    status === "due"
  ) {
    classes =
      "bg-amber-100 text-amber-700";
  } else if (
    status === "overdue"
  ) {
    classes =
      "bg-rose-50 text-rose-600";
  } else if (
    status ===
    "partially_paid"
  ) {
    classes =
      "bg-amber-50 text-amber-700";
  } else if (
    status === "paid"
  ) {
    classes =
      "bg-emerald-100 text-emerald-700";
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {prettyStatus(
        status
      )}
    </span>
  );
}

function TruckStatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (
    status === "active"
  ) {
    classes =
      "bg-emerald-100 text-emerald-700";
  } else if (
    status ===
    "available"
  ) {
    classes =
      "bg-sky-100 text-sky-700";
  } else if (
    status ===
    "maintenance"
  ) {
    classes =
      "bg-amber-100 text-amber-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {prettyStatus(
        status
      )}
    </span>
  );
}

function LoadStatusBadge({
  status,
}: {
  status: string;
}) {
  const statusClasses: Record<
    string,
    string
  > = {
    booked:
      "bg-sky-50 text-sky-700",

    dispatched:
      "bg-sky-100 text-sky-700",

    picked_up:
      "bg-amber-50 text-amber-700",

    in_transit:
      "bg-sky-100 text-sky-700",

    delivered:
      "bg-emerald-100 text-emerald-700",

    pod_received:
      "bg-emerald-100 text-emerald-700",

    invoiced:
      "bg-amber-50 text-amber-700",

    paid:
      "bg-emerald-100 text-emerald-700",

    cancelled:
      "bg-slate-100 text-slate-700",
  };

  const classes =
    statusClasses[
      status
    ] ??
    "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
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
    return "";
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