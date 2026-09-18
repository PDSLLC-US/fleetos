"use client";

import { useEffect, useRef } from "react";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { createClient } from "@/lib/supabase/client";
import type {
  SupabaseClient,
  AuthChangeEvent,
  Session,
} from "@supabase/supabase-js";

export default function CapacitorPushNotifications() {
  const supabaseRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let authSub: { subscription?: { unsubscribe?: () => void } } | null = null;

    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }

    const supabase = supabaseRef.current;

    const listeners = [
      PushNotifications.addListener("registration", async (token) => {
        try {
          if (!token?.value) return;

          // Small metadata indicating this registration came from the FleetOS Capacitor app
          const metadata = {
            source: "fleetos.capacitor",
            timestamp: new Date().toISOString(),
            platform: Capacitor.getPlatform(),
          } as const;

          // Try immediate auth lookup
          const { data: userData, error: userError } = await supabase.auth.getUser();

          async function callUpsert() {
            try {
              const { error: rpcError } = await supabase.rpc("upsert_push_device", {
                p_fcm_token: token.value,
                p_platform: Capacitor.getPlatform(),
                p_device_id: null,
                p_app_version: null,
                p_metadata: metadata,
                p_is_active: true,
              });

              if (rpcError) {
                console.error("FleetOS push device registration failed:", rpcError);
              } else {
                console.log("FleetOS push device registered successfully");
              }
            } catch (err) {
              console.error("FleetOS push device registration error:", err);
            }
          }

          if (userError || !userData?.user) {
            // No authenticated user yet; wait for auth restoration and try once when session.user becomes available.
            let upsertCalled = false;
            let attemptInProgress = false;

            const { data } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
              if (!session?.user) return; // do not call when session/user is absent
              if (upsertCalled || attemptInProgress) return;

              attemptInProgress = true;
              try {
                await callUpsert();
                upsertCalled = true;

                // Unsubscribe the temporary listener after a successful attempt
                try {
                  if (data?.subscription?.unsubscribe) {
                    data.subscription.unsubscribe();
                  } else if (typeof (data as any)?.unsubscribe === "function") {
                    (data as any).unsubscribe();
                  }
                } catch {}
              } finally {
                attemptInProgress = false;
              }
            });

            authSub = data ?? null;
            return;
          }

          // Authenticated now - call RPC
          await callUpsert();
        } catch (error) {
          console.error("FleetOS FCM registration handler error:", error);
        }
      }),
      PushNotifications.addListener("registrationError", (error) => {
        console.error("FleetOS FCM registration error:", error);
      }),
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("FleetOS push notification received:", notification);
      }),
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("FleetOS push notification action performed:", action);
      }),
    ];

    let active = true;

    async function ensureNativeRegistration() {
      if (!active || Capacitor.getPlatform() !== "android") {
        return;
      }

      try {
        const permissionStatus = await PushNotifications.checkPermissions();

        if (permissionStatus.receive !== "granted") {
          const requestResult = await PushNotifications.requestPermissions();

          if (requestResult.receive !== "granted") {
            return;
          }
        }

        await PushNotifications.register();
      } catch (error) {
        console.error("FleetOS native push registration failed:", error);
      }
    }

    void ensureNativeRegistration();

    return () => {
      active = false;

      try {
        if (authSub?.subscription?.unsubscribe) {
          authSub.subscription.unsubscribe();
        }
      } catch {}

      void Promise.all(
        listeners.map((listener) =>
          listener.then((registration) => registration.remove())
        )
      );
    };
  }, []);

  return null;
}
