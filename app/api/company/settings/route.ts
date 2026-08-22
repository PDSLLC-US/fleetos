import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EDIT_ROLES = ["owner", "admin"];

export async function GET() {
  try {
    const supabase = await createClient();

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
        "Company settings membership error:",
        membershipError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify company membership.",
        },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Active company membership not found.",
        },
        { status: 403 }
      );
    }

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
        address,
        city,
        state,
        zip_code,
        website,
        country,
        invoice_name,
        invoice_email,
        payment_terms,
        invoice_notes,
        created_at,
        updated_at
      `)
      .eq(
        "id",
        membership.company_id
      )
      .maybeSingle();

    if (companyError) {
      console.error(
        "Company settings GET error:",
        companyError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load company settings.",
        },
        { status: 500 }
      );
    }

    if (!company) {
      return NextResponse.json(
        {
          error:
            "Company record was not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      company,
      role: membership.role,
      canEdit:
        EDIT_ROLES.includes(
          membership.role
        ),
    });
  } catch (error) {
    console.error(
      "Company settings GET exception:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load company settings.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const supabase = await createClient();

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
        "Company settings membership error:",
        membershipError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify company membership.",
        },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Active company membership not found.",
        },
        { status: 403 }
      );
    }

    if (
      !EDIT_ROLES.includes(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only the company Owner or Administrator can update company settings.",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const name =
      cleanRequired(
        body.name
      );

    const paymentTerms =
      Number(
        body.payment_terms ??
          30
      );

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Company name is required.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(
        paymentTerms
      ) ||
      paymentTerms < 0 ||
      paymentTerms > 365
    ) {
      return NextResponse.json(
        {
          error:
            "Payment terms must be a whole number between 0 and 365 days.",
        },
        { status: 400 }
      );
    }

    const updates = {
      name,

      legal_name:
        cleanOptional(
          body.legal_name
        ),

      mc_number:
        cleanOptional(
          body.mc_number
        ),

      dot_number:
        cleanOptional(
          body.dot_number
        ),

      phone:
        cleanOptional(
          body.phone
        ),

      email:
        cleanOptional(
          body.email
        ),

      website:
        cleanOptional(
          body.website
        ),

      address:
        cleanOptional(
          body.address
        ),

      city:
        cleanOptional(
          body.city
        ),

      state:
        cleanOptional(
          body.state
        ),

      zip_code:
        cleanOptional(
          body.zip_code
        ),

      country:
        cleanOptional(
          body.country
        ) || "USA",

      invoice_name:
        cleanOptional(
          body.invoice_name
        ),

      invoice_email:
        cleanOptional(
          body.invoice_email
        ),

      payment_terms:
        paymentTerms,

      invoice_notes:
        cleanOptional(
          body.invoice_notes
        ),

      updated_at:
        new Date().toISOString(),
    };

    const {
      data: company,
      error: updateError,
    } = await supabase
      .from("companies")
      .update(updates)
      .eq(
        "id",
        membership.company_id
      )
      .select(`
        id,
        name,
        legal_name,
        mc_number,
        dot_number,
        phone,
        email,
        address,
        city,
        state,
        zip_code,
        website,
        country,
        invoice_name,
        invoice_email,
        payment_terms,
        invoice_notes,
        created_at,
        updated_at
      `)
      .maybeSingle();

    if (updateError) {
      console.error(
        "Company settings PATCH error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message ||
            "Unable to save company settings.",
        },
        { status: 500 }
      );
    }

    if (!company) {
      return NextResponse.json(
        {
          error:
            "Company settings were not updated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error(
      "Company settings PATCH exception:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to save company settings.",
      },
      { status: 500 }
    );
  }
}

function cleanOptional(
  value: unknown
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned.length > 0
    ? cleaned
    : null;
}

function cleanRequired(
  value: unknown
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}