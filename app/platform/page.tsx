"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import FleetOSBrand from "@/components/FleetOSBrand";

type ClientRow = {
  companyId: string;
  companyName: string;
  legalName: string | null;
  mcNumber: string | null;
  dotNumber: string | null;
  phone: string | null;
  email: string | null;
  companyCreatedAt: string;

  subscriptionId: string | null;
  planName: string;
  billingCycle: string | null;
  subscriptionPrice: number;
  subscriptionStatus: string;

  trialEndsAt: string | null;
  nextBillingDate: string | null;
  activatedAt: string | null;
};

type PlatformData = {
  platform: {
    name: string;
    provider: string;
  };

  admin: {
    userId: string;
    email: string | null;
  };

  metrics: {
    totalClients: number;
    activeSubscriptions: number;
    monthlyRecurringRevenue: number;
    trials: number;
    pastDue: number;
    suspended: number;
    cancelled: number;
  };

  clients: ClientRow[];
};

type SubscriptionForm = {
  planName: string;
  billingCycle: string;
  subscriptionPrice: string;
  status: string;
  trialEndsAt: string;
  nextBillingDate: string;
  notes: string;
};

type PlanRow = {
  id: string;
  planCode: string;
  planName: string;
  monthlyPrice: number;
  minTrucks: number;
  maxTrucks: number | null;
  description: string | null;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
};

type PlanForm = {
  planName: string;
  monthlyPrice: string;
  minTrucks: string;
  maxTrucks: string;
  description: string;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: string;
};

const EMPTY_DATA: PlatformData = {
  platform: {
    name: "FleetOS",
    provider:
      "Platinum Digital Services LLC",
  },

  admin: {
    userId: "",
    email: null,
  },

  metrics: {
    totalClients: 0,
    activeSubscriptions: 0,
    monthlyRecurringRevenue: 0,
    trials: 0,
    pastDue: 0,
    suspended: 0,
    cancelled: 0,
  },

  clients: [],
};

const EMPTY_FORM: SubscriptionForm = {
  planName: "FleetOS Professional",
  billingCycle: "monthly",
  subscriptionPrice: "299",
  status: "active",
  trialEndsAt: "",
  nextBillingDate: "",
  notes: "",
};

