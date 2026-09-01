import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan_name: string;
  billing_cycle: string;
  subscription_price: number | string | null;
  status: string;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyRow = {
  id: string;
  name: string;
  legal_name: string | null;
  mc_number: string | null;
  dot_number: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
};

function money(
  value: number | string | null | undefined
) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function monthlyEquivalent(
  price: number,
  billingCycle: string
) {
  switch (billingCycle) {
    case "monthly":
      return price;

    case "quarterly":
      return price / 3;

    case "annual":
      return price / 12;

    /*
     * Custom subscriptions are not included in MRR until
     * we have a defined monthly-equivalent billing rule.
     */
    case "custom":
    default:
      return 0;
  }
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    // ==========================================================
    // AUTHENTICATED USER
    // ==========================================================

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

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
    // LOAD CLIENT COMPANIES
    // ==========================================================

    const {
      data: companiesData,
      error: companiesError,
    } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        legal_name,
        mc_number,
        dot_number,
        phone,
        email,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (companiesError) {
      console.error(
        "Platform companies query error:",
        companiesError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load FleetOS client companies.",
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================================
    // LOAD SUBSCRIPTIONS
    // ==========================================================

    const {
      data: subscriptionsData,
      error: subscriptionsError,
    } = await supabase
      .from("company_subscriptions")
      .select(`
        id,
        company_id,
        plan_name,
        billing_cycle,
        subscription_price,
        status,
        trial_starts_at,
        trial_ends_at,
        current_period_start,
        current_period_end,
        next_billing_date,
        activated_at,
        suspended_at,
        cancelled_at,
        notes,
        created_at,
        updated_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (subscriptionsError) {
      console.error(
        "Platform subscriptions query error:",
        subscriptionsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load FleetOS subscriptions.",
        },
        {
          status: 500,
        }
      );
    }

    const companies =
      (companiesData ?? []) as CompanyRow[];

    const subscriptions =
      (subscriptionsData ?? []) as SubscriptionRow[];

    // ==========================================================
    // SUBSCRIPTION LOOKUP
    // ==========================================================

    const subscriptionByCompany =
      new Map<string, SubscriptionRow>();

    for (const subscription of subscriptions) {
      subscriptionByCompany.set(
        subscription.company_id,
        subscription
      );
    }

    // ==========================================================
    // PLATFORM KPIs
    // ==========================================================

    const totalClients =
      companies.length;

    const activeSubscriptions =
      subscriptions.filter(
        (subscription) =>
          subscription.status === "active"
      ).length;

    const trials =
      subscriptions.filter(
        (subscription) =>
          subscription.status === "trial"
      ).length;

    const pastDue =
      subscriptions.filter(
        (subscription) =>
          subscription.status === "past_due"
      ).length;

    const suspended =
      subscriptions.filter(
        (subscription) =>
          subscription.status === "suspended"
      ).length;

    const cancelled =
      subscriptions.filter(
        (subscription) =>
          subscription.status === "cancelled"
      ).length;

    // ==========================================================
    // MONTHLY RECURRING REVENUE
    //
    // Only ACTIVE subscriptions contribute to MRR.
    // ==========================================================

    const monthlyRecurringRevenue =
      subscriptions
        .filter(
          (subscription) =>
            subscription.status === "active"
        )
        .reduce(
          (total, subscription) => {
            const price =
              money(
                subscription.subscription_price
              );

            return (
              total +
              monthlyEquivalent(
                price,
                subscription.billing_cycle
              )
            );
          },
          0
        );

    // ==========================================================
    // CLIENT TABLE
    // ==========================================================

    const clients =
      companies.map((company) => {
        const subscription =
          subscriptionByCompany.get(
            company.id
          );

        return {
          companyId:
            company.id,

          companyName:
            company.name,

          legalName:
            company.legal_name,

          mcNumber:
            company.mc_number,

          dotNumber:
            company.dot_number,

          phone:
            company.phone,

          email:
            company.email,

          companyCreatedAt:
            company.created_at,

          subscriptionId:
            subscription?.id ?? null,

          planName:
            subscription?.plan_name ??
            "Unassigned",

          billingCycle:
            subscription?.billing_cycle ??
            null,

          subscriptionPrice:
            subscription
              ? money(
                  subscription.subscription_price
                )
              : 0,

          subscriptionStatus:
            subscription?.status ??
            "unassigned",

          trialEndsAt:
            subscription?.trial_ends_at ??
            null,

          nextBillingDate:
            subscription?.next_billing_date ??
            null,

          activatedAt:
            subscription?.activated_at ??
            null,
        };
      });

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return NextResponse.json({
      platform: {
        name:
          "FleetOS",

        provider:
          "Platinum Digital Services LLC",
      },

      admin: {
        userId:
          user.id,

        email:
          user.email ?? null,
      },

      metrics: {
        totalClients,
        activeSubscriptions,
        monthlyRecurringRevenue,
        trials,
        pastDue,
        suspended,
        cancelled,
      },

      clients,
    });
  } catch (error) {
    console.error(
      "FleetOS platform dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load FleetOS platform dashboard.",
      },
      {
        status: 500,
      }
    );
  }
}