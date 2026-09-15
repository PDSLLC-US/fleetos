"use client";

import { useEffect } from "react";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export default function CapacitorPushNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listeners = [
      PushNotifications.addListener("registration", (token) => {
        console.log("FleetOS FCM registration token:", token.value);
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

      void Promise.all(
        listeners.map((listener) =>
          listener.then((registration) => registration.remove())
        )
      );
    };
  }, []);

  return null;
}
