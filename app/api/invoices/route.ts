import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CompanyRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "accountant"
  | "fleet_manager"
  | "driver";

const CREATE_INVOICE_ROLES: CompanyRole[] = [
  "owner",
  "admin",
  "dispatcher",
  "accountant",
];

const ALLOWED_STATUSES = [
  "draft",
  "invoiced",
  "due",
  "overdue",
  "partially_paid",
  "paid",
  "cancelled",
];

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanOptional(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // ============================================================
    // AUTH
    // ============================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ============================================================
    // COMPANY MEMBERSHIP / ROLE
    // ============================================================

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select("company_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "Invoice membership lookup error:",
        membershipError
      );

      return NextResponse.json(
        { error: "Unable to verify company membership." },
        { status: 500 }
      );
    }

    if (!membership?.company_id) {
      return NextResponse.json(
        { error: "Active company membership required." },
        { status: 403 }
      );
    }

    const role = membership.role as CompanyRole;

    if (!CREATE_INVOICE_ROLES.includes(role)) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create invoices.",
        },
        { status: 403 }
      );
    }

    const companyId = membership.company_id;

    // ============================================================
    // REQUEST
    // ============================================================

    const body = await request.json();

    const invoiceNumber = String(
      body.invoice_number ?? ""
    ).trim();

    const loadId = String(
      body.load_id ?? ""
    ).trim();

    const invoiceDate = String(
      body.invoice_date ?? ""
    ).trim();

    const dueDate =
      cleanOptional(body.due_date);

    const requestedStatus = String(
      body.status ?? "invoiced"
    ).trim();

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required." },
        { status: 400 }
      );
    }

    if (!loadId) {
      return NextResponse.json(
        { error: "Load is required." },
        { status: 400 }
      );
    }

    if (!invoiceDate) {
      return NextResponse.json(
        { error: "Invoice date is required." },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_STATUSES.includes(
        requestedStatus
      )
    ) {
      return NextResponse.json(
        { error: "Invalid invoice status." },
        { status: 400 }
      );
    }

    // ============================================================
    // LOAD
    // ============================================================

    const {
      data: load,
      error: loadError,
    } = await supabase
      .from("loads")
      .select(`
        id,
        company_id,
        load_number,
        broker_id,
        broker_name,
        driver_id,
        truck_id,
        trailer_id,
        equipment_type,
        pickup_location,
        pickup_city,
        pickup_state,
        pickup_date,
        delivery_location,
        delivery_city,
        delivery_state,
        delivery_date,
        miles,
        linehaul,
        detention,
        layover,
        lumper,
        tolls,
        other_charges,
        status,
        notes
      `)
      .eq("id", loadId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (loadError) {
      console.error(
        "Invoice load lookup error:",
        loadError
      );

      return NextResponse.json(
        { error: "Unable to load billing-ready load." },
        { status: 500 }
      );
    }

    if (!load) {
      return NextResponse.json(
        { error: "Load not found." },
        { status: 404 }
      );
    }

    if (load.status !== "pod_received") {
      return NextResponse.json(
        {
          error:
            "New invoices can only be created for loads with POD Received status.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // PREVENT DUPLICATE ACTIVE INVOICE
    // ============================================================

    const {
      data: existingInvoice,
      error: existingInvoiceError,
    } = await supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("company_id", companyId)
      .eq("load_id", loadId)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle();

    if (existingInvoiceError) {
      console.error(
        "Existing invoice lookup error:",
        existingInvoiceError
      );

      return NextResponse.json(
        { error: "Unable to verify existing invoices." },
        { status: 500 }
      );
    }

    if (existingInvoice) {
      return NextResponse.json(
        {
          error:
            `Load ${load.load_number} already has active invoice ${existingInvoice.invoice_number}.`,
        },
        { status: 409 }
      );
    }

    // ============================================================
    // COMPANY BILLING IDENTITY
    // ============================================================

    const {
      data: company,
      error: companyError,
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
        website,
        address,
        city,
        state,
        zip_code,
        country,
        invoice_name,
        invoice_email,
        payment_terms,
        invoice_notes
      `)
      .eq("id", companyId)
      .maybeSingle();

    if (companyError || !company) {
      console.error(
        "Invoice company lookup error:",
        companyError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load company billing information.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // BROKER
    //
    // Loads created after the free-text broker update may have
    // broker_name without broker_id. Both cases are supported.
    // ============================================================

    let broker:
      | {
          id: string;
          company_name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          mc_number: string | null;
          dot_number: string | null;
          payment_terms_days: number | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          notes: string | null;
        }
      | null = null;

    const requestedBrokerId =
      cleanOptional(body.broker_id);

    const brokerId =
      requestedBrokerId ||
      load.broker_id ||
      null;

    if (brokerId) {
      const {
        data: brokerData,
        error: brokerError,
      } = await supabase
        .from("brokers")
        .select(`
          id,
          company_name,
          contact_name,
          phone,
          email,
          mc_number,
          dot_number,
          payment_terms_days,
          address,
          city,
          state,
          zip_code,
          notes
        `)
        .eq("id", brokerId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (brokerError) {
        console.error(
          "Invoice broker lookup error:",
          brokerError
        );
      } else {
        broker = brokerData;
      }
    }

    // ============================================================
    // AMOUNT
    //
    // Server calculates the billing total from the load so invoice
    // creation cannot accidentally omit an accessorial.
    // ============================================================

    const charges = {
      linehaul: numberValue(load.linehaul),
      detention: numberValue(load.detention),
      layover: numberValue(load.layover),
      lumper: numberValue(load.lumper),
      tolls: numberValue(load.tolls),
      other_charges:
        numberValue(load.other_charges),
    };

    const calculatedAmount =
      charges.linehaul +
      charges.detention +
      charges.layover +
      charges.lumper +
      charges.tolls +
      charges.other_charges;

    const requestedAmount =
      numberValue(body.amount);

    const invoiceAmount =
      requestedAmount > 0
        ? requestedAmount
        : calculatedAmount;

    if (invoiceAmount <= 0) {
      return NextResponse.json(
        {
          error:
            "Invoice amount must be greater than 0.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // IMMUTABLE INVOICE SNAPSHOT
    // ============================================================

    const invoiceSnapshot = {
      version: 1,

      generated_at:
        new Date().toISOString(),

      carrier: {
        name:
          company.invoice_name ||
          company.name,

        company_name:
          company.name,

        legal_name:
          company.legal_name,

        mc_number:
          company.mc_number,

        dot_number:
          company.dot_number,

        phone:
          company.phone,

        email:
          company.invoice_email ||
          company.email,

        website:
          company.website,

        address:
          company.address,

        city:
          company.city,

        state:
          company.state,

        zip_code:
          company.zip_code,

        country:
          company.country,

        payment_terms:
          company.payment_terms,

        invoice_notes:
          company.invoice_notes,
      },

      broker: {
        id:
          broker?.id ??
          null,

        company_name:
          broker?.company_name ||
          load.broker_name ||
          null,

        contact_name:
          broker?.contact_name ??
          null,

        phone:
          broker?.phone ??
          null,

        email:
          broker?.email ??
          null,

        mc_number:
          broker?.mc_number ??
          null,

        dot_number:
          broker?.dot_number ??
          null,

        payment_terms_days:
          broker?.payment_terms_days ??
          null,

        address:
          broker?.address ??
          null,

        city:
          broker?.city ??
          null,

        state:
          broker?.state ??
          null,

        zip_code:
          broker?.zip_code ??
          null,
      },

      load: {
        id:
          load.id,

        load_number:
          load.load_number,

        equipment_type:
          load.equipment_type,

        miles:
          numberValue(
            load.miles
          ),

        pickup_location:
          load.pickup_location,

        pickup_city:
          load.pickup_city,

        pickup_state:
          load.pickup_state,

        pickup_date:
          load.pickup_date,

        delivery_location:
          load.delivery_location,

        delivery_city:
          load.delivery_city,

        delivery_state:
          load.delivery_state,

        delivery_date:
          load.delivery_date,
      },

      charges,

      totals: {
        calculated_amount:
          calculatedAmount,

        invoice_amount:
          invoiceAmount,
      },
    };

    // ============================================================
    // CREATE INVOICE
    // ============================================================

    const {
      data: invoice,
      error: invoiceError,
    } = await supabase
      .from("invoices")
      .insert({
        company_id:
          companyId,

        load_id:
          load.id,

        broker_id:
          broker?.id ??
          load.broker_id ??
          null,

        invoice_number:
          invoiceNumber,

        invoice_date:
          invoiceDate,

        due_date:
          dueDate,

        amount:
          invoiceAmount,

        paid_amount:
          0,

        status:
          requestedStatus,

        notes:
          cleanOptional(body.notes),

        invoice_snapshot:
          invoiceSnapshot,
      })
      .select("*")
      .single();

    if (invoiceError) {
      console.error(
        "Invoice creation error:",
        invoiceError
      );

      return NextResponse.json(
        {
          error:
            invoiceError.message ||
            "Unable to create invoice.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // MOVE LOAD INTO INVOICED WORKFLOW
    // ============================================================

    const {
      error: loadUpdateError,
    } = await supabase
      .from("loads")
      .update({
        status: "invoiced",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", load.id)
      .eq("company_id", companyId);

    if (loadUpdateError) {
      console.error(
        "Invoice load status update error:",
        loadUpdateError
      );
    }

    return NextResponse.json(
      {
        invoice,
        snapshot:
          invoiceSnapshot,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "FleetOS invoice creation exception:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create invoice.",
      },
      { status: 500 }
    );
  }
}
