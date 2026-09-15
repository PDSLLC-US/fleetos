import type {
  Metadata,
} from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import CapacitorBackButton from "@/components/CapacitorBackButton";
import CapacitorPushNotifications from "@/components/CapacitorPushNotifications";
import SubscriptionNotice from "@/components/SubscriptionNotice";

import "./globals.css";

const geistSans =
  Geist({
    variable:
      "--font-geist-sans",
    subsets: ["latin"],
  });

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",
    subsets: ["latin"],
  });

export const metadata: Metadata = {
  title: {
    default:
      "FleetOS",
    template:
      "%s | FleetOS",
  },

  description:
    "Fleet operations, dispatch, financial and workforce management powered by Platinum Digital Services LLC.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CapacitorBackButton />
        <CapacitorPushNotifications />
        <SubscriptionNotice />

        {children}
      </body>
    </html>
  );
}