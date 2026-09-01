import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PlanPayload = {
  id?: string;
  planName?: string;
  monthlyPrice?: number;
  minTrucks?: number;
  maxTrucks?: number | null;
  description?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
};

async function requirePlatformAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_platform_admin"
  );

  if (adminError || isAdmin !== true) {
    return {
      supabase,
      error: NextResponse.json(
        { error: "Platinum Platform Administrator access required." },
        { status: 403 }
      ),
    };
  }

  return { supabase, error: null };
}

export async function GET() {
  try {
    const { supabase, error } = await requirePlatformAdmin();
    if (error) return error;

    const { data, error: plansError } = await supabase
      .from("subscription_plans")
      .select(`
        id,
        plan_code,
        plan_name,
        monthly_price,
        min_trucks,
        max_trucks,
        description,
        is_active,
        is_featured,
        display_order
      `)
      .order("display_order", { ascending: true })
      .order("monthly_price", { ascending: true });

    if (plansError) {
      console.error("Platform plans query error:", plansError);
      return NextResponse.json(
        { error: "Unable to load FleetOS plans." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      plans: (data ?? []).map((plan) => ({
        id: plan.id,
        planCode: plan.plan_code,
        planName: plan.plan_name,
        monthlyPrice: Number(plan.monthly_price ?? 0),
        minTrucks: Number(plan.min_trucks ?? 0),
        maxTrucks:
          plan.max_trucks === null ? null : Number(plan.max_trucks),
        description: plan.description,
        isActive: plan.is_active === true,
        isFeatured: plan.is_featured === true,
        displayOrder: Number(plan.display_order ?? 0),
      })),
    });
  } catch (error) {
    console.error("FleetOS platform plans GET error:", error);
    return NextResponse.json(
      { error: "Unable to load FleetOS plans." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, error } = await requirePlatformAdmin();
    if (error) return error;

    const body = (await request.json()) as PlanPayload;

    if (!body.id || !body.planName?.trim()) {
      return NextResponse.json(
        { error: "Plan ID and plan name are required." },
        { status: 400 }
      );
    }

    const monthlyPrice = Number(body.monthlyPrice);
    const minTrucks = Number(body.minTrucks);
    const maxTrucks =
      body.maxTrucks === null || body.maxTrucks === undefined
        ? null
        : Number(body.maxTrucks);
    const displayOrder = Number(body.displayOrder ?? 0);

    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      return NextResponse.json(
        { error: "Monthly price must be zero or greater." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(minTrucks) || minTrucks < 0) {
      return NextResponse.json(
        { error: "Minimum trucks must be a whole number of zero or greater." },
        { status: 400 }
      );
    }

    if (
      maxTrucks !== null &&
      (!Number.isInteger(maxTrucks) || maxTrucks < minTrucks)
    ) {
      return NextResponse.json(
        { error: "Maximum trucks must be blank or at least the minimum trucks." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      return NextResponse.json(
        { error: "Display order must be a whole number of zero or greater." },
        { status: 400 }
      );
    }

    // Keep only one featured plan at a time.
    if (body.isFeatured === true) {
      const { error: clearFeaturedError } = await supabase
        .from("subscription_plans")
        .update({ is_featured: false })
        .neq("id", body.id);

      if (clearFeaturedError) {
        console.error("Unable to clear featured plan:", clearFeaturedError);
        return NextResponse.json(
          { error: "Unable to update featured plan." },
          { status: 500 }
        );
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("subscription_plans")
      .update({
        plan_name: body.planName.trim(),
        monthly_price: monthlyPrice,
        min_trucks: minTrucks,
        max_trucks: maxTrucks,
        description: body.description?.trim() || null,
        is_active: body.isActive !== false,
        is_featured: body.isFeatured === true,
        display_order: displayOrder,
      })
      .eq("id", body.id)
      .select(`
        id,
        plan_code,
        plan_name,
        monthly_price,
        min_trucks,
        max_trucks,
        description,
        is_active,
        is_featured,
        display_order
      `)
      .single();

    if (updateError) {
      console.error("Platform plan update error:", updateError);
      return NextResponse.json(
        { error: "Unable to save FleetOS plan." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: updated,
    });
  } catch (error) {
    console.error("FleetOS platform plans POST error:", error);
    return NextResponse.json(
      { error: "Unable to save FleetOS plan." },
      { status: 500 }
    );
  }
}
