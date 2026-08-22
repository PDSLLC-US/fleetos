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

type SignupForm = {
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;

  companyName: string;
  legalName: string;
  mcNumber: string;
  dotNumber: string;
  companyPhone: string;
};

type PendingOnboarding = {
  ownerName: string;
  email: string;

  companyName: string;
  legalName: string;
  mcNumber: string;
  dotNumber: string;
  companyPhone: string;
};

const PENDING_KEY =
  "fleetos_pending_onboarding";

export default function SignupPage() {
  const router = useRouter();
  const supabase =
    createClient();

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    completing,
    setCompleting,
  ] = useState(false);

  const [
    authenticatedWithoutCompany,
    setAuthenticatedWithoutCompany,
  ] = useState(false);

  const [
    pendingOnboarding,
    setPendingOnboarding,
  ] =
    useState<PendingOnboarding | null>(
      null
    );

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState<SignupForm>({
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",

    companyName: "",
    legalName: "",
    mcNumber: "",
    dotNumber: "",
    companyPhone: "",
  });

  useEffect(() => {
    void initializeSignup();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializeSignup() {
    setCheckingSession(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      /*
       * Load any onboarding information
       * saved before email verification.
       */

      const saved =
        window.localStorage.getItem(
          PENDING_KEY
        );

      let pending:
        | PendingOnboarding
        | null = null;

      if (saved) {
        try {
          pending =
            JSON.parse(saved);

          setPendingOnboarding(
            pending
          );

          setForm(
            (current) => ({
              ...current,

              ownerName:
                pending?.ownerName ??
                "",

              email:
                pending?.email ??
                "",

              companyName:
                pending?.companyName ??
                "",

              legalName:
                pending?.legalName ??
                "",

              mcNumber:
                pending?.mcNumber ??
                "",

              dotNumber:
                pending?.dotNumber ??
                "",

              companyPhone:
                pending?.companyPhone ??
                "",
            })
          );
        } catch {
          window.localStorage.removeItem(
            PENDING_KEY
          );
        }
      }

      if (!user) {
        setAuthenticatedWithoutCompany(
          false
        );

        return;
      }

      /*
       * Check whether this logged-in
       * user already belongs to a company.
       */

      const {
        data: membership,
        error:
          membershipError,
      } = await supabase
        .from(
          "company_members"
        )
        .select(
          "company_id, role, is_active"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();

      if (membershipError) {
        console.error(
          "Signup membership check:",
          membershipError
        );
      }

      if (membership) {
        /*
         * Existing FleetOS customer.
         */

        window.localStorage.removeItem(
          PENDING_KEY
        );

        if (
          membership.role ===
          "driver"
        ) {
          router.replace(
            "/driver"
          );
        } else {
          router.replace("/");
        }

        return;
      }

      /*
       * User is authenticated but
       * has not completed company setup.
       */

      setAuthenticatedWithoutCompany(
        true
      );

      /*
       * If we have the saved signup
       * information, the customer can
       * now complete onboarding.
       */

      if (pending) {
        setSuccess(
          "Your account is verified. Complete your company setup below."
        );
      }
    } catch (err) {
      console.error(
        "Signup initialization error:",
        err
      );
    } finally {
      setCheckingSession(false);
    }
  }

  function updateField(
    field: keyof SignupForm,
    value: string
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function buildPendingData():
    PendingOnboarding {
    return {
      ownerName:
        form.ownerName.trim(),

      email:
        form.email
          .trim()
          .toLowerCase(),

      companyName:
        form.companyName.trim(),

      legalName:
        form.legalName.trim(),

      mcNumber:
        form.mcNumber.trim(),

      dotNumber:
        form.dotNumber.trim(),

      companyPhone:
        form.companyPhone.trim(),
    };
  }

  function validateForm() {
    if (
      !form.ownerName.trim()
    ) {
      return "Your name is required.";
    }

    if (
      !form.email.trim()
    ) {
      return "Email is required.";
    }

    if (
      !form.companyName.trim()
    ) {
      return "Company name is required.";
    }

    if (
      !authenticatedWithoutCompany
    ) {
      if (
        form.password.length <
        8
      ) {
        return "Password must be at least 8 characters.";
      }

      if (
        form.password !==
        form.confirmPassword
      ) {
        return "Passwords do not match.";
      }
    }

    return null;
  }

  async function completeCompanyOnboarding(
    pending:
      PendingOnboarding
  ) {
    setCompleting(true);
    setError("");

    try {
      const {
        data,
        error:
          onboardingError,
      } = await supabase.rpc(
        "complete_company_onboarding",
        {
          company_name_input:
            pending.companyName,

          owner_name_input:
            pending.ownerName ||
            null,

          legal_name_input:
            pending.legalName ||
            null,

          mc_number_input:
            pending.mcNumber ||
            null,

          dot_number_input:
            pending.dotNumber ||
            null,

          phone_input:
            pending.companyPhone ||
            null,

          email_input:
            pending.email ||
            null,
        }
      );

      if (
        onboardingError
      ) {
        console.error(
          "Company onboarding error:",
          onboardingError
        );

        throw new Error(
          onboardingError.message
        );
      }

      console.log(
        "Company onboarding result:",
        data
      );

      window.localStorage.removeItem(
        PENDING_KEY
      );

      setPendingOnboarding(
        null
      );

      setSuccess(
        "Your FleetOS company has been created successfully."
      );

      /*
       * Force a full navigation.
       *
       * This ensures proxy.ts sees
       * the brand-new company membership.
       */

      window.location.href =
        "/";
    } catch (err) {
      console.error(
        "Complete company onboarding:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete company setup."
      );
    } finally {
      setCompleting(false);
    }
  }

  async function handleSignup(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError =
      validateForm();

    if (validationError) {
      setError(
        validationError
      );

      return;
    }

    const pending =
      buildPendingData();

    /*
     * If the customer already authenticated
     * after email verification, there is no
     * need to create another Auth account.
     */

    if (
      authenticatedWithoutCompany
    ) {
      await completeCompanyOnboarding(
        pending
      );

      return;
    }

    setSubmitting(true);

    try {
      /*
       * Save company information before
       * signup.
       *
       * If email confirmation is required,
       * this survives the verification step.
       *
       * Password is intentionally NOT stored.
       */

      window.localStorage.setItem(
        PENDING_KEY,
        JSON.stringify(
          pending
        )
      );

      setPendingOnboarding(
        pending
      );

      const {
        data,
        error:
          signupError,
      } =
        await supabase.auth.signUp({
          email:
            pending.email,

          password:
            form.password,

          options: {
            data: {
              full_name:
                pending.ownerName,
            },

            emailRedirectTo:
              `${window.location.origin}/signup`,
          },
        });

      if (signupError) {
        window.localStorage.removeItem(
          PENDING_KEY
        );

        throw new Error(
          signupError.message
        );
      }

      /*
       * If Supabase returned a session,
       * email confirmation is disabled
       * and we can onboard immediately.
       */

      if (data.session) {
        await completeCompanyOnboarding(
          pending
        );

        return;
      }

      /*
       * No session means Supabase likely
       * requires email confirmation.
       */

      setSuccess(
        "Your account was created. Check your email to verify your address. After verification, return to FleetOS and sign in to complete your company setup."
      );
    } catch (err) {
      console.error(
        "Signup error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your FleetOS account."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function signOutAndRestart() {
    try {
      await supabase.auth.signOut();
    } finally {
      window.localStorage.removeItem(
        PENDING_KEY
      );

      window.location.href =
        "/signup";
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-400">
            FleetOS
          </p>

          <p className="mt-4 text-lg font-semibold">
            Preparing account setup...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[0.85fr_1.15fr]">
          {/* ============================================= */}
          {/* LEFT PANEL */}
          {/* ============================================= */}

          <section className="bg-slate-900 p-8 text-white sm:p-10 lg:p-12">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-blue-400">
              FleetOS
            </p>

            <h1 className="mt-8 text-4xl font-bold leading-tight">
              Run your trucking
              operation from one
              place.
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
              Manage fleet operations,
              loads, drivers, PODs,
              expenses, settlements,
              invoices and payments
              through one secure
              company workspace.
            </p>

            <div className="mt-10 space-y-5">
              <Feature
                title="Company workspace"
                text="Your company data stays separated from every other FleetOS customer."
              />

              <Feature
                title="Driver workflow"
                text="Drivers can manage assigned loads and upload delivery paperwork."
              />

              <Feature
                title="Billing workflow"
                text="Move loads from delivery through invoicing and payment."
              />

              <Feature
                title="Role-based access"
                text="Control what Owners, Dispatchers, Fleet Managers, Accountants and Drivers can access."
              />
            </div>
          </section>

          {/* ============================================= */}
          {/* FORM */}
          {/* ============================================= */}

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mx-auto max-w-2xl">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  {authenticatedWithoutCompany
                    ? "COMPLETE SETUP"
                    : "CREATE YOUR COMPANY"}
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-950">
                  {authenticatedWithoutCompany
                    ? "Finish your FleetOS workspace"
                    : "Start with FleetOS"}
                </h2>

                <p className="mt-3 text-slate-500">
                  {authenticatedWithoutCompany
                    ? "Your account is authenticated. Complete your company information to enter FleetOS."
                    : "Create the Owner account and company workspace."}
                </p>
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

              <form
                onSubmit={
                  handleSignup
                }
                className="mt-8 space-y-8"
              >
                {/* OWNER */}

                <div>
                  <SectionTitle>
                    Owner Account
                  </SectionTitle>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Full Name *"
                    >
                      <input
                        value={
                          form.ownerName
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            "ownerName",
                            event.target
                              .value
                          )
                        }
                        placeholder="John Smith"
                        autoComplete="name"
                        className="form-input"
                      />
                    </Field>

                    <Field
                      label="Email *"
                    >
                      <input
                        type="email"
                        value={
                          form.email
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            "email",
                            event.target
                              .value
                          )
                        }
                        disabled={
                          authenticatedWithoutCompany
                        }
                        placeholder="owner@company.com"
                        autoComplete="email"
                        className="form-input disabled:bg-slate-100"
                      />
                    </Field>

                    {!authenticatedWithoutCompany && (
                      <>
                        <Field
                          label="Password *"
                        >
                          <input
                            type="password"
                            value={
                              form.password
                            }
                            onChange={(
                              event
                            ) =>
                              updateField(
                                "password",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Minimum 8 characters"
                            autoComplete="new-password"
                            className="form-input"
                          />
                        </Field>

                        <Field
                          label="Confirm Password *"
                        >
                          <input
                            type="password"
                            value={
                              form.confirmPassword
                            }
                            onChange={(
                              event
                            ) =>
                              updateField(
                                "confirmPassword",
                                event
                                  .target
                                  .value
                              )
                            }
                            autoComplete="new-password"
                            className="form-input"
                          />
                        </Field>
                      </>
                    )}
                  </div>
                </div>

                {/* COMPANY */}

                <div>
                  <SectionTitle>
                    Company Information
                  </SectionTitle>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Company Name *"
                    >
                      <input
                        value={
                          form.companyName
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            "companyName",
                            event.target
                              .value
                          )
                        }
                        placeholder="ABC Trucking LLC"
                        className="form-input"
                      />
                    </Field>

                    <Field
                      label="Legal Name"
                    >
                      <input
                        value={
                          form.legalName
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            "legalName",
                            event.target
                              .value
                          )
                        }
                        placeholder="ABC Transportation LLC"
                        className="form-input"
                      />
                    </Field>

                    <Field
                      label="MC Number"
                    >
                      <input
                        value={
                          form.mcNumber
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            "mcNumber",
                            event.target
                              .value
                          )
                        }
                        placeholder="MC123456"
                        className="form-input"
                      />
                    </Field>

                    <Field
                      label="USDOT Number"
                    >
                      <input
                        value={
                          form.dotNumber
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            "dotNumber",
                            event.target
                              .value
                          )
                        }
                        placeholder="1234567"
                        className="form-input"
                      />
                    </Field>

                    <div className="sm:col-span-2">
                      <Field
                        label="Company Phone"
                      >
                        <input
                          type="tel"
                          value={
                            form.companyPhone
                          }
                          onChange={(
                            event
                          ) =>
                            updateField(
                              "companyPhone",
                              event.target
                                .value
                            )
                          }
                          placeholder="+1 555 555 5555"
                          className="form-input"
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    completing
                  }
                  className="w-full rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {completing
                    ? "Creating Company..."
                    : submitting
                      ? "Creating Account..."
                      : authenticatedWithoutCompany
                        ? "Complete Company Setup"
                        : "Create FleetOS Account"}
                </button>

                {!authenticatedWithoutCompany && (
                  <p className="text-center text-sm text-slate-500">
                    Already have a
                    FleetOS account?{" "}
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/login"
                        )
                      }
                      className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Sign in
                    </button>
                  </p>
                )}

                {authenticatedWithoutCompany && (
                  <p className="text-center text-sm text-slate-500">
                    Wrong account?{" "}
                    <button
                      type="button"
                      onClick={() =>
                        void signOutAndRestart()
                      }
                      className="font-semibold text-blue-600"
                    >
                      Sign out and restart
                    </button>
                  </p>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          background: white;
          color: rgb(15 23 42);
          outline: none;
        }

        .form-input:focus {
          border-color: rgb(37 99 235);
          box-shadow: 0 0 0 1px rgb(37 99 235);
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function SectionTitle({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 pb-3">
      <h3 className="font-semibold text-slate-900">
        {children}
      </h3>
    </div>
  );
}

function Feature({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
        ✓
      </div>

      <div>
        <p className="font-semibold">
          {title}
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-400">
          {text}
        </p>
      </div>
    </div>
  );
}