import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

type CompanyRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "accountant"
  | "fleet_manager"
  | "driver";

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data:
        membership,

      error:
        membershipError,
    } =
      await supabase
        .from(
          "company_members"
        )
        .select(`
          company_id,
          role,
          is_active
        `)
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
      return NextResponse.json(
        {
          error:
            "Active company membership required.",
        },
        {
          status: 403,
        }
      );
    }

    const role =
      membership.role as CompanyRole;

    const isOwnerOrAdmin =
      role === "owner" ||
      role === "admin";

    const {
      data:
        subscription,

      error:
        subscriptionError,
    } =
      await supabase
        .from(
          "company_subscriptions"
        )
        .select(`
          plan_name,
          billing_cycle,
          subscription_price,
          status,
          trial_starts_at,
          trial_ends_at,
          current_period_start,
          current_period_end,
          next_billing_date,
          activated_at
        `)
        .eq(
          "company_id",
          membership.company_id
        )
        .maybeSingle();

    if (
      subscriptionError
    ) {
      console.error(
        "Company subscription query error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load FleetOS subscription.",
        },
        {
          status: 500,
        }
      );
    }

    if (!subscription) {
      return NextResponse.json({
        role,

        canViewBilling:
          isOwnerOrAdmin,

        subscription: {
          status:
            "unassigned",

          trialStartsAt:
            null,

          trialEndsAt:
            null,
        },
      });
    }

    /*
     * Every active company member may receive the subscription status
     * and trial dates because FleetOS uses those values for global
     * account notices. Staff do NOT receive plan price, billing cycle,
     * next billing date, or other customer billing details.
     */
    if (
      !isOwnerOrAdmin
    ) {
      return NextResponse.json({
        role,

        canViewBilling:
          false,

        subscription: {
          status:
            subscription.status,

          planName:
            subscription.plan_name,

          trialStartsAt:
            subscription.trial_starts_at,

          trialEndsAt:
            subscription.trial_ends_at,
        },
      });
    }

    return NextResponse.json({
      role,

      canViewBilling:
        true,

      subscription: {
        planName:
          subscription.plan_name,

        billingCycle:
          subscription.billing_cycle,

        subscriptionPrice:
          Number(
            subscription.subscription_price ??
              0
          ),

        status:
          subscription.status,

        trialStartsAt:
          subscription.trial_starts_at,

        trialEndsAt:
          subscription.trial_ends_at,

        currentPeriodStart:
          subscription.current_period_start,

        currentPeriodEnd:
          subscription.current_period_end,

        nextBillingDate:
          subscription.next_billing_date,

        activatedAt:
          subscription.activated_at,
      },
    });
  } catch (error) {
    console.error(
      "FleetOS company subscription API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load FleetOS subscription.",
      },
      {
        status: 500,
      }
    );
  }
}
