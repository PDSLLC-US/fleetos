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

  const [
    loadsResult,
    driversResult,
    trucksResult,
    brokersResult,
  ] = await Promise.all([
    supabase
      .from("loads")
      .select(`
        id,
        load_number,
        pickup_city,
        pickup_state,
        delivery_city,
        delivery_state,
        pickup_date,
        delivery_date,
        linehaul,
        detention,
        layover,
        lumper,
        other_charges,
        status,
        drivers (
          first_name,
          last_name
        ),
        trucks (
          truck_number
        ),
        brokers (
          company_name
        )
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("status", "active")
      .order("first_name"),

    supabase
      .from("trucks")
      .select("id, truck_number")
      .in("status", ["active", "available"])
      .order("truck_number"),

    supabase
      .from("brokers")
      .select("id, company_name")
      .order("company_name"),
  ]);

  const errors = [
    loadsResult.error,
    driversResult.error,
    trucksResult.error,
    brokersResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    console.error("Loads API errors:", errors);

    return NextResponse.json(
      { error: "Failed to load load data" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    loads: loadsResult.data ?? [],
    drivers: driversResult.data ?? [],
    trucks: trucksResult.data ?? [],
    brokers: brokersResult.data ?? [],
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

  if (!body.load_number?.trim()) {
    return NextResponse.json(
      { error: "Load number is required" },
      { status: 400 }
    );
  }

  const allowedStatuses = [
    "booked",
    "dispatched",
    "picked_up",
    "in_transit",
    "delivered",
    "pod_received",
    "invoiced",
    "paid",
    "cancelled",
  ];

  if (!allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: "Invalid load status" },
      { status: 400 }
    );
  }

  let finalBrokerId = body.broker_id ?? null;

  if (!finalBrokerId && body.new_broker_name?.trim()) {
    const { data: newBroker, error: brokerError } = await supabase
      .from("brokers")
      .insert({
        company_id: profile.company_id,
        company_name: body.new_broker_name.trim(),
      })
      .select("id")
      .single();

    if (brokerError) {
      return NextResponse.json(
        { error: brokerError.message },
        { status: 500 }
      );
    }

    finalBrokerId = newBroker.id;
  }

  const { data, error } = await supabase
    .from("loads")
    .insert({
      company_id: profile.company_id,
      load_number: body.load_number.trim(),
      broker_id: finalBrokerId,
      driver_id: body.driver_id ?? null,
      truck_id: body.truck_id ?? null,
      equipment_type: body.equipment_type ?? null,

      pickup_city: body.pickup_city ?? null,
      pickup_state: body.pickup_state ?? null,
      pickup_date: body.pickup_date ?? null,

      delivery_city: body.delivery_city ?? null,
      delivery_state: body.delivery_state ?? null,
      delivery_date: body.delivery_date ?? null,

      miles: body.miles ?? 0,
      linehaul: body.linehaul ?? 0,
      detention: body.detention ?? 0,
      layover: body.layover ?? 0,
      lumper: body.lumper ?? 0,
      other_charges: body.other_charges ?? 0,

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
    { load: data },
    { status: 201 }
  );
}