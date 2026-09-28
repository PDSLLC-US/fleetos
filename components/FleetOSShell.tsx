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
    icon: "M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z",
    roles: ALL_MANAGEMENT_ROLES,
  },
  {
    label: "Loads",
    icon: "M3 7h11v10H3V7Zm11 3h4l3 3v4h-7v-7ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    roles: ["owner", "admin", "dispatcher", "fleet_manager"],
  },
  {
    label: "Fleet",
    icon: "M3 6h18M5 12h14M8 18h8",
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
      "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z M5 21c0-3.31 2.69-6 6-6h2c3.31 0 6 2.69 6 6",
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
    icon:
      "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
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
      "M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v5h5M8 13h8M8 17h6",
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
    icon: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
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

function isRouteActive(
  pathname: string,
  route: string | undefined,
) {
  if (!route) {
    return false;
  }

  if (route === "/") {
    return pathname === "/";
  }

  return pathname === route || pathname.startsWith(`${route}/`);
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
          children: item.children?.filter((child) =>
            child.roles.includes(role),
          ),
        }))
    : [];

  function handleNavigate(path: string | undefined) {
    setMobileMenuOpen(false);
    onNavigate(path);
  }

  function hasActiveChild(item: NavItem) {
    return Boolean(
      item.children?.some((child) =>
        isRouteActive(
          pathname,
          getRouteForLabel(child.label),
        ),
      ),
    );
  }

  const initials =
    userFullName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "FO";

  return (
    <>
      {/* ==================================================
          DESKTOP MANAGEMENT SIDEBAR
      ================================================== */}

      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[292px] lg:flex-none lg:self-start lg:flex-col lg:overflow-hidden lg:border-r lg:border-white/5 lg:bg-[#06111f] lg:text-slate-100">
        {/* Ambient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl" />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-5 pt-6">
          {/* BRAND */}
          <div className="shrink-0">
            <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <FleetOSBrand variant="sidebar" />
            </div>

            {/* ACTIVE COMPANY */}
            <div className="mt-4 rounded-[20px] border border-blue-400/10 bg-gradient-to-br from-blue-500/[0.10] to-cyan-400/[0.025] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                </span>

                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-300">
                  Active Company
                </p>
              </div>

              <p className="mt-2 truncate text-sm font-semibold tracking-tight text-white">
                {companyName || "Operations Portal"}
              </p>
            </div>
          </div>

          {/* NAVIGATION */}
          <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 pb-4 text-sm [scrollbar-width:thin] [scrollbar-color:#1e3a5f_transparent]">
            <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.28em] text-slate-600">
              Command Center
            </p>

            {visibleNavItems.map((item) => {
              const route = getRouteForLabel(item.label);
              const directActive = isRouteActive(pathname, route);
              const childActive = hasActiveChild(item);
              const sectionActive = directActive || childActive;

              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={
                      route
                        ? () => handleNavigate(route)
                        : undefined
                    }
                    disabled={!route}
                    className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[15px] px-3 py-2.5 text-left font-medium transition-all duration-200 ${
                      route
                        ? "hover:bg-white/[0.055] hover:text-white"
                        : "cursor-default"
                    } ${
                      sectionActive
                        ? "bg-gradient-to-r from-blue-600/20 to-cyan-400/[0.04] text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.08)]"
                        : "text-slate-400"
                    }`}
                  >
                    {sectionActive ? (
                      <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.7)]" />
                    ) : null}

                    <span
                      className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl transition ${
                        sectionActive
                          ? "bg-blue-500/15 text-cyan-300"
                          : "bg-white/[0.035] text-slate-500 group-hover:text-slate-300"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-[17px] w-[17px] stroke-current"
                        fill="none"
                        strokeWidth="1.7"
                      >
                        <path
                          d={item.icon}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>

                    {item.children?.length ? (
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 flex-none transition ${
                          childActive
                            ? "text-cyan-400"
                            : "text-slate-700"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          d="m9 18 6-6-6-6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>

                  {item.children ? (
                    <div className="relative ml-[28px] space-y-0.5 border-l border-slate-800/80 py-1 pl-5">
                      {item.children.map((child) => {
                        const childRoute =
                          getRouteForLabel(child.label);

                        const childIsActive =
                          isRouteActive(
                            pathname,
                            childRoute,
                          );

                        return (
                          <button
                            key={child.label}
                            type="button"
                            onClick={
                              childRoute
                                ? () =>
                                    handleNavigate(
                                      childRoute,
                                    )
                                : undefined
                            }
                            disabled={!childRoute}
                            className={`relative flex w-full items-center rounded-xl px-3 py-2 text-left text-[13px] transition ${
                              childRoute
                                ? "hover:bg-white/[0.04] hover:text-white"
                                : "cursor-not-allowed opacity-40"
                            } ${
                              childIsActive
                                ? "font-semibold text-cyan-300"
                                : "text-slate-500"
                            }`}
                          >
                            {childIsActive ? (
                              <span className="absolute -left-[21px] h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                            ) : null}

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

          {/* USER CARD */}
          <div className="shrink-0 border-t border-white/[0.06] pt-4">
            <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.25)]">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {userFullName || "FleetOS User"}
                  </p>

                  <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {roleLabel(role)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleNavigate("/account")
                  }
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.06] hover:text-cyan-300"
                  aria-label="My account"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleNavigate("/account")
                  }
                  className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-blue-400/20 hover:bg-blue-500/10 hover:text-white"
                >
                  Account
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  disabled={loggingOut}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] font-semibold text-slate-400 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                >
                  {loggingOut
                    ? "Logging out..."
                    : "Logout"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-[8px] font-medium uppercase tracking-[0.22em] text-slate-700">
              Fleet Operations System
            </p>
          </div>
        </div>
      </aside>

      {/* ==================================================
          MOBILE MANAGEMENT HEADER
      ================================================== */}

      <div className="lg:hidden">
        <div className="relative overflow-hidden border-b border-slate-800 bg-[#06111f] px-4 py-3.5 shadow-lg">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl"
          />

          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <FleetOSBrand variant="sidebar" />

              <div className="mt-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-cyan-400" />

                <p className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {companyName || "Operations Portal"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-[15px] border border-white/[0.08] bg-white/[0.055] text-white shadow-lg transition active:scale-95"
              aria-label="Open menu"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
              >
                <path
                  d="M5 7h14M5 12h14M5 17h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ==================================================
            MOBILE DRAWER
        ================================================== */}

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 bg-[#020813]/80 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 h-full w-full"
            />

            <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-[360px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#06111f] text-slate-100 shadow-2xl">
              <div className="relative border-b border-white/[0.06] px-5 pb-5 pt-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl"
                />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <FleetOSBrand variant="sidebar" />

                    <div className="mt-4 rounded-[18px] border border-blue-400/10 bg-blue-500/[0.07] px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />

                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                          Active Company
                        </p>
                      </div>

                      <p className="mt-1.5 max-w-[220px] truncate text-sm font-semibold text-white">
                        {companyName ||
                          "Operations Portal"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMobileMenuOpen(false)
                    }
                    className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-[14px] border border-white/[0.07] bg-white/[0.05] text-slate-300 transition hover:text-white"
                    aria-label="Close menu"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                    >
                      <path
                        d="M6 6l12 12M6 18 18 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-5">
                <p className="mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.28em] text-slate-600">
                  Command Center
                </p>

                {visibleNavItems.map((item) => {
                  const route =
                    getRouteForLabel(item.label);

                  const directActive =
                    isRouteActive(pathname, route);

                  const childActive =
                    hasActiveChild(item);

                  const sectionActive =
                    directActive || childActive;

                  return (
                    <div
                      key={item.label}
                      className="space-y-1"
                    >
                      <button
                        type="button"
                        onClick={
                          route
                            ? () =>
                                handleNavigate(route)
                            : undefined
                        }
                        disabled={!route}
                        className={`relative flex w-full items-center gap-3 rounded-[15px] px-3 py-3 text-left text-sm font-medium transition ${
                          route
                            ? "active:scale-[0.99]"
                            : "cursor-default"
                        } ${
                          sectionActive
                            ? "bg-gradient-to-r from-blue-600/20 to-cyan-400/[0.04] text-white"
                            : "text-slate-400"
                        }`}
                      >
                        {sectionActive ? (
                          <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-cyan-400" />
                        ) : null}

                        <span
                          className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl ${
                            sectionActive
                              ? "bg-blue-500/15 text-cyan-300"
                              : "bg-white/[0.035] text-slate-500"
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-[17px] w-[17px]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          >
                            <path
                              d={item.icon}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>

                        <span className="flex-1">
                          {item.label}
                        </span>
                      </button>

                      {item.children ? (
                        <div className="ml-7 space-y-0.5 border-l border-slate-800 pl-5">
                          {item.children.map(
                            (child) => {
                              const childRoute =
                                getRouteForLabel(
                                  child.label,
                                );

                              const childIsActive =
                                isRouteActive(
                                  pathname,
                                  childRoute,
                                );

                              return (
                                <button
                                  key={child.label}
                                  type="button"
                                  onClick={
                                    childRoute
                                      ? () =>
                                          handleNavigate(
                                            childRoute,
                                          )
                                      : undefined
                                  }
                                  disabled={
                                    !childRoute
                                  }
                                  className={`relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] ${
                                    childIsActive
                                      ? "font-semibold text-cyan-300"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {childIsActive ? (
                                    <span className="absolute -left-[21px] h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                  ) : null}

                                  {child.label}
                                </button>
                              );
                            },
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>

              <div className="border-t border-white/[0.06] p-4">
                <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-bold text-white">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {userFullName ||
                          "FleetOS User"}
                      </p>

                      <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {roleLabel(role)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleNavigate("/account")
                      }
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-slate-300"
                    >
                      Account
                    </button>

                    <button
                      type="button"
                      onClick={onLogout}
                      disabled={loggingOut}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-slate-400 disabled:opacity-50"
                    >
                      {loggingOut
                        ? "Logging out..."
                        : "Logout"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}