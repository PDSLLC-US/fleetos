import {
  NextRequest,
  NextResponse,
} from "next/server";

import Stripe from "stripe";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

// ============================================================
// TYPES
// ============================================================

type CheckoutStatusRequest = {
  sessionId?: string;
};

type SubscriptionItemPeriod = {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

// ============================================================
// HELPERS
// ============================================================

function clean(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

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
     * For FleetOS recurring subscriptions, Stripe's current
     * period end is the next scheduled renewal date.
     */
    nextBillingDate:
      unixToDate(
        currentPeriodEnd
      ),
  };
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request:
    NextRequest
) {
  try {
    const stripeSecretKey =
      process.env
        .STRIPE_SECRET_KEY;

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !stripeSecretKey ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "FleetOS payment verification is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // AUTHENTICATED USER
    // ========================================================

    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase
        .auth
        .getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Your FleetOS session could not be verified. Please sign in again.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !user.email_confirmed_at
    ) {
      return NextResponse.json(
        {
          error:
            "Your email must be verified before payment can be confirmed.",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

    const body =
      (await request.json()) as
        CheckoutStatusRequest;

    const sessionId =
      clean(
        body.sessionId
      );

    if (
      !sessionId ||
      !sessionId.startsWith(
        "cs_"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid Stripe Checkout Session is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // STRIPE + SUPABASE ADMIN
    // ========================================================

    const stripe =
      new Stripe(
        stripeSecretKey
      );

    const admin =
      createAdminClient(
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

    // ========================================================
    // 1. CHECK FOR EXISTING MEMBERSHIP
    //
    // If onboarding already completed, return success.
    // This preserves the existing idempotent behavior.
    // ========================================================

    const {
      data:
        existingMembership,
      error:
        existingMembershipError,
    } =
      await admin
        .from(
          "company_members"
        )
        .select(
          "company_id, role, is_active"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

    if (
      existingMembershipError
    ) {
      console.error(
        "Checkout status membership lookup:",
        existingMembershipError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your FleetOS membership.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      existingMembership
    ) {
      return NextResponse.json({
        complete: true,
        paymentStatus:
          "paid",
        companyId:
          existingMembership
            .company_id,
        role:
          existingMembership
            .role,
      });
    }

    // ========================================================
    // 2. LOAD SERVER-SIDE PENDING SIGNUP
    //
    // Company and plan information must come from FleetOS,
    // never from browser-supplied onboarding fields.
    // ========================================================

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
            stripe_customer_id,
            stripe_subscription_id,
            payment_status
          `
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      pendingError
    ) {
      console.error(
        "Checkout status pending signup lookup:",
        pendingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your pending FleetOS signup.",
        },
        {
          status: 500,
        }
      );
    }

    if (!pending) {
      return NextResponse.json(
        {
          error:
            "No pending FleetOS company signup was found for this account.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // EXACT CHECKOUT SESSION OWNERSHIP
    // ========================================================

    if (
      pending
        .stripe_checkout_session_id !==
      sessionId
    ) {
      return NextResponse.json(
        {
          error:
            "This Checkout Session does not belong to your FleetOS signup.",
        },
        {
          status: 403,
        }
      );
    }

    // ========================================================
    // 3. RETRIEVE CHECKOUT SESSION DIRECTLY FROM STRIPE
    // ========================================================

    let session:
      Stripe.Checkout.Session;

    try {
      session =
        await stripe
          .checkout
          .sessions
          .retrieve(
            sessionId
          );
    } catch (
      stripeError
    ) {
      console.error(
        "Stripe Checkout Session retrieval:",
        stripeError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify this payment with Stripe.",
        },
        {
          status: 502,
        }
      );
    }

    // ========================================================
    // 4. VERIFY OWNERSHIP + PLAN METADATA
    // ========================================================

    const sessionUserId =
      session.metadata
        ?.fleetos_user_id ||
      session
        .client_reference_id ||
      "";

    const sessionPlanCode =
      session.metadata
        ?.fleetos_plan_code ||
      "";

    if (
      sessionUserId !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe payment ownership verification failed.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      !sessionPlanCode ||
      sessionPlanCode !==
        pending.plan_code
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe plan verification failed.",
        },
        {
          status: 409,
        }
      );
    }

    if (
      session.mode !==
      "subscription"
    ) {
      return NextResponse.json(
        {
          error:
            "This Stripe Checkout Session is not a FleetOS subscription.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 5. STRIPE MUST CONFIRM PAYMENT
    // ========================================================

    if (
      session
        .payment_status !==
        "paid" &&
      session
        .payment_status !==
        "no_payment_required"
    ) {
      return NextResponse.json({
        complete: false,
        paymentStatus:
          session
            .payment_status,
        checkoutStatus:
          session.status,
      });
    }

    if (
      session.status !==
      "complete"
    ) {
      return NextResponse.json({
        complete: false,
        paymentStatus:
          session
            .payment_status,
        checkoutStatus:
          session.status,
      });
    }

    // ========================================================
    // 6. RESOLVE CUSTOMER + SUBSCRIPTION IDs
    // ========================================================

    const stripeCustomerId =
      typeof session.customer ===
      "string"
        ? session.customer
        : session.customer
            ?.id;

    const stripeSubscriptionId =
      typeof session
        .subscription ===
      "string"
        ? session.subscription
        : session.subscription
            ?.id;

    if (
      !stripeCustomerId ||
      !stripeSubscriptionId
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe did not return the required subscription information.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 7. RETRIEVE + VERIFY STRIPE SUBSCRIPTION
    // ========================================================

    let subscription:
      Stripe.Subscription;

    try {
      subscription =
        await stripe
          .subscriptions
          .retrieve(
            stripeSubscriptionId
          );
    } catch (
      subscriptionError
    ) {
      console.error(
        "Stripe subscription retrieval:",
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your FleetOS subscription with Stripe.",
        },
        {
          status: 502,
        }
      );
    }

    if (
      subscription
        .metadata
        ?.fleetos_user_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe subscription ownership verification failed.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      subscription
        .metadata
        ?.fleetos_plan_code !==
      pending.plan_code
    ) {
      return NextResponse.json(
        {
          error:
            "Stripe subscription plan verification failed.",
        },
        {
          status: 409,
        }
      );
    }

    const firstItem =
      subscription
        .items
        .data[0];

    const stripePriceId =
      firstItem
        ?.price
        ?.id;

    if (!stripePriceId) {
      return NextResponse.json(
        {
          error:
            "Stripe subscription price information is missing.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 8. READ STRIPE BILLING PERIOD
    //
    // Stripe 22.x / current Billing API exposes the current
    // billing period on the subscription item.
    // ========================================================

    const {
      currentPeriodStart,
      currentPeriodEnd,
      nextBillingDate,
    } =
      getSubscriptionPeriod(
        subscription
      );

    if (
      !currentPeriodStart ||
      !currentPeriodEnd ||
      !nextBillingDate
    ) {
      console.error(
        "Stripe subscription billing period is missing:",
        {
          subscriptionId:
            stripeSubscriptionId,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate,
        }
      );

      return NextResponse.json(
        {
          error:
            "Stripe did not return the required billing period information.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 9. COMPLETE PAID ONBOARDING
    //
    // This is the same secure server-side RPC used by the
    // webhook and remains intentionally idempotent.
    // ========================================================

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
            user.id,

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
            pending.email,

          plan_code_input:
            pending
              .plan_code,

          stripe_customer_id_input:
            stripeCustomerId,

          stripe_subscription_id_input:
            stripeSubscriptionId,

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
      console.error(
        "Checkout recovery onboarding:",
        onboardingError
      );

      return NextResponse.json(
        {
          error:
            "Your payment was confirmed, but FleetOS could not finish creating your workspace.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 10. SYNCHRONIZE STRIPE BILLING DATES
    //
    // This is the key recovery addition.
    //
    // Even if checkout.session.completed was missed by the
    // webhook listener, recovery now stores Stripe's actual
    // billing period and next renewal date.
    // ========================================================

    const {
      data:
        subscriptionRecord,
      error:
        subscriptionLookupError,
    } =
      await admin
        .from(
          "company_subscriptions"
        )
        .select(
          "id, company_id"
        )
        .eq(
          "stripe_subscription_id",
          stripeSubscriptionId
        )
        .maybeSingle();

    if (
      subscriptionLookupError
    ) {
      console.error(
        "Checkout recovery subscription lookup:",
        subscriptionLookupError
      );

      return NextResponse.json(
        {
          error:
            "Payment was confirmed, but FleetOS could not locate the subscription record.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !subscriptionRecord
    ) {
      console.error(
        "Checkout recovery subscription record missing:",
        {
          stripeSubscriptionId,
          onboardingResult,
        }
      );

      return NextResponse.json(
        {
          error:
            "Payment was confirmed, but FleetOS could not locate the new subscription.",
        },
        {
          status: 500,
        }
      );
    }

    const {
      error:
        billingSyncError,
    } =
      await admin
        .from(
          "company_subscriptions"
        )
        .update({
          status:
            "active",

          current_period_start:
            currentPeriodStart,

          current_period_end:
            currentPeriodEnd,

          next_billing_date:
            nextBillingDate,

          stripe_customer_id:
            stripeCustomerId,

          stripe_subscription_id:
            stripeSubscriptionId,

          stripe_checkout_session_id:
            session.id,

          stripe_price_id:
            stripePriceId,

          stripe_payment_status:
            session
              .payment_status,

          suspended_at:
            null,

          cancelled_at:
            null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          subscriptionRecord.id
        );

    if (
      billingSyncError
    ) {
      console.error(
        "Checkout recovery billing synchronization:",
        billingSyncError
      );

      return NextResponse.json(
        {
          error:
            "Your payment was confirmed and your workspace was created, but FleetOS could not synchronize the billing period.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 11. VERIFY MEMBERSHIP AFTER ONBOARDING
    // ========================================================

    const {
      data:
        membership,
      error:
        membershipError,
    } =
      await admin
        .from(
          "company_members"
        )
        .select(
          "company_id, role, is_active"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

    if (
      membershipError ||
      !membership
    ) {
      console.error(
        "Checkout recovery membership verification:",
        membershipError,
        onboardingResult
      );

      return NextResponse.json(
        {
          error:
            "Payment was confirmed, but FleetOS could not verify your new workspace.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 12. FINAL SUCCESS
    // ========================================================

    return NextResponse.json({
      complete: true,

      paymentStatus:
        session
          .payment_status,

      checkoutStatus:
        session.status,

      companyId:
        membership
          .company_id,

      role:
        membership.role,

      billing: {
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate,
      },
    });
  } catch (error) {
    console.error(
      "FleetOS Checkout status error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to verify your FleetOS payment.",
      },
      {
        status: 500,
      }
    );
  }
}