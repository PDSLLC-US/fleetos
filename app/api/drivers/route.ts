import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CompanyRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "accountant"
  | "fleet_manager"
  | "driver";

type PlanRow = {
  plan_code: string;
  plan_name: string;
  max_trucks: number | string | null;
};

function normalizePlanName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^fleetos\s+/, "");
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("drivers")
    .select(
      "id, first_name, last_name, phone, email, cdl_number, cdl_state, cdl_expiration, medical_card_expiration, pay_type, pay_rate, status, hire_date, notes"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ drivers: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("company_members")
      .select("company_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError || !membership?.company_id) {
    console.error("Driver membership lookup error:", membershipError);
    return NextResponse.json(
      { error: "Active company membership not found." },
      { status: 403 }
    );
  }

  const companyId = membership.company_id;
  const role = membership.role as CompanyRole;

  const canCreateDriver =
    role === "owner" ||
    role === "admin" ||
    role === "fleet_manager";

  if (!canCreateDriver) {
    return NextResponse.json(
      { error: "You do not have permission to add drivers." },
      { status: 403 }
    );
  }

  const body = await request.json();

  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 }
    );
  }

  const allowedPayTypes = [
    "percentage",
    "per_mile",
    "flat_rate",
    "hourly",
  ];

  const allowedStatuses = [
    "active",
    "inactive",
    "on_leave",
  ];

  if (!allowedPayTypes.includes(body.pay_type)) {
    return NextResponse.json(
      { error: "Invalid pay type" },
      { status: 400 }
    );
  }

  if (!allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid driver status" },
      { status: 400 }
    );
  }

  const { data: subscription, error: subscriptionError } =
    await supabase
      .from("company_subscriptions")
      .select("id, plan_name, status, created_at")
      .eq("company_id", companyId)
      .in("status", ["trial", "active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (subscriptionError) {
    console.error("Driver subscription lookup error:", subscriptionError);
    return NextResponse.json(
      { error: "Unable to verify your FleetOS subscription." },
      { status: 500 }
    );
  }

  if (!subscription) {
    return NextResponse.json(
      {
        error:
          "An active FleetOS subscription or trial is required to add drivers.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 }
    );
  }

  const { data: plans, error: plansError } = await supabase
    .from("subscription_plans")
    .select("plan_code, plan_name, max_trucks")
    .eq("is_active", true);

  if (plansError) {
    console.error("Driver plan lookup error:", plansError);
    return NextResponse.json(
      { error: "Unable to verify the driver limit for your FleetOS plan." },
      { status: 500 }
    );
  }

  const normalizedSubscriptionPlan =
    normalizePlanName(subscription.plan_name);

  const plan = (plans ?? []).find(
    (candidate: PlanRow) =>
      normalizePlanName(candidate.plan_name) === normalizedSubscriptionPlan ||
      normalizePlanName(candidate.plan_code) === normalizedSubscriptionPlan
  ) as PlanRow | undefined;

  if (!plan) {
    return NextResponse.json(
      {
        error:
          `FleetOS could not determine the driver limit for ${subscription.plan_name}. Please contact Platinum Digital Services LLC.`,
        code: "PLAN_NOT_FOUND",
      },
      { status: 403 }
    );
  }

  // Driver allowance intentionally mirrors the plan's truck allowance.
  // max_trucks = null means unlimited.
  const driverLimit =
    plan.max_trucks === null ? null : Number(plan.max_trucks);

  if (driverLimit !== null) {
    const { count, error: countError } = await supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    if (countError) {
      console.error("Driver count error:", countError);
      return NextResponse.json(
        { error: "Unable to verify your current driver count." },
        { status: 500 }
      );
    }

    const currentDriverCount = count ?? 0;

    if (currentDriverCount >= driverLimit) {
      return NextResponse.json(
        {
          error:
            `${plan.plan_name} supports up to ${driverLimit} drivers. ` +
            `Your company currently has ${currentDriverCount}. ` +
            `Upgrade your FleetOS plan to add another driver.`,
          code: "DRIVER_LIMIT_REACHED",
          planName: plan.plan_name,
          currentDrivers: currentDriverCount,
          maxDrivers: driverLimit,
        },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase
    .from("drivers")
    .insert({
      company_id: companyId,
      first_name: firstName,
      last_name: lastName,
      phone: body.phone ?? null,
      email: body.email ?? null,
      cdl_number: body.cdl_number ?? null,
      cdl_state: body.cdl_state ?? null,
      cdl_expiration: body.cdl_expiration ?? null,
      medical_card_expiration:
        body.medical_card_expiration ?? null,
      pay_type: body.pay_type,
      pay_rate: body.pay_rate ?? null,
      status: body.status,
      hire_date: body.hire_date ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Driver creation error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { driver: data },
    { status: 201 }
  );
}
