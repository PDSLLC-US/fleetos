"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

export default function SubscriptionRequiredPage() {
  const supabase =
    useMemo(
      () => createClient(),
      []
    );

  const [
    status,
    setStatus,
  ] = useState(
    "inactive"
  );

  const [
    signingOut,
    setSigningOut,
  ] = useState(
    false
  );

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    setStatus(
      params.get(
        "status"
      ) ?? "inactive"
    );
  }, []);

  const isSuspended =
    status ===
    "suspended";

  const isCancelled =
    status ===
    "cancelled";

  const isTrialExpired =
    status ===
    "trial_expired";

  let title =
    "FleetOS subscription required";

  let message =
    "Your company does not currently have access to FleetOS.";

  if (isSuspended) {
    title =
      "Your FleetOS account is suspended";

    message =
      "Access to your company workspace has been temporarily suspended. Please contact Platinum Digital Services LLC to restore your FleetOS service.";
  }

  if (isCancelled) {
    title =
      "Your FleetOS subscription has ended";

    message =
      "Your company's FleetOS subscription is no longer active. Please contact Platinum Digital Services LLC if you would like to reactivate your account.";
  }

  if (isTrialExpired) {
    title =
      "Your FleetOS trial has ended";

    message =
      "Your company's FleetOS trial period has expired. Please contact Platinum Digital Services LLC to activate a subscription and continue using FleetOS.";
  }

  async function handleReturnToSignIn() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "FleetOS sign out error:",
          error
        );
      }
    } catch (error) {
      console.error(
        "FleetOS sign out failed:",
        error
      );
    } finally {
      /*
       * Use a full navigation so middleware receives the
       * browser after the Supabase session cookies are cleared.
       */
      window.location.href =
        "/login";
    }
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#f5f7fb",

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          "32px",

        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <section
        style={{
          width:
            "100%",

          maxWidth:
            "620px",

          background:
            "#ffffff",

          border:
            "1px solid #e1e7ef",

          borderRadius:
            "24px",

          padding:
            "48px",

          boxShadow:
            "0 12px 35px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            color:
              "#1769ff",

            fontSize:
              "13px",

            fontWeight:
              800,

            letterSpacing:
              "4px",

            marginBottom:
              "18px",
          }}
        >
          FLEETOS
        </div>

        <div
          style={{
            display:
              "inline-flex",

            padding:
              "7px 12px",

            borderRadius:
              "999px",

            background:
              "#fff3cd",

            color:
              "#9a6700",

            fontWeight:
              700,

            fontSize:
              "13px",

            marginBottom:
              "22px",
          }}
        >
          ACCOUNT ACCESS
        </div>

        <h1
          style={{
            margin:
              0,

            color:
              "#071124",

            fontSize:
              "34px",

            lineHeight:
              1.15,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            color:
              "#53657d",

            fontSize:
              "17px",

            lineHeight:
              1.7,

            marginTop:
              "20px",

            marginBottom:
              "32px",
          }}
        >
          {message}
        </p>

        <div
          style={{
            borderTop:
              "1px solid #e5eaf1",

            paddingTop:
              "26px",
          }}
        >
          <p
            style={{
              color:
                "#6b7b90",

              fontSize:
                "14px",

              lineHeight:
                1.6,

              marginTop:
                0,
            }}
          >
            Need assistance with your FleetOS subscription?
            Contact Platinum Digital Services LLC.
          </p>

          <button
            type="button"
            onClick={() =>
              void handleReturnToSignIn()
            }
            disabled={
              signingOut
            }
            style={{
              marginTop:
                "14px",

              width:
                "100%",

              border:
                0,

              borderRadius:
                "12px",

              background:
                "#071124",

              color:
                "#ffffff",

              padding:
                "15px 20px",

              fontSize:
                "15px",

              fontWeight:
                700,

              cursor:
                signingOut
                  ? "not-allowed"
                  : "pointer",

              opacity:
                signingOut
                  ? 0.7
                  : 1,
            }}
          >
            {signingOut
              ? "Signing Out..."
              : "Return to Sign In"}
          </button>
        </div>

        <div
          style={{
            marginTop:
              "30px",

            color:
              "#8a98aa",

            fontSize:
              "12px",

            textAlign:
              "center",
          }}
        >
          FleetOS · Powered by Platinum Digital Services LLC
        </div>
      </section>
    </main>
  );
}