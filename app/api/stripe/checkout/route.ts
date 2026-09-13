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

type CheckoutRequestBody = {
  planCode?: string;

  ownerName?: string;
  companyName?: string;
  legalName?: string;
  mcNumber?: string;
  dotNumber?: string;
  companyPhone?: string;
};

type PendingSignup = {
  user_id: string;
  owner_name: string | null;
  email: string | null;
  company_name: string | null;
  legal_name: string | null;
  mc_number: string | null;
  dot_number: string | null;
  company_phone: string | null;
  plan_code: string | null;

  stripe_checkout_session_id:
    | string
    | null;

  stripe_customer_id:
    | string
    | null;

  stripe_subscription_id:
    | string
    | null;

  payment_status:
    | string
    | null;
};

// ============================================================
// HELPERS
// ============================================================

function clean(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function isPaidStatus(
  value:
    | string
    | null
    | undefined
) {
  return (
    value === "paid" ||
    value ===
      "no_payment_required"
  );
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

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "FleetOS server configuration is incomplete.",
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

    const supabase =
      await createClient();

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
    // 1. REQUIRE AUTHENTICATED + VERIFIED USER
    // ========================================================

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
            "Please verify your email and sign in before continuing to payment.",
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
            "Please verify your email before continuing to payment.",
        },
        {
          status: 403,
        }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          error:
            "Your FleetOS account does not have a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 2. EXISTING ACTIVE COMPANY MEMBERS MAY NOT PURCHASE
    //    ANOTHER SIGNUP SUBSCRIPTION
    // ========================================================

    const {
      data:
        existingMembership,
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

    if (membershipError) {
      console.error(
        "Stripe membership lookup:",
        membershipError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your FleetOS account.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      existingMembership
    ) {
      return NextResponse.json(
        {
          error:
            "This account already belongs to an active FleetOS company.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 3. READ SIGNUP INFORMATION
    // ========================================================

    const body =
      (await request.json()) as
        CheckoutRequestBody;

    const planCode =
      clean(
        body.planCode
      );

    const ownerName =
      clean(
        body.ownerName
      );

    const companyName =
      clean(
        body.companyName
      );

    const legalName =
      clean(
        body.legalName
      );

    const mcNumber =
      clean(
        body.mcNumber
      );

    const dotNumber =
      clean(
        body.dotNumber
      );

    const companyPhone =
      clean(
        body.companyPhone
      );

    if (!planCode) {
      return NextResponse.json(
        {
          error:
            "Please select a FleetOS plan.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ownerName) {
      return NextResponse.json(
        {
          error:
            "Owner name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!companyName) {
      return NextResponse.json(
        {
          error:
            "Company name is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // 4. LOAD AUTHORITATIVE PLAN FROM FLEETOS
    // ========================================================

    const {
      data:
        plan,
      error:
        planError,
    } =
      await admin
        .from(
          "subscription_plans"
        )
        .select(
          `
            id,
            plan_code,
            plan_name,
            monthly_price,
            min_trucks,
            max_trucks,
            description,
            is_active
          `
        )
        .eq(
          "plan_code",
          planCode
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

    if (planError) {
      console.error(
        "Stripe plan lookup:",
        planError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the selected FleetOS plan.",
        },
        {
          status: 500,
        }
      );
    }

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "The selected FleetOS plan is unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    const monthlyPrice =
      Number(
        plan.monthly_price
      );

    if (
      !Number.isFinite(
        monthlyPrice
      ) ||
      monthlyPrice <= 0
    ) {
      console.error(
        "Invalid FleetOS subscription price:",
        plan
      );

      return NextResponse.json(
        {
          error:
            "The selected FleetOS plan has an invalid price.",
        },
        {
          status: 500,
        }
      );
    }

    const unitAmount =
      Math.round(
        monthlyPrice * 100
      );

    // ========================================================
    // 5. LOAD EXISTING PENDING SIGNUP BEFORE CHANGING IT
    //
    // This is the critical hardening step.
    // ========================================================

    const {
      data:
        existingPendingRaw,
      error:
        existingPendingError,
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
      existingPendingError
    ) {
      console.error(
        "Existing pending signup lookup:",
        existingPendingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your existing FleetOS signup.",
        },
        {
          status: 500,
        }
      );
    }

    const existingPending =
      existingPendingRaw as
        | PendingSignup
        | null;

    // ========================================================
    // 6. NEVER OVERWRITE A SIGNUP ALREADY MARKED PAID
    // ========================================================

    if (
      existingPending &&
      isPaidStatus(
        existingPending
          .payment_status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This FleetOS signup has already been paid. Please continue to your workspace instead of starting another payment.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 7. CHECK EXISTING STRIPE SESSION
    //
    // Do not trust only our local payment_status. Stripe is
    // authoritative if a Checkout Session already exists.
    // ========================================================

    if (
      existingPending
        ?.stripe_checkout_session_id
    ) {
      const existingSessionId =
        existingPending
          .stripe_checkout_session_id;

      try {
        const existingSession =
          await stripe
            .checkout
            .sessions
            .retrieve(
              existingSessionId
            );

        const sessionUserId =
          existingSession
            .metadata
            ?.fleetos_user_id ||
          existingSession
            .client_reference_id ||
          "";

        const sessionPlanCode =
          existingSession
            .metadata
            ?.fleetos_plan_code ||
          "";

        // ----------------------------------------------------
        // Existing session must belong to this user.
        // ----------------------------------------------------

        if (
          sessionUserId !==
          user.id
        ) {
          console.error(
            "Existing Checkout Session ownership mismatch:",
            {
              userId:
                user.id,
              sessionId:
                existingSession.id,
            }
          );

          return NextResponse.json(
            {
              error:
                "FleetOS found an existing payment session that could not be verified. Please contact support.",
            },
            {
              status: 409,
            }
          );
        }

        // ----------------------------------------------------
        // CRITICAL:
        // Stripe says the existing session is already paid.
        //
        // Never replace its ID with another Checkout Session.
        // Send the browser into the recovery flow instead.
        // ----------------------------------------------------

        if (
          isPaidStatus(
            existingSession
              .payment_status
          ) &&
          existingSession
            .status ===
            "complete"
        ) {
          return NextResponse.json(
            {
              recoveryRequired:
                true,

              sessionId:
                existingSession.id,

              recoveryUrl:
                `/signup/payment-complete?session_id=${encodeURIComponent(
                  existingSession.id
                )}`,

              message:
                "Your previous FleetOS payment was already completed. FleetOS will recover that payment instead of creating another charge.",
            },
            {
              status: 409,
            }
          );
        }

        // ----------------------------------------------------
        // If an unpaid Checkout Session is still OPEN and it
        // is for the SAME plan, reuse it.
        //
        // This prevents double-clicks / refreshes from creating
        // unnecessary duplicate Stripe sessions.
        // ----------------------------------------------------

        if (
          existingSession
            .status ===
            "open" &&
          !isPaidStatus(
            existingSession
              .payment_status
          ) &&
          sessionPlanCode ===
            plan.plan_code &&
          existingSession.url
        ) {
          return NextResponse.json({
            url:
              existingSession.url,

            sessionId:
              existingSession.id,

            reused:
              true,
          });
        }

        // ----------------------------------------------------
        // If an old unpaid session is still open but the user
        // changed plans, expire the old session first.
        // ----------------------------------------------------

        if (
          existingSession
            .status ===
          "open"
        ) {
          try {
            await stripe
              .checkout
              .sessions
              .expire(
                existingSession.id
              );
          } catch (
            expireError
          ) {
            console.error(
              "Unable to expire previous Stripe Checkout Session:",
              expireError
            );

            return NextResponse.json(
              {
                error:
                  "FleetOS could not safely replace your previous payment session. Please try again.",
              },
              {
                status: 500,
              }
            );
          }
        }
      } catch (
        existingSessionError
      ) {
        console.error(
          "Existing Stripe Checkout Session lookup:",
          existingSessionError
        );

        /*
         * Do NOT blindly overwrite the old session reference
         * when Stripe lookup itself failed.
         *
         * That is exactly the type of condition that could
         * destroy our ability to recover a real payment.
         */
        return NextResponse.json(
          {
            error:
              "FleetOS could not verify your previous payment session with Stripe. Please try again.",
          },
          {
            status: 502,
          }
        );
      }
    }

    // ========================================================
    // 8. SAVE / UPDATE PENDING ONBOARDING
    //
    // We have now established that there is no completed paid
    // Checkout Session that needs to be preserved.
    // ========================================================

    const {
      error:
        pendingError,
    } =
      await admin
        .from(
          "pending_company_signups"
        )
        .upsert(
          {
            user_id:
              user.id,

            owner_name:
              ownerName,

            email:
              user.email
                .trim()
                .toLowerCase(),

            company_name:
              companyName,

            legal_name:
              legalName ||
              null,

            mc_number:
              mcNumber ||
              null,

            dot_number:
              dotNumber ||
              null,

            company_phone:
              companyPhone ||
              null,

            plan_code:
              plan.plan_code,

            stripe_checkout_session_id:
              null,

            stripe_customer_id:
              null,

            stripe_subscription_id:
              null,

            payment_status:
              "pending",

            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "user_id",
          }
        );

    if (pendingError) {
      console.error(
        "Pending FleetOS signup save:",
        pendingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to prepare your company signup.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 9. DETERMINE REDIRECT ORIGIN
    // ========================================================

    const requestOrigin =
      request.nextUrl.origin;

    const configuredOrigin =
      process.env
        .NEXT_PUBLIC_SITE_URL
        ?.trim();

    const origin =
      configuredOrigin ||
      requestOrigin ||
      "http://localhost:3000";

    // ========================================================
    // 10. CREATE NEW STRIPE CHECKOUT SESSION
    // ========================================================

    const session =
      await stripe
        .checkout
        .sessions
        .create({
  mode:
    "subscription",

  adaptive_pricing: {
    enabled: false,
  },

  payment_method_types: [
    "card",
  ],

  customer_email:
    user.email,
          client_reference_id:
            user.id,

          line_items: [
            {
              quantity: 1,

              price_data: {
                currency:
                  "usd",

                unit_amount:
                  unitAmount,

                recurring: {
                  interval:
                    "month",
                },

                product_data: {
                  name:
                    `FleetOS ${plan.plan_name}`,

                  description:
                    plan.description ||
                    `FleetOS ${plan.plan_name} monthly subscription`,
                },
              },
            },
          ],

          metadata: {
            fleetos_user_id:
              user.id,

            fleetos_plan_code:
              plan.plan_code,
          },

          subscription_data: {
            metadata: {
              fleetos_user_id:
                user.id,

              fleetos_plan_code:
                plan.plan_code,
            },
          },

          success_url:
            `${origin}/signup/payment-complete?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${origin}/signup?checkout=cancelled`,
        });

    if (!session.url) {
      /*
       * There is no usable Checkout URL.
       * Expire the session if Stripe created one.
       */
      try {
        await stripe
          .checkout
          .sessions
          .expire(
            session.id
          );
      } catch (
        expireError
      ) {
        console.error(
          "Unable to expire Stripe Checkout Session without URL:",
          expireError
        );
      }

      return NextResponse.json(
        {
          error:
            "Stripe did not return a Checkout URL.",
        },
        {
          status: 500,
        }
      );
    }

    // ========================================================
    // 11. ATTACH NEW SESSION SAFELY
    //
    // Only update a row that is STILL pending and has no
    // Checkout Session attached.
    //
    // This adds another guard against concurrent requests.
    // ========================================================

    const {
      data:
        sessionSaveResult,
      error:
        sessionSaveError,
    } =
      await admin
        .from(
          "pending_company_signups"
        )
        .update({
          stripe_checkout_session_id:
            session.id,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "payment_status",
          "pending"
        )
        .is(
          "stripe_checkout_session_id",
          null
        )
        .select(
          "user_id, stripe_checkout_session_id"
        )
        .maybeSingle();

    if (
      sessionSaveError ||
      !sessionSaveResult
    ) {
      console.error(
        "Checkout Session safe save:",
        sessionSaveError
      );

      /*
       * Another request may have won the race, or the pending
       * signup changed while Stripe was creating this session.
       *
       * Expire THIS orphaned session so it cannot be paid.
       */
      try {
        await stripe
          .checkout
          .sessions
          .expire(
            session.id
          );
      } catch (
        expireError
      ) {
        console.error(
          "Unable to expire orphaned Stripe Checkout Session:",
          expireError
        );
      }

      return NextResponse.json(
        {
          error:
            "Your FleetOS payment session changed while Checkout was being prepared. Please try again.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // 12. SUCCESS
    // ========================================================

    return NextResponse.json({
      url:
        session.url,

      sessionId:
        session.id,

      reused:
        false,
    });
  } catch (error) {
    console.error(
      "FleetOS Stripe Checkout error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to start FleetOS Checkout.",
      },
      {
        status: 500,
      }
    );
  }
}