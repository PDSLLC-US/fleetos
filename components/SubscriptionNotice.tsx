"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type SubscriptionPayload = {
  role?: string;
  canViewBilling?: boolean;
  subscription?: {
    status?: string;
    planName?: string;
    trialStartsAt?: string | null;
    trialEndsAt?: string | null;
  };
};

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

function calculateCountdown(
  trialEndsAt: string | null | undefined
): Countdown {
  if (!trialEndsAt) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: false,
    };
  }

  const end =
    new Date(trialEndsAt).getTime();

  if (
    Number.isNaN(end)
  ) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: false,
    };
  }

  const remaining =
    Math.max(
      end - Date.now(),
      0
    );

  const totalSeconds =
    Math.floor(
      remaining / 1000
    );

  return {
    days:
      Math.floor(
        totalSeconds /
          86400
      ),

    hours:
      Math.floor(
        (totalSeconds %
          86400) /
          3600
      ),

    minutes:
      Math.floor(
        (totalSeconds %
          3600) /
          60
      ),

    seconds:
      totalSeconds % 60,

    expired:
      remaining <= 0,
  };
}

function formatDate(
  value:
    | string
    | null
    | undefined
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

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function TimeBox({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-[68px] rounded-xl border border-amber-300 bg-white/70 px-3 py-2 text-center shadow-sm">
      <p className="text-xl font-bold tabular-nums text-slate-950">
        {String(value).padStart(
          2,
          "0"
        )}
      </p>

      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

export default function SubscriptionNotice() {
  const router =
    useRouter();

  const [
    subscription,
    setSubscription,
  ] =
    useState<SubscriptionPayload | null>(
      null
    );

  const [
    countdown,
    setCountdown,
  ] =
    useState<Countdown>({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: false,
    });

  useEffect(() => {
    let mounted = true;

    async function loadSubscription() {
      try {
        const response =
          await fetch(
            "/api/company/subscription",
            {
              method: "GET",
              cache:
                "no-store",
            }
          );

        /*
         * Public pages, Platform Admin pages and unauthenticated
         * sessions can legitimately return 401/403 here. In those
         * cases the global notice simply stays hidden.
         */
        if (!response.ok) {
          return;
        }

        const payload =
          (await response.json()) as SubscriptionPayload;

        if (!mounted) {
          return;
        }

        setSubscription(
          payload
        );
      } catch (error) {
        console.error(
          "Subscription notice error:",
          error
        );
      }
    }

    void loadSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  const status =
    subscription?.subscription
      ?.status ?? "";

  const trialEndsAt =
    subscription?.subscription
      ?.trialEndsAt ?? null;

  useEffect(() => {
    if (
      status !== "trial" ||
      !trialEndsAt
    ) {
      return;
    }

    function update() {
      setCountdown(
        calculateCountdown(
          trialEndsAt
        )
      );
    }

    update();

    const timer =
      window.setInterval(
        update,
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    status,
    trialEndsAt,
  ]);

  const trialPeriodText =
    useMemo(() => {
      const startsAt =
        subscription
          ?.subscription
          ?.trialStartsAt;

      if (
        !startsAt &&
        !trialEndsAt
      ) {
        return "";
      }

      return `${formatDate(
        startsAt
      )} – ${formatDate(
        trialEndsAt
      )}`;
    }, [
      subscription,
      trialEndsAt,
    ]);

  if (
    status === "past_due"
  ) {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              FleetOS billing notice
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              Your company&apos;s FleetOS subscription has a billing issue.
              Access remains available for now. Please contact Platinum
              Digital Services LLC to avoid service interruption.
            </p>
          </div>

          {subscription
            ?.canViewBilling ? (
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/billing"
                )
              }
              className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-400"
            >
              View Billing
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (
    status !== "trial"
  ) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 rounded-2xl border border-amber-300 bg-white/55 p-4 shadow-sm backdrop-blur sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-2xl">
              ★
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-bold text-slate-950">
                  You&apos;re on a 14-day FleetOS trial
                </p>

                {subscription
                  ?.subscription
                  ?.planName ? (
                  <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                    {
                      subscription
                        .subscription
                        .planName
                    }
                  </span>
                ) : null}
              </div>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Enjoy full access during your trial. Activate your subscription
                before the trial ends to keep your FleetOS workspace available
                without interruption.
              </p>

              {trialPeriodText ? (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Trial period:{" "}
                  <span className="font-semibold text-slate-700">
                    {trialPeriodText}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {trialEndsAt ? (
              <div>
                <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:text-left">
                  {countdown.expired
                    ? "Trial ended"
                    : "Trial ends in"}
                </p>

                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <TimeBox
                    value={
                      countdown.days
                    }
                    label="Days"
                  />

                  <TimeBox
                    value={
                      countdown.hours
                    }
                    label="Hrs"
                  />

                  <TimeBox
                    value={
                      countdown.minutes
                    }
                    label="Mins"
                  />

                  <TimeBox
                    value={
                      countdown.seconds
                    }
                    label="Secs"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                Trial active
              </div>
            )}

            {subscription
              ?.canViewBilling ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/billing"
                  )
                }
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Plan
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
