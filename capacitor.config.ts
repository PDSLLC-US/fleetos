import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.platinumdigital.fleetos",
  appName: "FleetOS",

  /*
   * Capacitor still expects a webDir even though the
   * production mobile shell loads FleetOS from the live
   * Next.js application.
   */
  webDir: "public",

  server: {
    /*
     * FleetOS remains hosted by the existing Next.js backend.
     *
     * This preserves:
     * - Supabase authentication
     * - Stripe billing
     * - API routes
     * - invoice PDF generation
     * - middleware / role permissions
     * - live company data
     */
    url: "https://portal.platinumllc.co",

    /*
     * Never allow unencrypted HTTP traffic in the
     * production mobile application.
     */
    cleartext: false,
  },
};

export default config;