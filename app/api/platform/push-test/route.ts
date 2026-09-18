import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import getFirebaseMessaging from "@/lib/firebase/admin";

export const runtime = "nodejs";

type PushDevice = {
  id: string;
  fcm_token: string;
};

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      value
    )
  );
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const userId =
      typeof body === "object" &&
      body !== null &&
      "userId" in body &&
      typeof body.userId === "string"
        ? body.userId.trim()
        : "";

    if (!isValidUUID(userId)) {
      return NextResponse.json(
        { error: "Invalid userId" },
        { status: 400 }
      );
    }

    // Authenticate the caller using the normal user session.
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only FleetOS platform administrators may use this test sender.
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "is_platform_admin"
    );

    if (adminError || isAdmin !== true) {
      return NextResponse.json(
        { error: "Platinum Platform Administrator access required." },
        { status: 403 }
      );
    }

    // Service-role credentials are used only after platform-admin
    // authorization has succeeded.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Push test: Supabase server configuration is missing.");

      return NextResponse.json(
        { error: "Server not configured." },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Retrieve only active Android devices belonging to the target user.
    const { data, error: devicesError } = await adminClient
      .from("push_devices")
      .select("id, fcm_token")
      .eq("user_id", userId)
      .eq("platform", "android")
      .eq("is_active", true);

    if (devicesError) {
      console.error("Push test: unable to query registered devices.");

      return NextResponse.json(
        { error: "Unable to query devices." },
        { status: 500 }
      );
    }

    const devices: PushDevice[] = (data ?? []).filter(
      (device): device is PushDevice =>
        typeof device.id === "string" &&
        typeof device.fcm_token === "string" &&
        device.fcm_token.trim().length > 0
    );

    if (devices.length === 0) {
      return NextResponse.json({
        success: false,
        successCount: 0,
        failureCount: 0,
        message: "No active Android push devices registered.",
      });
    }

    // Firebase multicast requests support at most 500 registration tokens.
    if (devices.length > 500) {
      return NextResponse.json(
        { error: "Too many registered devices for a test notification." },
        { status: 400 }
      );
    }

    let messaging;

    try {
      messaging = getFirebaseMessaging();
    } catch (error: unknown) {
      console.error(
        `Push test: Firebase initialization failed: ${getSafeErrorMessage(
          error
        )}`
      );

      return NextResponse.json(
        { error: "Firebase not configured." },
        { status: 500 }
      );
    }

    const sendResult = await messaging.sendEachForMulticast({
      notification: {
        title: "FleetOS",
        body: "Push notifications are working.",
      },
      tokens: devices.map((device) => device.fcm_token),
    });

    const permanentlyInvalidDeviceIds: string[] = [];

    sendResult.responses.forEach((response, index) => {
      if (response.success || !response.error) {
        return;
      }

      const code = response.error.code;

      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        const device = devices[index];

        if (device) {
          permanentlyInvalidDeviceIds.push(device.id);
        }
      }
    });

    // Deactivate only tokens Firebase has identified as permanently invalid.
    // Database updates use the device row ID, never the FCM token itself.
    if (permanentlyInvalidDeviceIds.length > 0) {
      const { error: deactivateError } = await adminClient
        .from("push_devices")
        .update({ is_active: false })
        .in("id", permanentlyInvalidDeviceIds);

      if (deactivateError) {
        console.error(
          "Push test: failed to deactivate permanently invalid devices."
        );
      }
    }

    return NextResponse.json({
      success: true,
      successCount: sendResult.successCount,
      failureCount: sendResult.failureCount,
    });
  } catch (error: unknown) {
    console.error(
      `Push test: request failed: ${getSafeErrorMessage(error)}`
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}