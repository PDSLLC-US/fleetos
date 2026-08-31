import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

type CompanyRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "accountant"
  | "fleet_manager"
  | "driver";

type Membership = {
  role: CompanyRole;
  is_active: boolean;
};

const ROLE_ROUTES: Record<
  Exclude<
    CompanyRole,
    "owner" | "admin" | "driver"
  >,
  string[]
> = {
  dispatcher: [
    "/",
    "/loads",
    "/drivers",
    "/invoices",
    "/documents",
  ],

  fleet_manager: [
    "/",
    "/loads",
    "/trucks",
    "/trailers",
    "/maintenance",
    "/drivers",
    "/documents",
  ],

  accountant: [
    "/",
    "/payroll",
    "/expenses",
    "/invoices",
    "/documents",
  ],
};

function pathMatches(
  pathname: string,
  allowedPath: string
) {
  if (allowedPath === "/") {
    return pathname === "/";
  }

  return (
    pathname === allowedPath ||
    pathname.startsWith(`${allowedPath}/`)
  );
}

/**
 * IMPORTANT:
 *
 * "/drivers" must NOT be treated as part of "/driver".
 *
 * Driver portal routes are:
 *   /driver
 *   /driver/...
 *
 * Management route:
 *   /drivers
 */
function isDriverPortalPath(
  pathname: string
) {
  return (
    pathname === "/driver" ||
    pathname.startsWith("/driver/")
  );
}

function isManagementRouteAllowed(
  pathname: string,
  role: CompanyRole
) {
  if (
    role === "owner" ||
    role === "admin"
  ) {
    return !isDriverPortalPath(
      pathname
    );
  }

  if (role === "driver") {
    return isDriverPortalPath(
      pathname
    );
  }

  const allowedRoutes =
    ROLE_ROUTES[role];

  return allowedRoutes.some(
    (allowedPath) =>
      pathMatches(
        pathname,
        allowedPath
      )
  );
}

function createRedirect(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url =
    request.nextUrl.clone();

  url.pathname = pathname;
  url.search = "";

  const redirect =
    NextResponse.redirect(url);

  response.cookies
    .getAll()
    .forEach((cookie) => {
      redirect.cookies.set(
        cookie.name,
        cookie.value,
        cookie
      );
    });

  return redirect;
}

export async function updateSession(
  request: NextRequest
) {
  let response =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            response =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    console.error(
      "Proxy auth error:",
      userError.message
    );
  }

  const pathname =
    request.nextUrl.pathname;

  // ============================================================
  // API + AUTH CALLBACK ROUTES
  // ============================================================

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/")
  ) {
    return response;
  }

  // ============================================================
  // PUBLIC ROUTES
  // ============================================================

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/accept-invite";

  // ============================================================
  // NOT LOGGED IN
  // ============================================================

  if (
    !user &&
    !isPublicRoute
  ) {
    return createRedirect(
      request,
      response,
      "/login"
    );
  }

  if (!user) {
    return response;
  }

  // ============================================================
  // ACTIVE COMPANY MEMBERSHIP
  // ============================================================

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("company_members")
    .select(`
      role,
      is_active
    `)
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (membershipError) {
    console.error(
      "Proxy membership error:",
      membershipError.message
    );
  }

  const activeMembership =
    membership as Membership | null;

  // ============================================================
  // AUTHENTICATED USER WITHOUT MEMBERSHIP
  // ============================================================

  if (!activeMembership) {
    if (
      pathname === "/signup" ||
      pathname === "/login" ||
      pathname === "/accept-invite"
    ) {
      return response;
    }

    return createRedirect(
      request,
      response,
      "/signup"
    );
  }

  const role =
    activeMembership.role;

  // ============================================================
  // ACCEPT INVITATION
  // ============================================================

  if (
    pathname === "/accept-invite"
  ) {
    return response;
  }

  // ============================================================
  // SIGNUP REDIRECTION
  // ============================================================

  if (
    pathname === "/signup"
  ) {
    if (
      role === "driver"
    ) {
      return createRedirect(
        request,
        response,
        "/driver"
      );
    }

    return createRedirect(
      request,
      response,
      "/"
    );
  }

  // ============================================================
  // LOGIN REDIRECTION
  // ============================================================

  if (
    pathname === "/login"
  ) {
    if (
      role === "driver"
    ) {
      return createRedirect(
        request,
        response,
        "/driver"
      );
    }

    return createRedirect(
      request,
      response,
      "/"
    );
  }

  // ============================================================
  // DRIVER USERS
  // ============================================================

  if (
    role === "driver"
  ) {
    if (
      !isDriverPortalPath(
        pathname
      )
    ) {
      return createRedirect(
        request,
        response,
        "/driver"
      );
    }

    return response;
  }

  // ============================================================
  // MANAGEMENT USERS CANNOT ACCESS DRIVER PORTAL
  // ============================================================

  if (
    isDriverPortalPath(
      pathname
    )
  ) {
    return createRedirect(
      request,
      response,
      "/"
    );
  }

  // ============================================================
  // OWNER / ADMIN
  // ============================================================

  if (
    role === "owner" ||
    role === "admin"
  ) {
    return response;
  }

  // ============================================================
  // STAFF ROUTE GUARD
  // ============================================================

  const allowed =
    isManagementRouteAllowed(
      pathname,
      role
    );

  if (!allowed) {
    return createRedirect(
      request,
      response,
      "/"
    );
  }

  return response;
}