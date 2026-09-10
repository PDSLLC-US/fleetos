"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FleetOSBrand from "@/components/FleetOSBrand";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        {/* BRAND PANEL */}
        <section className="flex flex-col justify-between bg-slate-50 px-8 py-10 sm:px-12 lg:px-14">
          <div>
            <FleetOSBrand variant="login" />

            <div className="mx-auto mt-10 max-w-sm space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  ✓
                </span>

                <div>
                  <p className="font-semibold text-slate-900">
                    Manage your fleet
                  </p>

                  <p className="mt-1 leading-6">
                    Trucks, drivers, loads, trailers and maintenance
                    in one operating system.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  ✓
                </span>

                <div>
                  <p className="font-semibold text-slate-900">
                    Track performance
                  </p>

                  <p className="mt-1 leading-6">
                    Follow load progress, revenue, expenses and
                    settlements from one portal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  ✓
                </span>

                <div>
                  <p className="font-semibold text-slate-900">
                    Operate efficiently
                  </p>

                  <p className="mt-1 leading-6">
                    Give owners, dispatchers, fleet managers,
                    accountants and drivers the right level of
                    access.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center text-xs leading-5 text-slate-400">
            © 2026 Platinum Digital Services LLC
            <br />
            All rights reserved.
          </div>
        </section>

        {/* LOGIN PANEL */}
        <section className="flex items-center justify-center px-8 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            <p className="text-sm font-medium text-slate-500">
              Welcome back
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Sign in to your account
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Access your FleetOS operations portal.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* NEW COMPANY SIGNUP */}
            <div className="mt-7">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />

                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  New to FleetOS?
                </span>

                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-center">
                  <h2 className="text-base font-bold text-slate-950">
                    Run your company with FleetOS
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Create your company account, choose the plan that
                    fits your fleet, and get started with FleetOS.
                  </p>
                </div>

                <Link
                  href="/signup"
                  className="mt-5 flex w-full items-center justify-center rounded-xl border border-slate-950 bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-950 hover:text-white"
                >
                  Create Company Account
                </Link>

                <p className="mt-3 text-center text-xs text-slate-500">
                  For trucking company owners
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-center text-xs text-slate-500">
                Secure fleet operations powered by
                <span className="font-semibold text-slate-700">
                  {" "}
                  Platinum Digital Services LLC
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}