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
  min_trucks: number | string | null;
  max_trucks: number | string | null;
  is_active: boolean;
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
    .from("trucks")
    .select(
      "id, truck_number, year, make, model, vin, license_plate, license_state, current_mileage, status, registration_expiration, inspection_expiration, insurance_expiration, notes"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    trucks: data ?? [],
  });
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

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("company_members")
    .select("company_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    console.error(
      "Truck membership lookup error:",
      membershipError
    );

    return NextResponse.json(
      {
        error:
          "Active company membership not found.",
      },
      { status: 403 }
    );
  }

  const companyId = membership.company_id;
  const role = membership.role as CompanyRole;

  const canCreateTruck =
    role === "owner" ||
    role === "admin" ||
    role === "fleet_manager";

  if (!canCreateTruck) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to add trucks.",
      },
      { status: 403 }
    );
  }

  const body = await request.json();

  const truckNumber = String(
    body.truck_number ?? ""
  ).trim();

  if (!truckNumber) {
    return NextResponse.json(
      {
        error:
          "Truck number is required",
      },
      { status: 400 }
    );
  }

  const {
    data: subscription,
    error: subscriptionError,
  } = await supabase
    .from("company_subscriptions")
    .select("id, plan_name, status, created_at")
    .eq("company_id", companyId)
    .in("status", [
      "trial",
      "active",
      "past_due",
    ])
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    console.error(
      "Truck subscription lookup error:",
      subscriptionError
    );

    return NextResponse.json(
      {
        error:
          "Unable to verify your FleetOS subscription.",
      },
      { status: 500 }
    );
  }

  if (!subscription) {
    return NextResponse.json(
      {
        error:
          "An active FleetOS subscription or trial is required to add trucks.",
        code:
          "SUBSCRIPTION_REQUIRED",
      },
      { status: 403 }
    );
  }

  const {
    data: plans,
    error: plansError,
  } = await supabase
    .from("subscription_plans")
    .select(
      "plan_code, plan_name, min_trucks, max_trucks, is_active"
    )
    .eq("is_active", true);

  if (plansError) {
    console.error(
      "Truck plan catalog lookup error:",
      plansError
    );

    return NextResponse.json(
      {
        error:
          "Unable to verify the truck limit for your FleetOS plan.",
      },
      { status: 500 }
    );
  }

  const normalizedSubscriptionPlan =
    normalizePlanName(subscription.plan_name);

  const plan = (plans ?? []).find(
    (candidate: PlanRow) =>
      normalizePlanName(candidate.plan_name) ===
        normalizedSubscriptionPlan ||
      normalizePlanName(candidate.plan_code) ===
        normalizedSubscriptionPlan
  ) as PlanRow | undefined;

  if (!plan) {
    console.error(
      "Subscription plan not found in catalog:",
      subscription.plan_name
    );

    return NextResponse.json(
      {
        error:
          `FleetOS could not determine the truck limit for ${subscription.plan_name}. Please contact Platinum Digital Services LLC.`,
        code:
          "PLAN_NOT_FOUND",
      },
      { status: 403 }
    );
  }

  const truckLimit =
    plan.max_trucks === null
      ? null
      : Number(plan.max_trucks);

  if (truckLimit !== null) {
    const {
      count,
      error: countError,
    } = await supabase
      .from("trucks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("company_id", companyId);

    if (countError) {
      console.error(
        "Truck count error:",
        countError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your current truck count.",
        },
        { status: 500 }
      );
    }

    const currentTruckCount =
      count ?? 0;

    if (currentTruckCount >= truckLimit) {
      return NextResponse.json(
        {
          error:
            `${plan.plan_name} supports up to ${truckLimit} trucks. ` +
            `Your company currently has ${currentTruckCount}. ` +
            `Upgrade your FleetOS plan to add another truck.`,
          code:
            "TRUCK_LIMIT_REACHED",
          planName:
            plan.plan_name,
          currentTrucks:
            currentTruckCount,
          maxTrucks:
            truckLimit,
        },
        { status: 403 }
      );
    }
  }

  const {
    data,
    error,
  } = await supabase
    .from("trucks")
    .insert({
      company_id: companyId,
      truck_number: truckNumber,
      year: body.year ?? null,
      make: body.make ?? null,
      model: body.model ?? null,
      vin: body.vin ?? null,
      license_plate: body.license_plate ?? null,
      license_state: body.license_state ?? null,
      current_mileage: body.current_mileage ?? 0,
      status: body.status ?? "active",
      registration_expiration:
        body.registration_expiration ?? null,
      inspection_expiration:
        body.inspection_expiration ?? null,
      insurance_expiration:
        body.insurance_expiration ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "Truck creation error:",
      error
    );

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { truck: data },
    { status: 201 }
  );
}
