import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      "id, truck_number, year, make, model, vin, license_plate, license_state, current_mileage, status"
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: "Company profile not found" },
      { status: 400 }
    );
  }

  const body = await request.json();

  if (!body.truck_number?.trim()) {
    return NextResponse.json(
      { error: "Truck number is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("trucks")
    .insert({
      company_id: profile.company_id,
      truck_number: body.truck_number.trim(),
      year: body.year ?? null,
      make: body.make ?? null,
      model: body.model ?? null,
      vin: body.vin ?? null,
      license_plate: body.license_plate ?? null,
      license_state: body.license_state ?? null,
      current_mileage: body.current_mileage ?? 0,
      status: body.status ?? "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      truck: data,
    },
    { status: 201 }
  );
}