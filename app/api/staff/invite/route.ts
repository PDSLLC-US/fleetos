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

export async function POST(
  request: NextRequest
) {
  try {
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
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
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
        "Staff invite membership error:",
        membershipError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify company membership.",
        },
        {
          status: 500,
        }
      );
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
      return NextResponse.json(
        {
          error:
            "Owner or Admin access is required.",
        },
        {
          status: 403,
        }
      );
    }

    const body =
      await request.json();

    const email =
      String(
        body.email ?? ""
      )
        .trim()
        .toLowerCase();

    const fullName =
      String(
        body.fullName ?? ""
      ).trim();

    const role =
      String(
        body.role ?? ""
      ) as AllowedStaffRole;

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Staff email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        {
          error:
            "Staff name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_ROLES.includes(
        role
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
      console.error(
        "Missing Supabase server configuration."
      );

      return NextResponse.json(
        {
          error:
            "FleetOS invitation service is not configured.",
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

    const origin =
      request.nextUrl.origin;

    const {
      data: inviteData,
      error: inviteError,
    } =
      await admin.auth.admin
        .inviteUserByEmail(
          email,
          {
            data: {
              full_name:
                fullName,

              invited_role:
                role,

              invited_company_id:
                membership.company_id,
            },

            redirectTo:
              `${origin}/accept-invite`,
          }
        );

    if (inviteError) {
      console.error(
        "Supabase staff invite error:",
        inviteError
      );

      if (
        inviteError.message
          .toLowerCase()
          .includes(
            "already"
          )
      ) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            inviteError.message ||
            "Unable to send invitation.",
        },
        {
          status: 400,
        }
      );
    }

    const invitedUser =
      inviteData.user;

    if (!invitedUser?.id) {
      return NextResponse.json(
        {
          error:
            "Invitation was sent, but FleetOS could not retrieve the new user.",
        },
        {
          status: 500,
        }
      );
    }

    const {
      error:
        memberError,
    } = await supabase.rpc(
      "manage_company_member",
      {
        target_user_id:
          invitedUser.id,

        target_role:
          role,

        target_driver_id:
          null,

        target_is_active:
          true,
      }
    );

    if (memberError) {
      console.error(
        "Staff membership creation error:",
        memberError
      );

      const {
        error:
          cleanupError,
      } =
        await admin.auth.admin
          .deleteUser(
            invitedUser.id
          );

      if (cleanupError) {
        console.error(
          "Unable to clean up failed staff invitation:",
          cleanupError
        );
      }

      return NextResponse.json(
        {
          error:
            memberError.message ||
            "Unable to add staff member to company.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error:
        profileError,
    } = await admin
      .from("profiles")
      .update({
        full_name:
          fullName,
      })
      .eq(
        "id",
        invitedUser.id
      );

    if (profileError) {
      console.error(
        "Staff profile-name update error:",
        profileError
      );
    }

    return NextResponse.json(
      {
        success: true,

        staff: {
          id:
            invitedUser.id,

          email,

          fullName,

          role,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Staff invitation API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to invite staff member.",
      },
      {
        status: 500,
      }
    );
  }
}