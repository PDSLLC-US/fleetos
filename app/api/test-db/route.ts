import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FOREIGN_COMPANY_ID =
  "72f9fcf5-19ed-4607-9a13-f1297c07fa87";

type AuditResult = {
  table: string;
  foreignRowsVisible: number;
  error: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
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
      return NextResponse.json(
        {
          success: false,
          error: membershipError.message,
        },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error: "Active company membership not found.",
        },
        { status: 403 }
      );
    }

    if (membership.company_id === FOREIGN_COMPANY_ID) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You are logged into the foreign company being tested. Log into the isolation-test company instead.",
        },
        { status: 400 }
      );
    }

    const tenantTables = [
      "brokers",
      "company_members",
      "driver_settlements",
      "drivers",
      "expenses",
      "invoices",
      "load_documents",
      "loads",
      "maintenance_records",
      "payments",
      "profiles",
      "trailers",
      "trucks",
    ];

    const results: AuditResult[] = [];

    for (const table of tenantTables) {
      const {
        data,
        error,
      } = await supabase
        .from(table)
        .select("id, company_id")
        .eq("company_id", FOREIGN_COMPANY_ID);

      results.push({
        table,
        foreignRowsVisible: data?.length ?? 0,
        error: error?.message ?? null,
      });
    }

    const leaks = results.filter(
      (result) => result.foreignRowsVisible > 0
    );

    return NextResponse.json({
      success: leaks.length === 0,
      authenticatedUserId: user.id,
      currentCompanyId: membership.company_id,
      currentRole: membership.role,
      testedForeignCompanyId: FOREIGN_COMPANY_ID,
      leaksDetected: leaks.length,
      results,
    });
  } catch (error) {
    console.error("Tenant audit error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Tenant audit failed.",
      },
      { status: 500 }
    );
  }
}