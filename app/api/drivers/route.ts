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
    .from("drivers")
    .select(
      "id, first_name, last_name, phone, email, cdl_number, cdl_state, cdl_expiration, medical_card_expiration, pay_type, pay_rate, status"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    drivers: data ?? [],
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

  if (!body.first_name?.trim() || !body.last_name?.trim()) {
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

  const { data, error } = await supabase
    .from("drivers")
    .insert({
      company_id: profile.company_id,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      phone: body.phone ?? null,
      email: body.email ?? null,
      cdl_number: body.cdl_number ?? null,
      cdl_state: body.cdl_state ?? null,
      cdl_expiration: body.cdl_expiration ?? null,
      medical_card_expiration:
        body.medical_card_expiration ?? null,
      pay_type: body.pay_type,
      pay_rate: body.pay_rate ?? 0,
      status: body.status,
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
    { driver: data },
    { status: 201 }
  );
}