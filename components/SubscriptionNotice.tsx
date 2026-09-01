"use client";

import {
  useEffect,
  useState,
} from "react";

type SubscriptionResponse = {
  subscription?: {
    status?: string;
  };
};

export default function SubscriptionNotice() {
  const [
    status,
    setStatus,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const response =
          await fetch(
            "/api/company/subscription",
            {
              cache: "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const data:
          SubscriptionResponse =
          await response.json();

        if (!mounted) {
          return;
        }

        setStatus(
          data.subscription
            ?.status ?? ""
        );
      } catch (error) {
        console.error(
          "Subscription notice error:",
          error
        );
      }
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  if (
    status !==
    "past_due"
  ) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold text-amber-900">
          FleetOS billing notice
        </p>

        <p className="mt-1 text-sm leading-6 text-amber-800">
          Your company&apos;s FleetOS subscription has a billing issue.
          Access remains available for now. Please contact Platinum
          Digital Services LLC to avoid service interruption.
        </p>
      </div>
    </div>
  );
}