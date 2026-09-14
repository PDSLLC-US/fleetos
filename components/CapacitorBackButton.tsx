"use client";

import { useEffect } from "react";

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export default function CapacitorBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listener = App.addListener("backButton", (event) => {
      if (event.canGoBack) {
        window.history.back();
        return;
      }

      App.minimizeApp();
    });

    return () => {
      void listener.then((handle) => {
        handle.remove();
      });
    };
  }, []);

  return null;
}
