"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import FleetOSBrand from "@/components/FleetOSBrand";

type Subscription = {
  planName?: string;
  billingCycle?: string;
  subscriptionPrice?: number;
  status: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingDate?: string | null;
  activatedAt?: string | null;
};

type BillingResponse = {
  role: string;
  canViewBilling: boolean;
  subscription: Subscription;
  error?: string;
};

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatMoney(
  value?: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }
  ).format(value ?? 0);
}

function formatCycle(
  value?: string
) {
  if (!value) {
    return "—";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function statusLabel(
  status: string
) {
  switch (status) {
    case "active":
      return "Active";

    case "trial":
      return "Trial";

    case "past_due":
      return "Past Due";

    case "suspended":
      return "Suspended";

    case "cancelled":
      return "Cancelled";

    default:
      return "Unassigned";
  }
}

export default function BillingPage() {
  const router =
    useRouter();

  const [
    data,
    setData,
  ] =
    useState<BillingResponse | null>(
      null
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

  useEffect(() => {
    let mounted = true;

    async function loadBilling() {
      try {
        const response =
          await fetch(
            "/api/company/subscription",
            {
              cache:
                "no-store",
            }
          );

        const result =
          await response.json();

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setError(
            result.error ??
              "Unable to load billing information."
          );

          return;
        }

        if (
          !result.canViewBilling
        ) {
          router.replace("/");
          return;
        }

        setData(result);
      } catch (err) {
        console.error(
          "Billing page error:",
          err
        );

        if (mounted) {
          setError(
            "Unable to load billing information."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadBilling();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          Loading FleetOS billing...
        </p>
      </main>
    );
  }

  if (
    error ||
    !data
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">
            Billing unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error ||
              "Unable to load FleetOS billing information."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const subscription =
    data.subscription;

  const pastDue =
    subscription.status ===
    "past_due";

  const trial =
    subscription.status ===
    "trial";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <FleetOSBrand variant="header" />

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Account & Billing
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              FleetOS Subscription
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Review your company's FleetOS plan,
              billing cycle and subscription status.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Back to Dashboard
          </button>
        </div>

        {pastDue ? (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">
              Payment past due
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              Your FleetOS account remains accessible,
              but your subscription has an outstanding
              billing issue. Please contact Platinum
              Digital Services LLC to avoid service
              interruption.
            </p>
          </div>
        ) : null}

        {trial ? (
          <div className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-5">
            <p className="font-semibold text-sky-900">
              FleetOS Trial
            </p>

            <p className="mt-1 text-sm text-sky-800">
              Your trial is scheduled to end on{" "}
              {formatDate(
                subscription.trialEndsAt
              )}.
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Current Subscription
            </p>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-slate-950">
                  {subscription.planName ??
                    "FleetOS"}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Fleet management platform
                </p>
              </div>

              <span className="inline-flex w-fit rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white">
                {statusLabel(
                  subscription.status
                )}
              </span>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">
                  Subscription Price
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {formatMoney(
                    subscription.subscriptionPrice
                  )}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">
                  Billing Cycle
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatCycle(
                    subscription.billingCycle
                  )}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Next Billing
            </p>

            <p className="mt-5 text-2xl font-semibold">
              {formatDate(
                subscription.nextBillingDate
              )}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Your subscription terms are managed
              securely by Platinum Digital Services LLC.
            </p>
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            Subscription Details
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail
              label="Status"
              value={statusLabel(
                subscription.status
              )}
            />

            <Detail
              label="Activated"
              value={formatDate(
                subscription.activatedAt
              )}
            />

            <Detail
              label="Current Period"
              value={
                subscription.currentPeriodStart
                  ? `${formatDate(
                      subscription.currentPeriodStart
                    )} – ${formatDate(
                      subscription.currentPeriodEnd
                    )}`
                  : "—"
              }
            />

            <Detail
              label="Next Billing Date"
              value={formatDate(
                subscription.nextBillingDate
              )}
            />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            Need billing assistance?
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Plan changes, billing adjustments and
            subscription assistance are handled by
            Platinum Digital Services LLC.
          </p>
        </section>
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}