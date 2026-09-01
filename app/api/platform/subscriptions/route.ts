import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = [
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;

const ALLOWED_BILLING_CYCLES = [
  "monthly",
  "quarterly",
  "annual",
  "custom",
] as const;

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    // ==========================================================
    // AUTHENTICATED USER
    // ==========================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================================
    // VERIFY PLATINUM PLATFORM ADMIN
    // ==========================================================

    const {
      data: platformAdmin,
      error: platformAdminError,
    } = await supabase
      .from("platform_admins")
      .select("user_id,is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (platformAdminError) {
      console.error(
        "Platform admin verification error:",
        platformAdminError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify FleetOS platform access.",
        },
        {
          status: 500,
        }
      );
    }

    if (!platformAdmin) {
      return NextResponse.json(
        {
          error:
            "Platinum Platform Administrator access required.",
        },
        {
          status: 403,
        }
      );
    }

    // ==========================================================
    // REQUEST BODY
    // ==========================================================

    const body = await request.json();

    const companyId =
      String(body.companyId ?? "").trim();

    const planName =
      String(body.planName ?? "").trim();

    const billingCycle =
      String(body.billingCycle ?? "")
        .trim()
        .toLowerCase();

    const status =
      String(body.status ?? "")
        .trim()
        .toLowerCase();

    const subscriptionPrice =
      Number(body.subscriptionPrice);

    const nextBillingDate =
      body.nextBillingDate
        ? String(body.nextBillingDate)
        : null;

    const trialEndsAt =
      body.trialEndsAt
        ? String(body.trialEndsAt)
        : null;

    const notes =
      body.notes
        ? String(body.notes).trim()
        : null;

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!companyId) {
      return NextResponse.json(
        {
          error: "Company is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!planName) {
      return NextResponse.json(
        {
          error: "Plan name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_BILLING_CYCLES.includes(
        billingCycle as
          (typeof ALLOWED_BILLING_CYCLES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid billing cycle.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_STATUSES.includes(
        status as
          (typeof ALLOWED_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid subscription status.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(subscriptionPrice) ||
      subscriptionPrice < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Subscription price must be a valid positive amount.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // VERIFY COMPANY
    // ==========================================================

    const {
      data: company,
      error: companyError,
    } = await supabase
      .from("companies")
      .select("id,name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      console.error(
        "Platform company lookup error:",
        companyError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify company.",
        },
        {
          status: 500,
        }
      );
    }

    if (!company) {
      return NextResponse.json(
        {
          error:
            "FleetOS company not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // EXISTING SUBSCRIPTION
    // ==========================================================

    const {
      data: existingSubscription,
      error: existingError,
    } = await supabase
      .from("company_subscriptions")
      .select("id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing subscription lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check existing subscription.",
        },
        {
          status: 500,
        }
      );
    }

    const now =
      new Date().toISOString();

    const subscriptionData = {
      company_id: companyId,
      plan_name: planName,
      billing_cycle: billingCycle,
      subscription_price:
        subscriptionPrice,
      status,

      trial_starts_at:
        status === "trial"
          ? now
          : null,

      trial_ends_at:
        status === "trial"
          ? trialEndsAt
          : null,

      activated_at:
        status === "active"
          ? now
          : null,

      suspended_at:
        status === "suspended"
          ? now
          : null,

      cancelled_at:
        status === "cancelled"
          ? now
          : null,

      next_billing_date:
        nextBillingDate,

      notes,
      updated_at: now,
    };

    // ==========================================================
    // UPDATE EXISTING
    // ==========================================================

    if (existingSubscription) {
      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from("company_subscriptions")
        .update(subscriptionData)
        .eq(
          "id",
          existingSubscription.id
        )
        .select()
        .single();

      if (updateError) {
        console.error(
          "Subscription update error:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              updateError.message ||
              "Unable to update subscription.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        action: "updated",
        subscription: updated,
      });
    }

    // ==========================================================
    // CREATE NEW
    // ==========================================================

    const {
      data: created,
      error: createError,
    } = await supabase
      .from("company_subscriptions")
      .insert(subscriptionData)
      .select()
      .single();

    if (createError) {
      console.error(
        "Subscription creation error:",
        createError
      );

      return NextResponse.json(
        {
          error:
            createError.message ||
            "Unable to create subscription.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      action: "created",
      subscription: created,
    });
  } catch (error) {
    console.error(
      "FleetOS subscription API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to save FleetOS subscription.",
      },
      {
        status: 500,
      }
    );
  }
}