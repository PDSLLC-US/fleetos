import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "accountant"
  | "fleet_manager"
  | "driver";

export type AuthRoleContext = {
  userId: string;
  email: string | null;
  companyId: string;
  role: CompanyRole;
  driverId: string | null;
  isActive: boolean;
};

export async function getAuthRole(
  supabase: SupabaseClient
): Promise<AuthRoleContext | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Unable to get authenticated user:", userError);
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("company_members")
      .select(`
        company_id,
        role,
        driver_id,
        is_active
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

  if (membershipError) {
    console.error(
      "Unable to load company membership:",
      membershipError
    );

    throw membershipError;
  }

  if (!membership) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    companyId: membership.company_id as string,
    role: membership.role as CompanyRole,
    driverId:
      (membership.driver_id as string | null) ?? null,
    isActive: membership.is_active === true,
  };
}

export function isOwnerOrAdmin(
  role: CompanyRole | null | undefined
) {
  return role === "owner" || role === "admin";
}

export function isManagementRole(
  role: CompanyRole | null | undefined
) {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "dispatcher" ||
    role === "accountant" ||
    role === "fleet_manager"
  );
}

export function isDriverRole(
  role: CompanyRole | null | undefined
) {
  return role === "driver";
}

export function roleLabel(
  role: CompanyRole | null | undefined
) {
  switch (role) {
    case "owner":
      return "Owner";

    case "admin":
      return "Administrator";

    case "dispatcher":
      return "Dispatcher";

    case "accountant":
      return "Accountant";

    case "fleet_manager":
      return "Fleet Manager";

    case "driver":
      return "Driver";

    default:
      return "User";
  }
}