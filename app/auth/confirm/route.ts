import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/signup";

  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/signup";

  if (!code) {
    const errorUrl = request.nextUrl.clone();

    errorUrl.pathname = "/signup";
    errorUrl.search = "";
    errorUrl.searchParams.set(
      "verification_error",
      "missing_code"
    );

    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "FleetOS owner email confirmation error:",
      error
    );

    const errorUrl = request.nextUrl.clone();

    errorUrl.pathname = "/signup";
    errorUrl.search = "";
    errorUrl.searchParams.set(
      "verification_error",
      "invalid_or_expired"
    );

    return NextResponse.redirect(errorUrl);
  }

  const successUrl = request.nextUrl.clone();

  successUrl.pathname = safeNext;
  successUrl.search = "";
  successUrl.searchParams.set("verified", "1");

  return NextResponse.redirect(successUrl);
}
