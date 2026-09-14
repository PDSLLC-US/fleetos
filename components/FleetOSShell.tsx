"use client";

import { useState } from "react";

import FleetOSBrand from "@/components/FleetOSBrand";
import {
  roleLabel,
  type AuthRoleContext,
} from "@/lib/auth-role";

type Role = AuthRoleContext["role"];

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

const ALL_MANAGEMENT_ROLES: Role[] = [
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
    roles: ALL_MANAGEMENT_ROLES,
  },
  {
    label: "Loads",
    icon: "M4 6h16M4 12h16M4 18h16",
    roles: ["owner", "admin", "dispatcher", "fleet_manager"],
  },
  {
    label: "Fleet",
    icon: "M5 12h14M7 6h10M9 18h6",
    roles: ["owner", "admin", "fleet_manager"],
    children: [
      {
        label: "Trucks",
        roles: ["owner", "admin", "fleet_manager"],
      },
      {
        label: "Trailers",
        roles: ["owner", "admin", "fleet_manager"],
      },
      {
        label: "Maintenance",
        roles: ["owner", "admin", "fleet_manager"],
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
        roles: ["owner", "admin", "dispatcher", "fleet_manager"],
      },
      {
        label: "Settlements",
        roles: ["owner", "admin", "accountant"],
      },
    ],
  },
  {
    label: "Finance",
    icon: "M4 6h16M8 20h8M12 6v14",
    roles: ["owner", "admin", "accountant", "dispatcher"],
    children: [
      {
        label: "Expenses",
        roles: ["owner", "admin", "accountant"],
      },
      {
        label: "Invoices",
        roles: ["owner", "admin", "accountant", "dispatcher"],
      },
    ],
  },
  {
    label: "Documents",
    icon:
      "M6 4h12l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    roles: ALL_MANAGEMENT_ROLES,
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

export type FleetOSShellProps = {
  companyName: string;
  userFullName: string;
  role: Role | null | undefined;
  pathname: string;
  loggingOut: boolean;
  onNavigate: (path: string | undefined) => void;
  onLogout: () => void | Promise<void>;
};

function getRouteForLabel(label: string) {
  switch (label.toLowerCase()) {
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

export default function FleetOSShell({
  companyName,
  userFullName,
  role,
  pathname,
  loggingOut,
  onNavigate,
  onLogout,
}: FleetOSShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNavItems = role
    ? navItems
        .filter((item) => item.roles.includes(role))
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) => child.roles.includes(role)),
        }))
    : [];

  function handleNavigate(path: string | undefined) {
    setMobileMenuOpen(false);
    onNavigate(path);
  }

  return (
    <>
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-80 lg:self-start lg:flex-col lg:overflow-hidden lg:bg-slate-950 lg:px-6 lg:py-8 lg:text-slate-100">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-4">
            <FleetOSBrand variant="sidebar" />

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-400">
                Active Company
              </p>

              <p className="mt-1 truncate text-base font-semibold text-white">
                {companyName || "Operations Portal"}
              </p>
            </div>
          </div>

          <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 pb-4 text-sm leading-6">
            {visibleNavItems.map((item) => {
              const route = getRouteForLabel(item.label);
              const isActive = Boolean(route && pathname === route);

              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={route ? () => handleNavigate(route) : undefined}
                    disabled={!route}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      route ? "hover:bg-slate-800 hover:text-white" : "cursor-not-allowed opacity-50"
                    } ${isActive ? "bg-slate-800 text-white" : ""}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 flex-none stroke-current"
                      fill="none"
                      strokeWidth="1.8"
                    >
                      <path
                        d={item.icon}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <span>{item.label}</span>
                  </button>

                  {item.children ? (
                    <div className="space-y-1 border-l border-slate-800 pl-8">
                      {item.children.map((child) => {
                        const childRoute = getRouteForLabel(child.label);
                        const childActive = Boolean(childRoute && pathname === childRoute);

                        return (
                          <button
                            key={child.label}
                            type="button"
                            onClick={childRoute ? () => handleNavigate(childRoute) : undefined}
                            disabled={!childRoute}
                            className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
                              childRoute
                                ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                                : "cursor-not-allowed text-slate-500 opacity-50"
                            } ${childActive ? "bg-slate-800 text-white" : ""}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mt-4 shrink-0 rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
          <p className="truncate text-sm font-semibold text-white">
            {userFullName || "FleetOS User"}
          </p>

          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
            {roleLabel(role)}
          </p>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => handleNavigate("/account")}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              My Account
            </button>

            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="min-w-0">
            <FleetOSBrand variant="header" />

            <p className="mt-2 max-w-[240px] truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {companyName || "Dashboard"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {mobileMenuOpen ? (
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
                      {companyName || "Operations Portal"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-white"
                  aria-label="Close menu"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
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
                {visibleNavItems.map((item) => {
                  const route = getRouteForLabel(item.label);

                  return (
                    <div key={item.label} className="space-y-1">
                      <button
                        type="button"
                        onClick={route ? () => handleNavigate(route) : undefined}
                        disabled={!route}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          route ? "hover:bg-slate-800" : "cursor-not-allowed opacity-50"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 flex-none stroke-current"
                          fill="none"
                          strokeWidth="1.8"
                        >
                          <path
                            d={item.icon}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>

                        <span>{item.label}</span>
                      </button>

                      {item.children ? (
                        <div className="space-y-1 border-l border-slate-800 pl-8">
                          {item.children.map((child) => {
                            const childRoute = getRouteForLabel(child.label);

                            return (
                              <button
                                key={child.label}
                                type="button"
                                onClick={childRoute ? () => handleNavigate(childRoute) : undefined}
                                disabled={!childRoute}
                                className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
                                  childRoute
                                    ? "text-slate-300 hover:bg-slate-800"
                                    : "cursor-not-allowed text-slate-500 opacity-50"
                                }`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                {child.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>

              <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                <p className="truncate text-sm font-semibold text-white">
                  {userFullName || "FleetOS User"}
                </p>

                <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
                  {roleLabel(role)}
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleNavigate("/account")}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    My Account
                  </button>

                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loggingOut}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
