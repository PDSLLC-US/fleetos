import {
  NextResponse,
} from "next/server";

import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

import {
  createClient,
} from "@/lib/supabase/server";

export async function GET() {
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
      data: currentMembership,
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
        "Team list membership error:",
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
      !currentMembership ||
      ![
        "owner",
        "admin",
      ].includes(
        currentMembership.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Owner or Admin access required.",
        },
        {
          status: 403,
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

    const {
      data: members,
      error: membersError,
    } =
      await admin
        .from("company_members")
        .select(`
          user_id,
          role,
          driver_id,
          is_active,
          created_at
        `)
        .eq(
          "company_id",
          currentMembership.company_id
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (membersError) {
      console.error(
        "Team list members error:",
        membersError
      );

      throw membersError;
    }

    const userIds =
      (members ?? []).map(
        (member) =>
          member.user_id
      );

    if (
      userIds.length === 0
    ) {
      return NextResponse.json({
        currentUserId:
          user.id,
        currentUserRole:
          currentMembership.role,
        members: [],
      });
    }

    const {
      data: profiles,
      error: profilesError,
    } =
      await admin
        .from("profiles")
        .select(`
          id,
          full_name,
          role
        `)
        .in(
          "id",
          userIds
        );

    if (profilesError) {
      console.error(
        "Team profiles error:",
        profilesError
      );

      throw profilesError;
    }

    const authUsers:
      Record<
        string,
        {
          email: string | null;
          lastSignInAt: string | null;
          invitedAt: string | null;
        }
      > = {};

    let page = 1;
    let keepLoading = true;

    while (keepLoading) {
      const {
        data: usersData,
        error: usersError,
      } =
        await admin.auth.admin
          .listUsers({
            page,
            perPage: 1000,
          });

      if (usersError) {
        console.error(
          "Team auth users error:",
          usersError
        );

        throw usersError;
      }

      for (
        const authUser
        of usersData.users
      ) {
        if (
          userIds.includes(
            authUser.id
          )
        ) {
          authUsers[
            authUser.id
          ] = {
            email:
              authUser.email ??
              null,

            lastSignInAt:
              authUser
                .last_sign_in_at ??
              null,

            invitedAt:
              authUser
                .invited_at ??
              null,
          };
        }
      }

      if (
        usersData.users
          .length < 1000
      ) {
        keepLoading =
          false;
      } else {
        page += 1;
      }
    }

    const profileMap =
      new Map(
        (profiles ?? []).map(
          (profile) => [
            profile.id,
            profile,
          ]
        )
      );

    const result =
      (members ?? []).map(
        (member) => {
          const profile =
            profileMap.get(
              member.user_id
            );

          const authInfo =
            authUsers[
              member.user_id
            ];

          return {
            userId:
              member.user_id,

            fullName:
              profile?.full_name ??
              "FleetOS User",

            email:
              authInfo?.email ??
              null,

            role:
              member.role,

            driverId:
              member.driver_id,

            isActive:
              member.is_active,

            createdAt:
              member.created_at,

            lastSignInAt:
              authInfo
                ?.lastSignInAt ??
              null,

            invitedAt:
              authInfo
                ?.invitedAt ??
              null,
          };
        }
      );

    return NextResponse.json({
      currentUserId:
        user.id,

      currentUserRole:
        currentMembership.role,

      members: result,
    });
  } catch (error) {
    console.error(
      "Team list API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load company team.",
      },
      {
        status: 500,
      }
    );
  }
}
