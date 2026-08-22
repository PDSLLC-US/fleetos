import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";

type AllowedStaffRole =
  | "admin"
  | "dispatcher"
  | "fleet_manager"
  | "accountant";

const ALLOWED_ROLES: AllowedStaffRole[] = [
  "admin",
  "dispatcher",
  "fleet_manager",
  "accountant",
];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getOwnerAdminContext() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !user
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from("company_members")
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

  if (membershipError) {
    console.error(
      "Staff management membership error:",
      membershipError
    );

    return {
      error: NextResponse.json(
        {
          error:
            "Unable to verify company membership.",
        },
        {
          status: 500,
        }
      ),
    };
  }

  if (
    !membership ||
    ![
      "owner",
      "admin",
    ].includes(
      membership.role
    )
  ) {
    return {
      error: NextResponse.json(
        {
          error:
            "Owner or Admin access is required.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    supabase,
    user,
    membership,
  };
}

async function getTargetMembership(
  supabase: Awaited<
    ReturnType<
      typeof createClient
    >
  >,
  companyId: string,
  targetUserId: string
) {
  return await supabase
    .from("company_members")
    .select(`
      company_id,
      user_id,
      role,
      driver_id,
      is_active
    `)
    .eq(
      "company_id",
      companyId
    )
    .eq(
      "user_id",
      targetUserId
    )
    .maybeSingle();
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth =
      await getOwnerAdminContext();

    if (
      "error" in auth
    ) {
      return auth.error;
    }

    const {
      supabase,
      user,
      membership,
    } = auth;

    const {
      id: targetUserId,
    } = await context.params;

    if (!targetUserId) {
      return NextResponse.json(
        {
          error:
            "Staff user ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      targetUserId ===
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot change your own role or access status.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: target,
      error: targetError,
    } =
      await getTargetMembership(
        supabase,
        membership.company_id,
        targetUserId
      );

    if (targetError) {
      console.error(
        "Target staff lookup error:",
        targetError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load staff member.",
        },
        {
          status: 500,
        }
      );
    }

    if (!target) {
      return NextResponse.json(
        {
          error:
            "Staff member was not found in your company.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      target.role ===
      "owner"
    ) {
      return NextResponse.json(
        {
          error:
            "The company Owner cannot be modified from Team Management.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const requestedRole =
      body.role ===
        undefined
        ? target.role
        : String(
            body.role
          );

    const requestedActive =
      typeof body.isActive ===
      "boolean"
        ? body.isActive
        : target.is_active;

    if (
      !ALLOWED_ROLES.includes(
        requestedRole as AllowedStaffRole
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid staff role.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: updated,
      error: updateError,
    } =
      await supabase.rpc(
        "manage_company_member",
        {
          target_user_id:
            targetUserId,

          target_role:
            requestedRole,

          target_driver_id:
            null,

          target_is_active:
            requestedActive,
        }
      );

    if (updateError) {
      console.error(
        "Staff membership update error:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            updateError.message ||
            "Unable to update staff member.",
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      membership: updated,
    });
  } catch (error) {
    console.error(
      "Staff PATCH API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update staff member.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const auth =
      await getOwnerAdminContext();

    if (
      "error" in auth
    ) {
      return auth.error;
    }

    const {
      supabase,
      user,
      membership,
    } = auth;

    const {
      id: targetUserId,
    } = await context.params;

    if (!targetUserId) {
      return NextResponse.json(
        {
          error:
            "Staff user ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      targetUserId ===
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot delete your own account.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: target,
      error: targetError,
    } =
      await getTargetMembership(
        supabase,
        membership.company_id,
        targetUserId
      );

    if (targetError) {
      console.error(
        "Delete target lookup error:",
        targetError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load staff member.",
        },
        {
          status: 500,
        }
      );
    }

    if (!target) {
      return NextResponse.json(
        {
          error:
            "Staff member was not found in your company.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      target.role ===
      "owner"
    ) {
      return NextResponse.json(
        {
          error:
            "The company Owner cannot be deleted.",
        },
        {
          status: 400,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "FleetOS staff service is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const admin =
      createAdminClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,
          },
        }
      );

    /*
     * Permanently remove the Auth user.
     * In a normal Supabase setup, rows that reference
     * auth.users are configured to cascade.
     *
     * We then also clean up any remaining FleetOS rows
     * defensively.
     */
    const {
      error: authDeleteError,
    } =
      await admin.auth.admin
        .deleteUser(
          targetUserId
        );

    if (authDeleteError) {
      console.error(
        "Auth user delete error:",
        authDeleteError
      );

      return NextResponse.json(
        {
          error:
            authDeleteError.message ||
            "Unable to permanently delete this user.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error:
        membershipCleanupError,
    } = await admin
      .from("company_members")
      .delete()
      .eq(
        "company_id",
        membership.company_id
      )
      .eq(
        "user_id",
        targetUserId
      );

    if (
      membershipCleanupError
    ) {
      console.error(
        "Membership cleanup warning:",
        membershipCleanupError
      );
    }

    const {
      error:
        profileCleanupError,
    } = await admin
      .from("profiles")
      .delete()
      .eq(
        "id",
        targetUserId
      )
      .eq(
        "company_id",
        membership.company_id
      );

    if (
      profileCleanupError
    ) {
      console.error(
        "Profile cleanup warning:",
        profileCleanupError
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Staff DELETE API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to delete staff member.",
      },
      {
        status: 500,
      }
    );
  }
}
