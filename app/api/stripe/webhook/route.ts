import {
  NextRequest,
  NextResponse,
} from "next/server";

import Stripe from "stripe";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";

// ============================================================
// TYPES
// ============================================================

type FleetOSSubscriptionStatus =
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

type SubscriptionItemPeriod = {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

type InvoiceSubscriptionDetails = {
  subscription?:
    | string
    | Stripe.Subscription
    | null;
};

type InvoiceParent = {
  subscription_details?:
    | InvoiceSubscriptionDetails
    | null;
};

type InvoiceWithSubscription = {
  subscription?:
    | string
    | Stripe.Subscription
    | null;

  parent?:
    | InvoiceParent
    | null;
};

// ============================================================
// GENERIC STRIPE ID HELPER
// ============================================================

function asId(
  value:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Subscription
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return value.id;
}

// ============================================================
// UNIX TIMESTAMP -> YYYY-MM-DD
//
// FleetOS currently stores these fields as DATE columns.
// ============================================================

function unixToDate(
  timestamp:
    | number
    | null
    | undefined
) {
  if (!timestamp) {
    return null;
  }

  const date =
    new Date(
      timestamp * 1000
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

// ============================================================
// GET SUBSCRIPTION ITEM PERIOD
//
// In current Stripe API versions, billing period timestamps
// are associated with the subscription item.
// ============================================================

function getSubscriptionPeriod(
  subscription:
    Stripe.Subscription
) {
  const firstItem =
    subscription.items
      .data[0] as
      | (
          Stripe.SubscriptionItem &
          SubscriptionItemPeriod
        )
      | undefined;

  const currentPeriodStart =
    firstItem
      ?.current_period_start ??
    null;

  const currentPeriodEnd =
    firstItem
      ?.current_period_end ??
    null;

  return {
    currentPeriodStart:
      unixToDate(
        currentPeriodStart
      ),

    currentPeriodEnd:
      unixToDate(
        currentPeriodEnd
      ),

    /*
     * For a standard recurring FleetOS subscription,
     * the current period end is the next renewal date.
     */
    nextBillingDate:
      unixToDate(
        currentPeriodEnd
      ),
  };
}

// ============================================================
// MAP STRIPE STATUS -> FLEETOS STATUS
// ============================================================

function mapStripeStatus(
  status:
    Stripe.Subscription.Status
): FleetOSSubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";

    case "past_due":
      return "past_due";

    case "canceled":
      return "cancelled";

    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "suspended";

    default:
      return "suspended";
  }
}

// ============================================================
// GET SUBSCRIPTION ID FROM INVOICE
//
// Stripe's newer Billing API places subscription information
// beneath invoice.parent.subscription_details.
// The fallback keeps compatibility with older invoice shapes.
// ============================================================

function getInvoiceSubscriptionId(
  invoice:
    Stripe.Invoice
) {
  const invoiceData =
    invoice as
      Stripe.Invoice &
      InvoiceWithSubscription;

  const parentSubscription =
    invoiceData
      .parent
      ?.subscription_details
      ?.subscription;

  const parentId =
    asId(
      parentSubscription
    );

  if (parentId) {
    return parentId;
  }

  return asId(
    invoiceData.subscription
  );
}

// ============================================================
// MAIN WEBHOOK
// ============================================================

export async function POST(
  request:
    NextRequest
) {
  const stripeSecretKey =
    process.env
      .STRIPE_SECRET_KEY;

  const webhookSecret =
    process.env
      .STRIPE_WEBHOOK_SECRET;

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !stripeSecretKey ||
    !webhookSecret ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      "FleetOS Stripe webhook configuration is incomplete."
    );

    return NextResponse.json(
      {
        error:
          "Webhook configuration is incomplete.",
      },
      {
        status: 500,
      }
    );
  }

  const stripe =
    new Stripe(
      stripeSecretKey
    );

  const admin =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  // ==========================================================
  // HELPER:
  // Synchronize an existing FleetOS subscription from Stripe
  // ==========================================================

  async function syncSubscription(
    subscriptionId:
      string,
    options?: {
      forceStatus?:
        FleetOSSubscriptionStatus;

      paymentStatus?:
        string | null;
    }
  ) {
    const subscription =
      await stripe
        .subscriptions
        .retrieve(
          subscriptionId
        );

    const {
      data:
        existingSubscription,

      error:
        existingError,
    } =
      await admin
        .from(
          "company_subscriptions"
        )
        .select(
          `
            id,
            company_id,
            stripe_subscription_id
          `
        )
        .eq(
          "stripe_subscription_id",
          subscriptionId
        )
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to locate FleetOS subscription: ${existingError.message}`
      );
    }

    /*
     * The Stripe account could eventually contain products
     * unrelated to FleetOS. Ignore subscriptions that are not
     * registered in FleetOS instead of modifying unrelated data.
     */
    if (
      !existingSubscription
    ) {
      console.log(
        `Ignoring Stripe subscription ${subscriptionId}; no FleetOS subscription record exists.`
      );

      return null;
    }

    const {
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate,
    } =
      getSubscriptionPeriod(
        subscription
      );

    const firstItem =
      subscription.items
        .data[0];

    const stripePriceId =
      firstItem?.price?.id ??
      null;

    const fleetOSStatus =
      options
        ?.forceStatus ??
      mapStripeStatus(
        subscription.status
      );

    const updateData: {
      status:
        FleetOSSubscriptionStatus;

      current_period_start:
        string | null;

      current_period_end:
        string | null;

      next_billing_date:
        string | null;

      stripe_customer_id:
        string | null;

      stripe_price_id:
        string | null;

      stripe_payment_status?:
        string | null;

      suspended_at?:
        string | null;

      cancelled_at?:
        string | null;

      updated_at:
        string;
    } = {
      status:
        fleetOSStatus,

      current_period_start:
        currentPeriodStart,

      current_period_end:
        currentPeriodEnd,

      next_billing_date:
        fleetOSStatus ===
          "cancelled"
          ? null
          : nextBillingDate,

      stripe_customer_id:
        asId(
          subscription.customer
        ),

      stripe_price_id:
        stripePriceId,

      updated_at:
        new Date()
          .toISOString(),
    };

    if (
      options &&
      "paymentStatus" in
        options
    ) {
      updateData
        .stripe_payment_status =
        options.paymentStatus ??
        null;
    }

    if (
      fleetOSStatus ===
      "suspended"
    ) {
      updateData
        .suspended_at =
        new Date()
          .toISOString();
    } else {
      updateData
        .suspended_at =
        null;
    }

    if (
      fleetOSStatus ===
      "cancelled"
    ) {
      updateData
        .cancelled_at =
        new Date()
          .toISOString();
    } else {
      updateData
        .cancelled_at =
        null;
    }

    const {
      error:
        updateError,
    } =
      await admin
        .from(
          "company_subscriptions"
        )
        .update(
          updateData
        )
        .eq(
          "id",
          existingSubscription.id
        );

    if (updateError) {
      throw new Error(
        `Unable to synchronize FleetOS subscription: ${updateError.message}`
      );
    }

    console.log(
      "FleetOS subscription synchronized:",
      {
        subscriptionId,
        companyId:
          existingSubscription
            .company_id,
        stripeStatus:
          subscription.status,
        fleetOSStatus,
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate:
          fleetOSStatus ===
          "cancelled"
            ? null
            : nextBillingDate,
      }
    );

    return subscription;
  }

  // ==========================================================
  // 1. VERIFY STRIPE SIGNATURE
  // ==========================================================

  const signature =
    request.headers.get(
      "stripe-signature"
    );

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Missing Stripe signature.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Stripe requires the exact raw body for signature
   * verification. Do not call request.json() first.
   */
  const rawBody =
    await request.text();

  let event:
    Stripe.Event;

  try {
    event =
      stripe.webhooks
        .constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
  } catch (error) {
    console.error(
      "Invalid Stripe webhook signature:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Invalid webhook signature.",
      },
      {
        status: 400,
      }
    );
  }

  // ==========================================================
  // 2. PROCESS EVENT
  // ==========================================================

  try {
    switch (
      event.type
    ) {
      // ======================================================
      // INITIAL PAID CHECKOUT
      // ======================================================

      case "checkout.session.completed": {
        const session =
          event.data
            .object as
            Stripe.Checkout.Session;

        if (
          session.mode !==
          "subscription"
        ) {
          break;
        }

        const userId =
          session.metadata
            ?.fleetos_user_id ||
          session
            .client_reference_id;

        const planCode =
          session.metadata
            ?.fleetos_plan_code;

        if (!userId) {
          throw new Error(
            "Stripe Checkout Session is missing FleetOS user ID."
          );
        }

        if (!planCode) {
          throw new Error(
            "Stripe Checkout Session is missing FleetOS plan code."
          );
        }

        if (
          session
            .payment_status !==
            "paid" &&
          session
            .payment_status !==
            "no_payment_required"
        ) {
          console.log(
            `Ignoring unpaid Checkout Session ${session.id}.`
          );

          break;
        }

        // ====================================================
        // LOAD PENDING SIGNUP
        // ====================================================

        const {
          data:
            pending,

          error:
            pendingError,
        } =
          await admin
            .from(
              "pending_company_signups"
            )
            .select(
              `
                user_id,
                owner_name,
                email,
                company_name,
                legal_name,
                mc_number,
                dot_number,
                company_phone,
                plan_code,
                stripe_checkout_session_id,
                payment_status
              `
            )
            .eq(
              "user_id",
              userId
            )
            .eq(
              "stripe_checkout_session_id",
              session.id
            )
            .maybeSingle();

        if (
          pendingError
        ) {
          throw new Error(
            `Unable to load pending FleetOS signup: ${pendingError.message}`
          );
        }

        if (!pending) {
          throw new Error(
            `No pending FleetOS signup exists for Checkout Session ${session.id}.`
          );
        }

        if (
          pending.plan_code !==
          planCode
        ) {
          throw new Error(
            "FleetOS plan mismatch between Stripe and pending signup."
          );
        }

        // ====================================================
        // RESOLVE CUSTOMER + SUBSCRIPTION
        // ====================================================

        const customerId =
          asId(
            session.customer
          );

        const subscriptionId =
          asId(
            session.subscription
          );

        if (!customerId) {
          throw new Error(
            "Stripe Checkout Session is missing customer ID."
          );
        }

        if (
          !subscriptionId
        ) {
          throw new Error(
            "Stripe Checkout Session is missing subscription ID."
          );
        }

        const subscription =
          await stripe
            .subscriptions
            .retrieve(
              subscriptionId
            );

        if (
          subscription
            .metadata
            ?.fleetos_user_id !==
          userId
        ) {
          throw new Error(
            "Stripe subscription user metadata mismatch."
          );
        }

        if (
          subscription
            .metadata
            ?.fleetos_plan_code !==
          planCode
        ) {
          throw new Error(
            "Stripe subscription plan metadata mismatch."
          );
        }

        const firstItem =
          subscription
            .items
            .data[0];

        const stripePriceId =
          firstItem
            ?.price
            ?.id ??
          null;

        // ====================================================
        // CREATE PAID FLEETOS COMPANY
        // ====================================================

        const {
          data:
            onboardingResult,

          error:
            onboardingError,
        } =
          await admin.rpc(
            "complete_paid_company_onboarding",
            {
              user_id_input:
                userId,

              company_name_input:
                pending
                  .company_name,

              owner_name_input:
                pending
                  .owner_name,

              legal_name_input:
                pending
                  .legal_name,

              mc_number_input:
                pending
                  .mc_number,

              dot_number_input:
                pending
                  .dot_number,

              phone_input:
                pending
                  .company_phone,

              email_input:
                pending
                  .email,

              plan_code_input:
                pending
                  .plan_code,

              stripe_customer_id_input:
                customerId,

              stripe_subscription_id_input:
                subscriptionId,

              stripe_checkout_session_id_input:
                session.id,

              stripe_price_id_input:
                stripePriceId,

              stripe_payment_status_input:
                session
                  .payment_status,
            }
          );

        if (
          onboardingError
        ) {
          throw new Error(
            `Paid FleetOS onboarding failed: ${onboardingError.message}`
          );
        }

        /*
         * complete_paid_company_onboarding creates the
         * company_subscriptions row. Now immediately synchronize
         * the actual Stripe billing period into that new row.
         */
        await syncSubscription(
          subscriptionId,
          {
            paymentStatus:
              session
                .payment_status,
          }
        );

        console.log(
          "FleetOS paid onboarding completed:",
          {
            eventId:
              event.id,

            checkoutSessionId:
              session.id,

            userId,

            company:
              onboardingResult,
          }
        );

        break;
      }

      // ======================================================
      // SUBSCRIPTION CREATED / UPDATED
      //
      // Stripe sends updated when renewal dates, plan state,
      // cancellation settings or subscription status changes.
      // ======================================================

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription =
          event.data
            .object as
            Stripe.Subscription;

        await syncSubscription(
          subscription.id
        );

        break;
      }

      // ======================================================
      // SUBSCRIPTION ENDED
      // ======================================================

      case "customer.subscription.deleted": {
        const subscription =
          event.data
            .object as
            Stripe.Subscription;

        await syncSubscription(
          subscription.id,
          {
            forceStatus:
              "cancelled",
          }
        );

        break;
      }

      // ======================================================
      // SUCCESSFUL INITIAL OR RECURRING INVOICE
      //
      // invoice.paid is Stripe's confirmation that an invoice
      // was successfully paid.
      // ======================================================

      case "invoice.paid": {
        const invoice =
          event.data
            .object as
            Stripe.Invoice;

        const subscriptionId =
          getInvoiceSubscriptionId(
            invoice
          );

        if (
          !subscriptionId
        ) {
          console.log(
            `Ignoring invoice ${invoice.id}; it is not linked to a subscription.`
          );

          break;
        }

        await syncSubscription(
          subscriptionId,
          {
            paymentStatus:
              "paid",
          }
        );

        break;
      }

      // ======================================================
      // FAILED RECURRING PAYMENT
      //
      // We mark FleetOS past_due rather than immediately
      // cancelling access. Your existing subscription guard
      // currently permits past_due users while the payment
      // issue is being resolved.
      // ======================================================

      case "invoice.payment_failed": {
        const invoice =
          event.data
            .object as
            Stripe.Invoice;

        const subscriptionId =
          getInvoiceSubscriptionId(
            invoice
          );

        if (
          !subscriptionId
        ) {
          console.log(
            `Ignoring failed invoice ${invoice.id}; it is not linked to a subscription.`
          );

          break;
        }

        await syncSubscription(
          subscriptionId,
          {
            forceStatus:
              "past_due",

            paymentStatus:
              "failed",
          }
        );

        break;
      }

      // ======================================================
      // OTHER STRIPE EVENTS
      // ======================================================

      default: {
        /*
         * Stripe may send many events that FleetOS does not need
         * to process. They are safely acknowledged.
         */
        break;
      }
    }

    // ========================================================
    // 3. ACKNOWLEDGE EVENT
    // ========================================================

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    /*
     * Returning HTTP 500 tells Stripe delivery failed and allows
     * Stripe to retry the event.
     */
    console.error(
      `FleetOS Stripe webhook failed for event ${event.id}:`,
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}