function formatCurrency(
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

function formatDate(
  value: string | null
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

  return date.toLocaleDateString();
}

function prettyLabel(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function statusClasses(
  status: string
) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";

    case "trial":
      return "bg-sky-100 text-sky-700";

    case "past_due":
      return "bg-amber-100 text-amber-800";

    case "suspended":
      return "bg-rose-100 text-rose-700";

    case "cancelled":
      return "bg-slate-200 text-slate-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function toDateInput(
  value: string | null
) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export default function PlatformPage() {
  const [
    data,
    setData,
  ] =
    useState<PlatformData>(
      EMPTY_DATA
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedClient,
    setSelectedClient,
  ] =
    useState<ClientRow | null>(
      null
    );

  const [
    form,
    setForm,
  ] =
    useState<SubscriptionForm>(
      EMPTY_FORM
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    saveError,
    setSaveError,
  ] =
    useState("");

  const [
    saveSuccess,
    setSaveSuccess,
  ] =
    useState("");

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveError, setPlanSaveError] = useState("");
  const [planSaveSuccess, setPlanSaveSuccess] = useState("");
  const [planForm, setPlanForm] = useState<PlanForm>({
    planName: "",
    monthlyPrice: "",
    minTrucks: "",
    maxTrucks: "",
    description: "",
    isActive: true,
    isFeatured: false,
    displayOrder: "0",
  });

  async function loadPlans() {
    setPlansLoading(true);
    setPlansError("");

    try {
      const response = await fetch("/api/platform/plans", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load FleetOS plans.");
      }

      setPlans(payload.plans ?? []);
    } catch (err) {
      console.error("Platform plans error:", err);
      setPlansError(
        err instanceof Error ? err.message : "Unable to load FleetOS plans."
      );
    } finally {
      setPlansLoading(false);
    }
  }

  function openPlanModal(plan: PlanRow) {
    setSelectedPlan(plan);
    setPlanSaveError("");
    setPlanSaveSuccess("");
    setPlanForm({
      planName: plan.planName,
      monthlyPrice: String(plan.monthlyPrice),
      minTrucks: String(plan.minTrucks),
      maxTrucks: plan.maxTrucks === null ? "" : String(plan.maxTrucks),
      description: plan.description ?? "",
      isActive: plan.isActive,
      isFeatured: plan.isFeatured,
      displayOrder: String(plan.displayOrder),
    });
  }

  function closePlanModal() {
    if (planSaving) return;
    setSelectedPlan(null);
    setPlanSaveError("");
    setPlanSaveSuccess("");
  }

  function updatePlanForm<K extends keyof PlanForm>(
    field: K,
    value: PlanForm[K]
  ) {
    setPlanForm((current) => ({
      ...current,
      [field]: value,
    }));
    setPlanSaveError("");
    setPlanSaveSuccess("");
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan) return;

    setPlanSaving(true);
    setPlanSaveError("");
    setPlanSaveSuccess("");

    try {
      const response = await fetch("/api/platform/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedPlan.id,
          planName: planForm.planName,
          monthlyPrice: Number(planForm.monthlyPrice),
          minTrucks: Number(planForm.minTrucks),
          maxTrucks:
            planForm.maxTrucks.trim() === ""
              ? null
              : Number(planForm.maxTrucks),
          description: planForm.description || null,
          isActive: planForm.isActive,
          isFeatured: planForm.isFeatured,
          displayOrder: Number(planForm.displayOrder),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save FleetOS plan.");
      }

      setPlanSaveSuccess("Plan saved successfully.");
      await loadPlans();

      window.setTimeout(() => {
        setSelectedPlan(null);
      }, 700);
    } catch (err) {
      console.error("Plan save error:", err);
      setPlanSaveError(
        err instanceof Error ? err.message : "Unable to save FleetOS plan."
      );
    } finally {
      setPlanSaving(false);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/platform/dashboard",
          {
            method: "GET",
            cache:
              "no-store",
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to load FleetOS Platform."
        );
      }

      setData(payload);
    } catch (err) {
      console.error(
        "Platform dashboard error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load FleetOS Platform."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    void loadPlans();
  }, []);

  const filteredClients =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return data.clients;
      }

      return data.clients.filter(
        (client) => {
          const text = [
            client.companyName,
            client.legalName,
            client.email,
            client.mcNumber,
            client.dotNumber,
            client.planName,
            client.subscriptionStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return text.includes(
            query
          );
        }
      );
    }, [
      data.clients,
      search,
    ]);

  function openSubscriptionModal(
    client: ClientRow
  ) {
    setSelectedClient(
      client
    );

    setSaveError("");
    setSaveSuccess("");

    setForm({
      planName:
        client.subscriptionId
          ? client.planName
          : "FleetOS Professional",

      billingCycle:
        client.billingCycle ??
        "monthly",

      subscriptionPrice:
        client.subscriptionId
          ? String(
              client.subscriptionPrice
            )
          : "299",

      status:
        client.subscriptionStatus !==
        "unassigned"
          ? client.subscriptionStatus
          : "active",

      trialEndsAt:
        toDateInput(
          client.trialEndsAt
        ),

      nextBillingDate:
        toDateInput(
          client.nextBillingDate
        ),

      notes: "",
    });
  }

  function closeSubscriptionModal() {
    if (saving) {
      return;
    }

    setSelectedClient(
      null
    );

    setSaveError("");
    setSaveSuccess("");
  }

  function updateForm(
    field: keyof SubscriptionForm,
    value: string
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );

    setSaveError("");
    setSaveSuccess("");
  }

  async function saveSubscription(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedClient) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response =
        await fetch(
          "/api/platform/subscriptions",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                companyId:
                  selectedClient.companyId,

                planName:
                  form.planName,

                billingCycle:
                  form.billingCycle,

                subscriptionPrice:
                  Number(
                    form.subscriptionPrice
                  ),

                status:
                  form.status,

                trialEndsAt:
                  form.status ===
                  "trial"
                    ? form.trialEndsAt ||
                      null
                    : null,

                nextBillingDate:
                  form.nextBillingDate ||
                  null,

                notes:
                  form.notes ||
                  null,
              }),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to save FleetOS subscription."
        );
      }

      setSaveSuccess(
        "Subscription saved successfully."
      );

      await loadDashboard();

      window.setTimeout(
        () => {
          setSelectedClient(
            null
          );
        },
        700
      );
    } catch (err) {
      console.error(
        "Subscription save error:",
        err
      );

      setSaveError(
        err instanceof Error
          ? err.message
          : "Unable to save FleetOS subscription."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <div className="flex justify-center">
            <FleetOSBrand
              variant="sidebar"
            />
          </div>

          <p className="mt-6 text-lg font-semibold">
            Loading Platinum
            Platform...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}

      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="flex items-center gap-5">
            <FleetOSBrand
              variant="sidebar"
            />

            <div className="hidden h-10 w-px bg-slate-800 sm:block" />

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">
                Platinum Control
                Center
              </p>

              <h1 className="mt-1 text-xl font-semibold">
                FleetOS Platform
                Administration
              </h1>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Platform Administrator
            </p>

            <p className="mt-1 text-sm font-medium text-white">
              {data.admin.email ||
                "FleetOS Admin"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {/* INTRO */}

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
            Platform Overview
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Platinum FleetOS
            Command Center
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Manage FleetOS
            companies,
            subscriptions,
            recurring revenue,
            trials and account
            health.
          </p>
        </div>

        {error ? (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {/* KPIs */}

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            title="Companies"
            value={String(
              data.metrics
                .totalClients
            )}
            description="Company records in FleetOS"
          />

          <MetricCard
            title="Active Subscriptions"
            value={String(
              data.metrics
                .activeSubscriptions
            )}
            description="Currently active"
          />

          <MetricCard
            title="MRR"
            value={formatCurrency(
              data.metrics
                .monthlyRecurringRevenue
            )}
            description="Monthly recurring revenue"
          />

          <MetricCard
            title="Trials"
            value={String(
              data.metrics.trials
            )}
            description="Trial accounts"
          />

          <MetricCard
            title="Past Due"
            value={String(
              data.metrics.pastDue
            )}
            description="Payment attention required"
          />

          <MetricCard
            title="Suspended"
            value={String(
              data.metrics.suspended
            )}
            description="Access suspended"
          />
        </section>

        {/* PLAN CATALOG */}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-blue-600">
                Plan Catalog
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                FleetOS Plans
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Control the plans and prices that FleetOS can offer to clients.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadPlans()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh Plans
            </button>
          </div>

          {plansError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              {plansError}
            </div>
          ) : null}

          {plansLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading plans...</p>
          ) : (
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className={`rounded-3xl border p-6 ${
                    plan.isFeatured
                      ? "border-blue-300 bg-blue-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {plan.planCode}
                      </p>
                      <h4 className="mt-2 text-2xl font-semibold text-slate-950">
                        {plan.planName}
                      </h4>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {plan.isFeatured ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          Featured
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          plan.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <p className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatCurrency(plan.monthlyPrice)}
                    <span className="text-base font-medium text-slate-500">
                      /month
                    </span>
                  </p>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {plan.maxTrucks === null
                      ? `${plan.minTrucks}+ trucks`
                      : `${plan.minTrucks}–${plan.maxTrucks} trucks`}
                  </p>

                  <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">
                    {plan.description || "No plan description."}
                  </p>

                  <button
                    type="button"
                    onClick={() => openPlanModal(plan)}
                    className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Edit Plan
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* CLIENT TABLE */}

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b border-slate-200 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                Client Companies
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                FleetOS Accounts
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Platinum-managed
                subscription and
                client records.
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search company, MC, DOT, plan..."
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 lg:max-w-sm"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4">
                    Company
                  </th>

                  <th className="px-6 py-4">
                    Carrier
                  </th>

                  <th className="px-6 py-4">
                    Plan
                  </th>

                  <th className="px-6 py-4">
                    Price
                  </th>

                  <th className="px-6 py-4">
                    Billing
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>

                  <th className="px-6 py-4">
                    Next Billing
                  </th>

                  <th className="px-6 py-4">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredClients.length >
                0 ? (
                  filteredClients.map(
                    (
                      client
                    ) => (
                      <tr
                        key={
                          client.companyId
                        }
                        className="hover:bg-slate-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-slate-950">
                            {
                              client.companyName
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {client.email ||
                              "No company email"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-700">
                          <p>
                            MC{" "}
                            {client.mcNumber ||
                              "—"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            USDOT{" "}
                            {client.dotNumber ||
                              "—"}
                          </p>
                        </td>

                        <td className="px-6 py-5 font-medium">
                          {prettyLabel(
                            client.planName
                          )}
                        </td>

                        <td className="px-6 py-5 font-semibold">
                          {client.subscriptionId
                            ? formatCurrency(
                                client.subscriptionPrice
                              )
                            : "—"}
                        </td>

                        <td className="px-6 py-5">
                          {prettyLabel(
                            client.billingCycle
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                              client.subscriptionStatus
                            )}`}
                          >
                            {prettyLabel(
                              client.subscriptionStatus
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          {formatDate(
                            client.nextBillingDate
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <button
                            type="button"
                            onClick={() =>
                              openSubscriptionModal(
                                client
                              )
                            }
                            className="whitespace-nowrap rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                          >
                            {client.subscriptionId
                              ? "Manage"
                              : "Assign Plan"}
                          </button>
                        </td>
                      </tr>
                    )
                  )
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-slate-500"
                    >
                      No FleetOS
                      companies found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-7">
          <FleetOSBrand
            variant="footer"
          />
        </footer>
      </main>

      {/* PLAN MODAL */}

      {selectedPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-6 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                  FleetOS Plan Catalog
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Edit {selectedPlan.planName}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Changes affect the plan catalog. Existing company subscription prices remain unchanged.
                </p>
              </div>
              <button
                type="button"
                onClick={closePlanModal}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-600 hover:bg-slate-200"
                aria-label="Close plan editor"
              >
                ×
              </button>
            </div>

            <form onSubmit={savePlan} className="space-y-6 p-6">
              {planSaveError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                  {planSaveError}
                </div>
              ) : null}

              {planSaveSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                  {planSaveSuccess}
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Plan Name">
                  <input
                    value={planForm.planName}
                    onChange={(event) =>
                      updatePlanForm("planName", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    required
                  />
                </Field>

                <Field label="Monthly Price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.monthlyPrice}
                    onChange={(event) =>
                      updatePlanForm("monthlyPrice", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    required
                  />
                </Field>

                <Field label="Minimum Trucks">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={planForm.minTrucks}
                    onChange={(event) =>
                      updatePlanForm("minTrucks", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    required
                  />
                </Field>

                <Field label="Maximum Trucks">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={planForm.maxTrucks}
                    onChange={(event) =>
                      updatePlanForm("maxTrucks", event.target.value)
                    }
                    placeholder="Leave blank for unlimited"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                  />
                </Field>

                <Field label="Display Order">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={planForm.displayOrder}
                    onChange={(event) =>
                      updatePlanForm("displayOrder", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    required
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  rows={4}
                  value={planForm.description}
                  onChange={(event) =>
                    updatePlanForm("description", event.target.value)
                  }
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(event) =>
                      updatePlanForm("isActive", event.target.checked)
                    }
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Active
                    </span>
                    <span className="block text-xs text-slate-500">
                      Available in the FleetOS plan catalog.
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={planForm.isFeatured}
                    onChange={(event) =>
                      updatePlanForm("isFeatured", event.target.checked)
                    }
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Featured
                    </span>
                    <span className="block text-xs text-slate-500">
                      Highlight this plan on future signup pricing.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closePlanModal}
                  disabled={planSaving}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSaving}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {planSaving ? "Saving..." : "Save Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* SUBSCRIPTION MODAL */}

      {selectedClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-6 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                  FleetOS Subscription
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  {
                    selectedClient.companyName
                  }
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Set the plan,
                  price, billing
                  cycle and account
                  status controlled
                  by Platinum.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeSubscriptionModal
                }
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-600 hover:bg-slate-200"
                aria-label="Close subscription editor"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                saveSubscription
              }
              className="space-y-6 p-6"
            >
              {saveError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                  {
                    saveError
                  }
                </div>
              ) : null}

              {saveSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                  {
                    saveSuccess
                  }
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Plan Name"
                >
                  <input
                    value={
                      form.planName
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "planName",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    placeholder="FleetOS Professional"
                    required
                  />
                </Field>

                <Field
                  label="Subscription Price"
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.subscriptionPrice
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "subscriptionPrice",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    required
                  />
                </Field>

                <Field
                  label="Billing Cycle"
                >
                  <select
                    value={
                      form.billingCycle
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "billingCycle",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
                  >
                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="quarterly">
                      Quarterly
                    </option>

                    <option value="annual">
                      Annual
                    </option>

                    <option value="custom">
                      Custom
                    </option>
                  </select>
                </Field>

                <Field
                  label="Status"
                >
                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "status",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
                  >
                    <option value="trial">
                      Trial
                    </option>

                    <option value="active">
                      Active
                    </option>

                    <option value="past_due">
                      Past Due
                    </option>

                    <option value="suspended">
                      Suspended
                    </option>

                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </Field>

                {form.status ===
                "trial" ? (
                  <Field
                    label="Trial End Date"
                  >
                    <input
                      type="date"
                      value={
                        form.trialEndsAt
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "trialEndsAt",
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                    />
                  </Field>
                ) : null}

                <Field
                  label="Next Billing Date"
                >
                  <input
                    type="date"
                    value={
                      form.nextBillingDate
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "nextBillingDate",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                  />
                </Field>
              </div>

              <Field
                label="Internal Billing Notes"
              >
                <textarea
                  rows={4}
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    updateForm(
                      "notes",
                      event.target
                        .value
                    )
                  }
                  placeholder="Internal Platinum notes..."
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </Field>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeSubscriptionModal
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>

      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}
