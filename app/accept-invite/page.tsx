"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] =
    useState(true);

  const [ready, setReady] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    invitedEmail,
    setInvitedEmail,
  ] = useState("");

  useEffect(() => {
    void initializeInvitation();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializeInvitation() {
    setLoading(true);
    setReady(false);
    setError("");

    try {
      const currentUrl =
        new URL(
          window.location.href
        );

      // ======================================================
      // METHOD 1:
      // Supabase PKCE-style invitation
      //
      // Example:
      // /accept-invite?code=...
      // ======================================================

      const code =
        currentUrl.searchParams.get(
          "code"
        );

      if (code) {
        /*
         * Sign out any previously logged-in
         * Owner/Admin user before exchanging
         * the staff invitation.
         */
        await supabase.auth.signOut();

        const {
          data:
            exchangeData,
          error:
            exchangeError,
        } =
          await supabase.auth
            .exchangeCodeForSession(
              code
            );

        if (
          exchangeError
        ) {
          console.error(
            "Invitation code exchange error:",
            exchangeError
          );

          throw new Error(
            exchangeError.message
          );
        }

        if (
          !exchangeData.session
        ) {
          throw new Error(
            "FleetOS could not create an invitation session."
          );
        }

        const invitedUser =
          exchangeData.session
            .user;

        setInvitedEmail(
          invitedUser.email ??
            ""
        );

        window.history.replaceState(
          {},
          document.title,
          "/accept-invite"
        );

        setReady(true);
        return;
      }

      // ======================================================
      // METHOD 2:
      // Supabase token/hash invitation
      //
      // Example:
      // /accept-invite#access_token=...
      // &refresh_token=...
      // &type=invite
      // ======================================================

      const hash =
        window.location.hash;

      if (
        hash &&
        hash.length > 1
      ) {
        const hashParams =
          new URLSearchParams(
            hash.substring(1)
          );

        const accessToken =
          hashParams.get(
            "access_token"
          );

        const refreshToken =
          hashParams.get(
            "refresh_token"
          );

        const type =
          hashParams.get(
            "type"
          );

        const hashError =
          hashParams.get(
            "error_description"
          ) ||
          hashParams.get(
            "error"
          );

        if (hashError) {
          throw new Error(
            hashError
          );
        }

        if (
          accessToken &&
          refreshToken
        ) {
          /*
           * Critical:
           * Remove the Owner session before
           * applying the invitation tokens.
           */
          await supabase.auth.signOut();

          const {
            data:
              sessionData,
            error:
              sessionError,
          } =
            await supabase.auth
              .setSession({
                access_token:
                  accessToken,

                refresh_token:
                  refreshToken,
              });

          if (
            sessionError
          ) {
            console.error(
              "Invitation session error:",
              sessionError
            );

            throw new Error(
              sessionError.message
            );
          }

          if (
            !sessionData.session
          ) {
            throw new Error(
              "FleetOS could not activate the invitation session."
            );
          }

          if (
            type &&
            type !== "invite" &&
            type !== "signup"
          ) {
            console.warn(
              "Unexpected Supabase invitation type:",
              type
            );
          }

          setInvitedEmail(
            sessionData
              .session.user
              .email ?? ""
          );

          /*
           * Remove tokens from browser URL.
           * We do not want access tokens sitting
           * in browser history.
           */
          window.history.replaceState(
            {},
            document.title,
            "/accept-invite"
          );

          setReady(true);
          return;
        }
      }

      // ======================================================
      // NO INVITATION TOKEN
      // ======================================================

      /*
       * Do NOT fall back to an existing session.
       *
       * That was the bug that caused FleetOS to
       * treat the already-logged-in Owner as the
       * invited Dispatcher.
       */

      setError(
        "This invitation link does not contain a valid FleetOS invitation. Please use the newest invitation email."
      );
    } catch (err) {
      console.error(
        "Invitation initialization error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify this invitation."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!ready) {
      setError(
        "The invitation has not been verified."
      );

      return;
    }

    if (
      password.length < 8
    ) {
      setError(
        "Password must be at least 8 characters."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );

      return;
    }

    setSaving(true);

    try {
      // ======================================================
      // SAFETY CHECK
      // ======================================================

      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "The invitation session has expired. Please request a new invitation."
        );
      }

      if (
        invitedEmail &&
        user.email !==
          invitedEmail
      ) {
        throw new Error(
          "FleetOS detected a different logged-in account. Please request a new invitation."
        );
      }

      // ======================================================
      // SET INVITED USER PASSWORD
      // ======================================================

      const {
        error:
          passwordError,
      } =
        await supabase.auth
          .updateUser({
            password,
          });

      if (
        passwordError
      ) {
        throw new Error(
          passwordError.message
        );
      }

      setSuccess(
        "Your FleetOS staff account has been activated successfully."
      );

      /*
       * Full navigation makes proxy.ts reload
       * the new employee's membership/role.
       */
      setTimeout(() => {
        window.location.href =
          "/";
      }, 900);
    } catch (err) {
      console.error(
        "Invitation activation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to activate your FleetOS account."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-blue-400">
            FleetOS
          </p>

          <p className="mt-4 text-lg font-semibold">
            Verifying invitation...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-600">
            FleetOS
          </p>

          <h1 className="mt-4 text-3xl font-bold text-slate-950">
            Accept Invitation
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Activate your staff
            account and create your
            FleetOS password.
          </p>

          {ready &&
            invitedEmail && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invited Account
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {
                    invitedEmail
                  }
                </p>
              </div>
            )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {ready && (
          <form
            onSubmit={
              handleSubmit
            }
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Create Password
              </label>

              <input
                type="password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm Password
              </label>

              <input
                type="password"
                value={
                  confirmPassword
                }
                onChange={(
                  event
                ) =>
                  setConfirmPassword(
                    event.target
                      .value
                  )
                }
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={
                saving
              }
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Activating Account..."
                : "Activate FleetOS Account"}
            </button>
          </form>
        )}

        {!ready && (
          <button
            type="button"
            onClick={() =>
              router.push(
                "/login"
              )
            }
            className="mt-6 w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Return to Login
          </button>
        )}
      </div>
    </main>
  );
}