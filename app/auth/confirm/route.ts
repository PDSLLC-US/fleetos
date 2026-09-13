import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  type EmailOtpType,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";

export async function GET(
  request: NextRequest
) {
  const requestUrl =
    new URL(
      request.url
    );

  const tokenHash =
    requestUrl.searchParams.get(
      "token_hash"
    );

  const type =
    requestUrl.searchParams.get(
      "type"
    ) as
      | EmailOtpType
      | null;

  /*
   * Keep backward compatibility with the older
   * PKCE/code callback while we transition the
   * email template to token_hash verification.
   */
  const code =
    requestUrl.searchParams.get(
      "code"
    );

  const next =
    requestUrl.searchParams.get(
      "next"
    ) ||
    "/signup";

  const safeNext =
    next.startsWith("/") &&
    !next.startsWith("//")
      ? next
      : "/signup";

  const supabase =
    await createClient();

  // ========================================================
  // 1. PREFERRED FLOW:
  //    token_hash + type
  // ========================================================

  if (
    tokenHash &&
    type
  ) {
    const {
      error:
        verifyError,
    } =
      await supabase.auth.verifyOtp({
        token_hash:
          tokenHash,

        type,
      });

    if (
      verifyError
    ) {
      console.error(
        "FleetOS owner email confirmation OTP error:",
        verifyError
      );

      const errorUrl =
        request.nextUrl.clone();

      errorUrl.pathname =
        "/signup";

      errorUrl.search =
        "";

      errorUrl.searchParams.set(
        "verification_error",
        "invalid_or_expired"
      );

      return NextResponse.redirect(
        errorUrl
      );
    }

    const successUrl =
      request.nextUrl.clone();

    successUrl.pathname =
      safeNext;

    successUrl.search =
      "";

    successUrl.searchParams.set(
      "verified",
      "1"
    );

    return NextResponse.redirect(
      successUrl
    );
  }

  // ========================================================
  // 2. BACKWARD-COMPATIBLE FLOW:
  //    PKCE code exchange
  // ========================================================

  if (code) {
    const {
      error:
        exchangeError,
    } =
      await supabase.auth
        .exchangeCodeForSession(
          code
        );

    if (
      exchangeError
    ) {
      console.error(
        "FleetOS owner email confirmation code error:",
        exchangeError
      );

      const errorUrl =
        request.nextUrl.clone();

      errorUrl.pathname =
        "/signup";

      errorUrl.search =
        "";

      errorUrl.searchParams.set(
        "verification_error",
        "invalid_or_expired"
      );

      return NextResponse.redirect(
        errorUrl
      );
    }

    const successUrl =
      request.nextUrl.clone();

    successUrl.pathname =
      safeNext;

    successUrl.search =
      "";

    successUrl.searchParams.set(
      "verified",
      "1"
    );

    return NextResponse.redirect(
      successUrl
    );
  }

  // ========================================================
  // 3. NO VALID CONFIRMATION PARAMETERS
  // ========================================================

  console.error(
    "FleetOS owner email confirmation missing token_hash/code."
  );

  const errorUrl =
    request.nextUrl.clone();

  errorUrl.pathname =
    "/signup";

  errorUrl.search =
    "";

  errorUrl.searchParams.set(
    "verification_error",
    "missing_confirmation_token"
  );

  return NextResponse.redirect(
    errorUrl
  );
}