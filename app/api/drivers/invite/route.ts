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

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    // ----------------------------------------------------------
    // AUTHENTICATED USER
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // VERIFY OWNER / ADMIN
    // ----------------------------------------------------------

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
        "Driver invite membership error:",
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

    // ----------------------------------------------------------
    // REQUEST
    // ----------------------------------------------------------

    const body =
      await request.json();

    const driverId =
      String(
        body.driverId ?? ""
      ).trim();

    if (!driverId) {
      return NextResponse.json(
        {
          error:
            "Driver ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------------------------
    // LOAD DRIVER
    //
    // RLS + explicit company check both protect tenant isolation.
    // ----------------------------------------------------------

    const {
      data: driver,
      error: driverError,
    } =
      await supabase
        .from("drivers")
        .select(`
          id,
          company_id,
          first_name,
          last_name,
          email,
          status
        `)
        .eq(
          "id",
          driverId
        )
        .eq(
          "company_id",
          membership.company_id
        )
        .maybeSingle();

    if (driverError) {
      console.error(
        "Driver invite lookup error:",
        driverError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load driver.",
        },
        {
          status: 500,
        }
      );
    }

    if (!driver) {
      return NextResponse.json(
        {
          error:
            "Driver was not found in your company.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      driver.status !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            "Only active drivers can be invited.",
        },
        {
          status: 400,
        }
      );
    }

    const email =
      String(
        driver.email ?? ""
      )
        .trim()
        .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Add an email address to this driver before sending an invitation.",
        },
        {
          status: 400,
        }
      );
    }

    const fullName =
      `${driver.first_name ?? ""} ${driver.last_name ?? ""}`
        .trim();

    // ----------------------------------------------------------
    // SERVER CONFIG
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // INVITE AUTH USER
    // ----------------------------------------------------------

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
                "driver",

              invited_company_id:
                membership.company_id,

              invited_driver_id:
                driver.id,
            },

            redirectTo:
              `${origin}/accept-invite`,
          }
        );

    if (inviteError) {
      console.error(
        "Supabase driver invite error:",
        inviteError
      );

      if (
        inviteError.message
          .toLowerCase()
          .includes("already")
      ) {
        // ------------------------------------------------------
        // RE-INVITE EXISTING AUTH USER
        //
        // Supabase will not create/invite the same Auth user
        // twice. This is the normal path when the original
        // driver invitation expired before activation.
        // ------------------------------------------------------

        const {
          data: usersData,
          error: usersError,
        } =
          await admin.auth.admin
            .listUsers({
              page: 1,
              perPage: 1000,
            });

        if (usersError) {
          console.error(
            "Existing driver Auth lookup error:",
            usersError
          );

          return NextResponse.json(
            {
              error:
                "The driver account already exists, but FleetOS could not prepare a new invitation.",
            },
            {
              status: 500,
            }
          );
        }

        const existingUser =
          usersData.users.find(
            (candidate) =>
              candidate.email
                ?.trim()
                .toLowerCase() ===
              email
          );

        if (!existingUser) {
          return NextResponse.json(
            {
              error:
                "The driver account already exists, but FleetOS could not locate it.",
            },
            {
              status: 409,
            }
          );
        }

        // Verify that an active membership for this Auth user
        // does not belong to another FleetOS company/role.
        const {
          data: existingMemberships,
          error: existingMembershipError,
        } =
          await admin
            .from("company_members")
            .select(`
              company_id,
              role,
              driver_id,
              is_active
            `)
            .eq(
              "user_id",
              existingUser.id
            )
            .eq(
              "is_active",
              true
            );

        if (existingMembershipError) {
          console.error(
            "Existing driver membership lookup error:",
            existingMembershipError
          );

          return NextResponse.json(
            {
              error:
                "Unable to verify the existing driver account.",
            },
            {
              status: 500,
            }
          );
        }

        const conflictingMembership =
          (existingMemberships ?? [])
            .find(
              (member) =>
                member.company_id !==
                  membership.company_id ||
                member.role !==
                  "driver" ||
                (
                  member.driver_id &&
                  member.driver_id !==
                    driver.id
                )
            );

        if (conflictingMembership) {
          return NextResponse.json(
            {
              error:
                "An active FleetOS account with this email already belongs to another company or role.",
            },
            {
              status: 409,
            }
          );
        }

        // Reconnect/repair the intended company membership.
        const {
          error: memberError,
        } =
          await supabase.rpc(
            "manage_company_member",
            {
              target_user_id:
                existingUser.id,

              target_role:
                "driver",

              target_driver_id:
                driver.id,

              target_is_active:
                true,
            }
          );

        if (memberError) {
          console.error(
            "Driver re-invite membership error:",
            memberError
          );

          return NextResponse.json(
            {
              error:
                memberError.message ||
                "Unable to reconnect the driver account.",
            },
            {
              status: 400,
            }
          );
        }

        // Keep the Auth metadata current.
        const {
          error: metadataError,
        } =
          await admin.auth.admin
            .updateUserById(
              existingUser.id,
              {
                user_metadata: {
                  full_name:
                    fullName,

                  invited_role:
                    "driver",

                  invited_company_id:
                    membership.company_id,

                  invited_driver_id:
                    driver.id,
                },
              }
            );

        if (metadataError) {
          console.error(
            "Driver re-invite metadata update error:",
            metadataError
          );
        }

        const {
          error: profileError,
        } =
          await admin
            .from("profiles")
            .update({
              full_name:
                fullName,
            })
            .eq(
              "id",
              existingUser.id
            );

        if (profileError) {
          console.error(
            "Driver re-invite profile update error:",
            profileError
          );
        }

        // Send a fresh Supabase recovery link. Recovery links
        // establish a valid authenticated session and redirect
        // to the same FleetOS activation page, where the driver
        // creates/replaces their password.
        const {
          error: recoveryError,
        } =
          await admin.auth
            .resetPasswordForEmail(
              email,
              {
                redirectTo:
                  `${origin}/accept-invite`,
              }
            );

        if (recoveryError) {
          console.error(
            "Driver re-invite recovery error:",
            recoveryError
          );

          return NextResponse.json(
            {
              error:
                recoveryError.message ||
                "Unable to resend the driver invitation.",
            },
            {
              status: 400,
            }
          );
        }

        return NextResponse.json(
          {
            success: true,
            resent: true,

            driver: {
              id:
                driver.id,

              userId:
                existingUser.id,

              email,

              fullName,

              role:
                "driver",
            },
          },
          {
            status: 200,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            inviteError.message ||
            "Unable to send driver invitation.",
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

    // ----------------------------------------------------------
    // CREATE COMPANY MEMBERSHIP
    //
    // Critical difference from staff:
    // target_driver_id points to the actual drivers row.
    // ----------------------------------------------------------

    const {
      error: memberError,
    } =
      await supabase.rpc(
        "manage_company_member",
        {
          target_user_id:
            invitedUser.id,

          target_role:
            "driver",

          target_driver_id:
            driver.id,

          target_is_active:
            true,
        }
      );

    if (memberError) {
      console.error(
        "Driver membership creation error:",
        memberError
      );

      const {
        error: cleanupError,
      } =
        await admin.auth.admin
          .deleteUser(
            invitedUser.id
          );

      if (cleanupError) {
        console.error(
          "Unable to clean up failed driver invitation:",
          cleanupError
        );
      }

      return NextResponse.json(
        {
          error:
            memberError.message ||
            "Unable to connect driver account.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------------------------
    // PROFILE
    // ----------------------------------------------------------

    const {
      error: profileError,
    } =
      await admin
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
        "Driver profile-name update error:",
        profileError
      );
    }

    // ----------------------------------------------------------
    // SUCCESS
    // ----------------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        driver: {
          id:
            driver.id,

          userId:
            invitedUser.id,

          email,

          fullName,

          role:
            "driver",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Driver invitation API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to invite driver.",
      },
      {
        status: 500,
      }
    );
  }
}