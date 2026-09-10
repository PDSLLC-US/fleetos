"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

const PENDING_KEY =
  "fleetos_pending_onboarding";

const MAX_ATTEMPTS = 20;
const CHECK_INTERVAL_MS = 1500;

type CheckoutStatusResponse = {
  complete?: boolean;
  paymentStatus?: string;
  checkoutStatus?: string;
  companyId?: string;
  role?: string;
  error?: string;
};

function PaymentCompleteContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const sessionId =
    searchParams.get(
      "session_id"
    )?.trim() || "";

  const [
    status,
    setStatus,
  ] = useState(
    "Confirming your FleetOS subscription..."
  );

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let cancelled =
      false;

    async function wait(
      milliseconds: number
    ) {
      await new Promise(
        (resolve) =>
          window.setTimeout(
            resolve,
            milliseconds
          )
      );
    }

    async function confirmOnboarding() {
      try {
        setError("");

        if (
          !sessionId ||
          !sessionId.startsWith(
            "cs_"
          )
        ) {
          throw new Error(
            "The Stripe Checkout Session is missing. Please return to sign in and contact support if your payment was completed."
          );
        }

        for (
          let attempt = 1;
          attempt <= MAX_ATTEMPTS;
          attempt += 1
        ) {
          if (cancelled) {
            return;
          }

          setStatus(
            attempt === 1
              ? "Confirming your FleetOS subscription..."
              : "Payment received. Finishing your FleetOS workspace..."
          );

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
              "Your FleetOS session could not be verified. Please sign in again."
            );
          }

          /*
           * Verify the exact Checkout Session on the
           * FleetOS server.
           *
           * The server independently checks Stripe,
           * the authenticated user, pending signup,
           * subscription metadata and payment status.
           *
           * If the webhook was missed, the server can
           * safely recover the already-paid Checkout.
           */
          const response =
            await fetch(
              "/api/stripe/checkout-status",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    sessionId,
                  }),

                cache:
                  "no-store",
              }
            );

          const result =
            (await response.json()) as CheckoutStatusResponse;

          if (!response.ok) {
            throw new Error(
              result.error ||
                "Unable to verify your FleetOS payment."
            );
          }

          if (
            result.complete
          ) {
            window.localStorage.removeItem(
              PENDING_KEY
            );

            setStatus(
              "Payment confirmed. Opening your FleetOS workspace..."
            );

            window.location.href =
              result.role ===
              "driver"
                ? "/driver"
                : "/";

            return;
          }

          /*
           * Never activate a company while Stripe
           * still reports an unpaid/processing state.
           */
          if (
            result.paymentStatus &&
            result.paymentStatus !==
              "paid" &&
            result.paymentStatus !==
              "no_payment_required"
          ) {
            setStatus(
              "Stripe is still processing your payment..."
            );
          }

          if (
            attempt <
            MAX_ATTEMPTS
          ) {
            await wait(
              CHECK_INTERVAL_MS
            );
          }
        }

        setStatus(
          "Your payment is still being confirmed."
        );

        setError(
          "FleetOS has not finished activating your workspace yet. Please wait a moment, then check again."
        );
      } catch (err) {
        console.error(
          "Payment completion:",
          err
        );

        setStatus(
          "We could not finish your workspace automatically."
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to confirm your FleetOS workspace."
        );
      }
    }

    void confirmOnboarding();

    return () => {
      cancelled =
        true;
    };
  }, [
    sessionId,
    supabase,
  ]);

  function retry() {
    window.location.reload();
  }

  async function goToLogin() {
    await supabase.auth.signOut();

    router.push(
      "/login"
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl sm:p-10">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>

        <p className="mt-7 text-xs font-bold uppercase tracking-[0.3em] text-blue-600">
          FleetOS
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Completing your setup
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          {status}
        </p>

        {!error ? (
          <p className="mt-5 text-sm leading-6 text-slate-400">
            Please keep this page open while we securely
            confirm your subscription.
          </p>
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="text-sm leading-6 text-amber-800">
              {error}
            </p>

            <button
              type="button"
              onClick={
                retry
              }
              className="mt-4 w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Check Again
            </button>

            <button
              type="button"
              onClick={() =>
                void goToLogin()
              }
              className="mt-2 w-full px-5 py-3 text-sm font-semibold text-blue-600"
            >
              Return to Sign In
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function PaymentCompleteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl sm:p-10">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>

        <p className="mt-7 text-xs font-bold uppercase tracking-[0.3em] text-blue-600">
          FleetOS
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Completing your setup
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          Loading your secure payment confirmation...
        </p>

      </div>
    </main>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <PaymentCompleteLoading />
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}