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
  company_id: string;
  role: CompanyRole;
  is_active: boolean;
};

type PlatformAdmin = {
  user_id: string;
  is_active: boolean;
};

type SubscriptionAccess = {
  status: string;
  trial_ends_at: string | null;
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
    pathname.startsWith(
      `${allowedPath}/`
    )
  );
}

function isDriverPortalPath(
  pathname: string
) {
  return (
    pathname === "/driver" ||
    pathname.startsWith(
      "/driver/"
    )
  );
}

function isPlatformPath(
  pathname: string
) {
  return (
    pathname === "/platform" ||
    pathname.startsWith(
      "/platform/"
    )
  );
}

function isPlatformApiPath(
  pathname: string
) {
  return pathname.startsWith(
    "/api/platform/"
  );
}

function isApiPath(
  pathname: string
) {
  return pathname.startsWith(
    "/api/"
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
  pathname: string,
  status?: string
) {
  const url =
    request.nextUrl.clone();

  url.pathname =
    pathname;

  url.search =
    "";

  if (status) {
    url.searchParams.set(
      "status",
      status
    );
  }

  const redirect =
    NextResponse.redirect(
      url
    );

  response.cookies
    .getAll()
    .forEach(
      (cookie) => {
        redirect.cookies.set(
          cookie.name,
          cookie.value,
          cookie
        );
      }
    );

  return redirect;
}

function blockedApiResponse(
  status: string
) {
  return NextResponse.json(
    {
      error:
        "FleetOS subscription access is currently unavailable for this company.",

      subscriptionStatus:
        status,
    },
    {
      status: 403,
    }
  );
}

function getAccessDecision(
  subscription:
    | SubscriptionAccess
    | null
    | undefined
) {
  const status =
    subscription?.status ??
    "unassigned";

  if (
    status === "active" ||
    status === "past_due" ||
    status === "unassigned"
  ) {
    return {
      allowed: true,
      reason: status,
    };
  }

  if (
    status === "trial"
  ) {
    const trialEndsAt =
      subscription?.trial_ends_at;

    /*
     * During development, a trial with no end date remains valid.
     */
    if (!trialEndsAt) {
      return {
        allowed: true,
        reason: "trial",
      };
    }

    const trialEnd =
      new Date(
        trialEndsAt
      );

    if (
      Number.isNaN(
        trialEnd.getTime()
      )
    ) {
      return {
        allowed: true,
        reason: "trial",
      };
    }

    if (
      trialEnd.getTime() >=
      Date.now()
    ) {
      return {
        allowed: true,
        reason: "trial",
      };
    }

    return {
      allowed: false,
      reason:
        "trial_expired",
    };
  }

  if (
    status === "suspended" ||
    status === "cancelled"
  ) {
    return {
      allowed: false,
      reason: status,
    };
  }

  /*
   * Unknown statuses are allowed temporarily so a typo or future
   * status does not accidentally lock every user out.
   */
  return {
    allowed: true,
    reason: status,
  };
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

  const pathname =
    request.nextUrl.pathname;

  // ============================================================
  // AUTH CALLBACK ROUTES
  // ============================================================

  if (
    pathname.startsWith(
      "/auth/"
    )
  ) {
    return response;
  }

  // ============================================================
  // AUTHENTICATED USER
  // ============================================================

  const {
    data: {
      user,
    },

    error:
      userError,
  } =
    await supabase.auth.getUser();

  if (
    userError &&
    userError.name !==
      "AuthSessionMissingError"
  ) {
    console.error(
      "Proxy auth error:",
      userError.message
    );
  }

  // ============================================================
  // PUBLIC ROUTES
  // ============================================================

  const isPublicRoute =
    pathname ===
      "/login" ||
    pathname ===
      "/signup" ||
    pathname ===
      "/accept-invite" ||
    pathname ===
      "/subscription-required";

  // ============================================================
  // NOT LOGGED IN
  // ============================================================

  if (!user) {
    /*
     * APIs keep their own authentication response format.
     */
    if (
      isApiPath(
        pathname
      )
    ) {
      return response;
    }

    if (
      !isPublicRoute
    ) {
      return createRedirect(
        request,
        response,
        "/login"
      );
    }

    return response;
  }

  // ============================================================
  // PLATINUM PLATFORM ADMIN
  // ============================================================

  const {
    data:
      platformAdminData,

    error:
      platformAdminError,
  } =
    await supabase
      .from(
        "platform_admins"
      )
      .select(`
        user_id,
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

  if (
    platformAdminError
  ) {
    console.error(
      "Proxy platform admin error:",
      platformAdminError.message
    );
  }

  const platformAdmin =
    platformAdminData as
      | PlatformAdmin
      | null;

  const isPlatformAdmin =
    Boolean(
      platformAdmin?.is_active
    );

  // ============================================================
  // PLATFORM ADMIN ROUTING
  // ============================================================

  if (
    isPlatformAdmin
  ) {
    if (
      isPlatformPath(
        pathname
      ) ||
      isPlatformApiPath(
        pathname
      )
    ) {
      return response;
    }

    if (
      pathname ===
        "/login" ||
      pathname ===
        "/signup"
    ) {
      return createRedirect(
        request,
        response,
        "/platform"
      );
    }

    if (
      pathname ===
      "/accept-invite"
    ) {
      return response;
    }
  }

  // ============================================================
  // ACTIVE COMPANY MEMBERSHIP
  // ============================================================

  const {
    data:
      membershipData,

    error:
      membershipError,
  } =
    await supabase
      .from(
        "company_members"
      )
      .select(`
        company_id,
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

  if (
    membershipError
  ) {
    console.error(
      "Proxy membership error:",
      membershipError.message
    );
  }

  const activeMembership =
    membershipData as
      | Membership
      | null;

  // ============================================================
  // PLATFORM ADMIN WITHOUT COMPANY MEMBERSHIP
  // ============================================================

  if (
    isPlatformAdmin &&
    !activeMembership
  ) {
    /*
     * Platform-only admins may use only platform APIs/routes,
     * login/signup redirection, and invitation flow.
     */
    if (
      isApiPath(
        pathname
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Company workspace access requires an active company membership.",
        },
        {
          status: 403,
        }
      );
    }

    return createRedirect(
      request,
      response,
      "/platform"
    );
  }

  // ============================================================
  // AUTHENTICATED CUSTOMER WITHOUT COMPANY MEMBERSHIP
  // ============================================================

  if (
    !activeMembership
  ) {
    if (
      isApiPath(
        pathname
      )
    ) {
      return response;
    }

    if (
      pathname ===
        "/signup" ||
      pathname ===
        "/login" ||
      pathname ===
        "/accept-invite"
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
  // BLOCK CLIENT USERS FROM PLATINUM PLATFORM
  // ============================================================

  if (
    isPlatformPath(
      pathname
    )
  ) {
    if (
      isPlatformAdmin
    ) {
      return response;
    }

    if (
      role ===
      "driver"
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

  if (
    isPlatformApiPath(
      pathname
    ) &&
    !isPlatformAdmin
  ) {
    return NextResponse.json(
      {
        error:
          "Platinum Platform Administrator access required.",
      },
      {
        status: 403,
      }
    );
  }

  // ============================================================
  // SUBSCRIPTION ACCESS CHECK
  //
  // Uses SECURITY DEFINER RPC so every company role can be
  // checked without exposing plan price or billing details.
  // ============================================================

  const {
    data:
      subscriptionAccessData,

    error:
      subscriptionAccessError,
  } =
    await supabase.rpc(
      "current_company_subscription_access"
    );

  if (
    subscriptionAccessError
  ) {
    console.error(
      "Proxy subscription access error:",
      subscriptionAccessError.message
    );
  }

  const subscriptionAccess =
    (
      subscriptionAccessData ??
      null
    ) as
      | SubscriptionAccess
      | null;

  const accessDecision =
    subscriptionAccessError
      ? {
          /*
           * Fail open during development if the helper has a
           * temporary DB error. We can change this to fail closed
           * before production launch.
           */
          allowed: true,
          reason:
            "subscription_check_error",
        }
      : getAccessDecision(
          subscriptionAccess
        );

  const isSubscriptionPage =
    pathname ===
    "/subscription-required";

  if (
    !accessDecision.allowed
  ) {
    if (
      isApiPath(
        pathname
      )
    ) {
      return blockedApiResponse(
        accessDecision.reason
      );
    }

    if (
      !isSubscriptionPage
    ) {
      return createRedirect(
        request,
        response,
        "/subscription-required",
        accessDecision.reason
      );
    }

    return response;
  }

  /*
   * If access has been restored while the user is still sitting on
   * the blocked-account page, send them back into FleetOS.
   */
  if (
    isSubscriptionPage
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
  // ACCEPT INVITATION
  // ============================================================

  if (
    pathname ===
    "/accept-invite"
  ) {
    return response;
  }

  // ============================================================
  // SIGNUP REDIRECTION
  // ============================================================

  if (
    pathname ===
    "/signup"
  ) {
    if (
      isPlatformAdmin
    ) {
      return createRedirect(
        request,
        response,
        "/platform"
      );
    }

    if (
      role ===
      "driver"
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
    pathname ===
    "/login"
  ) {
    if (
      isPlatformAdmin
    ) {
      return createRedirect(
        request,
        response,
        "/platform"
      );
    }

    if (
      role ===
      "driver"
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
  // COMPANY APIs
  //
  // Subscription access has already been checked above.
  // Individual APIs still enforce their own role/RLS permissions.
  // ============================================================

  if (
    isApiPath(
      pathname
    )
  ) {
    return response;
  }

  // ============================================================
  // DRIVER USERS
  // ============================================================

  if (
    role ===
    "driver"
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
    role ===
      "owner" ||
    role ===
      "admin"
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

  if (
    !allowed
  ) {
    return createRedirect(
      request,
      response,
      "/"
    );
  }

  return response;
}
