"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type TeamMember = {
  userId: string;
  fullName: string;
  email: string | null;
  role: string;
  driverId: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  invitedAt: string | null;
};

type InviteForm = {
  fullName: string;
  email: string;
  role: string;
};

const ROLE_OPTIONS = [
  {
    value: "admin",
    label: "Administrator",
  },
  {
    value: "dispatcher",
    label: "Dispatcher",
  },
  {
    value: "fleet_manager",
    label: "Fleet Manager",
  },
  {
    value: "accountant",
    label: "Accountant",
  },
];

export default function TeamPage() {
  const [members, setMembers] =
    useState<TeamMember[]>([]);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [inviting, setInviting] =
    useState(false);

  const [
    showInvite,
    setShowInvite,
  ] = useState(false);

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    actionUserId,
    setActionUserId,
  ] = useState<string | null>(
    null
  );

  const [
    editingMember,
    setEditingMember,
  ] =
    useState<TeamMember | null>(
      null
    );

  const [
    selectedRole,
    setSelectedRole,
  ] = useState("dispatcher");

  const [form, setForm] =
    useState<InviteForm>({
      fullName: "",
      email: "",
      role: "dispatcher",
    });

  useEffect(() => {
    void loadTeam();
  }, []);

  async function loadTeam() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/staff/list",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load team."
        );
      }

      setCurrentUserId(
        data.currentUserId ?? ""
      );

      setMembers(
        data.members ?? []
      );
    } catch (err) {
      console.error(
        "Team load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load team."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetInviteForm() {
    setForm({
      fullName: "",
      email: "",
      role: "dispatcher",
    });
  }

  async function handleInvite(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.fullName.trim()) {
      setError(
        "Staff name is required."
      );
      return;
    }

    if (!form.email.trim()) {
      setError(
        "Staff email is required."
      );
      return;
    }

    setInviting(true);

    try {
      const response =
        await fetch(
          "/api/staff/invite",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              fullName:
                form.fullName.trim(),

              email:
                form.email
                  .trim()
                  .toLowerCase(),

              role: form.role,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to send invitation."
        );
      }

      setSuccess(
        `Invitation sent to ${form.email.trim()}.`
      );

      resetInviteForm();
      setShowInvite(false);

      await loadTeam();
    } catch (err) {
      console.error(
        "Staff invitation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send invitation."
      );
    } finally {
      setInviting(false);
    }
  }

  async function updateMember(
    member: TeamMember,
    body: {
      role?: string;
      isActive?: boolean;
    },
    successMessage: string
  ) {
    setError("");
    setSuccess("");
    setActionUserId(
      member.userId
    );

    try {
      const response =
        await fetch(
          `/api/staff/${member.userId}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(body),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update team member."
        );
      }

      setSuccess(
        successMessage
      );

      setEditingMember(null);

      await loadTeam();
    } catch (err) {
      console.error(
        "Team member update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update team member."
      );
    } finally {
      setActionUserId(null);
    }
  }

  async function deleteMember(
    member: TeamMember
  ) {
    const confirmed =
      window.confirm(
        `Permanently delete ${member.fullName}?\n\nThis removes the FleetOS login account and company membership. This action cannot be undone.\n\nIf you only want to block access temporarily, use Deactivate instead.`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    setActionUserId(
      member.userId
    );

    try {
      const response =
        await fetch(
          `/api/staff/${member.userId}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete team member."
        );
      }

      setSuccess(
        `${member.fullName} was permanently deleted.`
      );

      await loadTeam();
    } catch (err) {
      console.error(
        "Team member delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete team member."
      );
    } finally {
      setActionUserId(null);
    }
  }

  function openRoleEditor(
    member: TeamMember
  ) {
    setError("");
    setSuccess("");

    setSelectedRole(
      member.role
    );

    setEditingMember(
      member
    );
  }

  const filteredMembers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return members;
      }

      return members.filter(
        (member) =>
          member.fullName
            .toLowerCase()
            .includes(query) ||
          (member.email ?? "")
            .toLowerCase()
            .includes(query) ||
          member.role
            .toLowerCase()
            .includes(query)
      );
    }, [members, search]);

  const activeCount =
    members.filter(
      (member) =>
        member.isActive
    ).length;

  const ownerAdminCount =
    members.filter(
      (member) =>
        [
          "owner",
          "admin",
        ].includes(member.role)
    ).length;

  const operationsCount =
    members.filter(
      (member) =>
        [
          "dispatcher",
          "fleet_manager",
        ].includes(member.role)
    ).length;

  const accountingCount =
    members.filter(
      (member) =>
        member.role ===
        "accountant"
    ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-600">
              FleetOS
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Team Management
            </h1>

            <p className="mt-2 text-slate-500">
              Invite and manage people
              who have access to your
              FleetOS company.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              resetInviteForm();
              setShowInvite(true);
            }}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            + Invite Staff
          </button>
        </div>

        {/* MESSAGES */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {success}
          </div>
        )}

        {/* SUMMARY */}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Active Users"
            value={activeCount}
          />

          <SummaryCard
            label="Owners / Admins"
            value={
              ownerAdminCount
            }
          />

          <SummaryCard
            label="Operations"
            value={
              operationsCount
            }
          />

          <SummaryCard
            label="Accounting"
            value={
              accountingCount
            }
          />
        </section>

        {/* SEARCH */}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search name, email or role..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-500"
          />
        </section>

        {/* TEAM TABLE */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Company Team
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Owners,
                  administrators and
                  staff accounts.
                </p>
              </div>

              <span className="text-sm text-slate-500">
                {
                  filteredMembers.length
                }{" "}
                member
                {filteredMembers.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <TableHead>
                    Team Member
                  </TableHead>

                  <TableHead>
                    Role
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead>
                    Last Sign In
                  </TableHead>

                  <TableHead>
                    Added
                  </TableHead>

                  <TableHead>
                    Actions
                  </TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Loading team...
                    </td>
                  </tr>
                ) : filteredMembers.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No team members
                      found.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(
                    (member) => {
                      const isSelf =
                        member.userId ===
                        currentUserId;

                      const isOwner =
                        member.role ===
                        "owner";

                      const busy =
                        actionUserId ===
                        member.userId;

                      return (
                        <tr
                          key={
                            member.userId
                          }
                          className="hover:bg-slate-50"
                        >
                          {/* TEAM MEMBER */}

                          <td className="px-6 py-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {
                                  member.fullName
                                }
                              </p>

                              <p className="mt-1 text-sm text-slate-500">
                                {member.email ||
                                  "No email available"}
                              </p>

                              {isSelf && (
                                <p className="mt-1 text-xs font-semibold text-blue-600">
                                  Your
                                  account
                                </p>
                              )}
                            </div>
                          </td>

                          {/* ROLE */}

                          <td className="whitespace-nowrap px-6 py-4">
                            <RoleBadge
                              role={
                                member.role
                              }
                            />
                          </td>

                          {/* STATUS */}

                          <td className="whitespace-nowrap px-6 py-4">
                            {member.isActive ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* LAST SIGN IN */}

                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {formatDateTime(
                              member.lastSignInAt
                            )}
                          </td>

                          {/* ADDED */}

                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {formatDateTime(
                              member.createdAt
                            )}
                          </td>

                          {/* ACTIONS */}

                          <td className="min-w-[260px] px-6 py-4">
                            {isSelf ||
                            isOwner ? (
                              <span className="text-sm font-medium text-slate-400">
                                Protected
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {/* CHANGE ROLE */}

                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    openRoleEditor(
                                      member
                                    )
                                  }
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Change Role
                                </button>

                                {/* DEACTIVATE / REACTIVATE */}

                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    void updateMember(
                                      member,
                                      {
                                        isActive:
                                          !member.isActive,
                                      },
                                      member.isActive
                                        ? `${member.fullName} was deactivated.`
                                        : `${member.fullName} was reactivated.`
                                    )
                                  }
                                  className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                    member.isActive
                                      ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {busy
                                    ? "Working..."
                                    : member.isActive
                                      ? "Deactivate"
                                      : "Reactivate"}
                                </button>

                                {/* DELETE */}

                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    void deleteMember(
                                      member
                                    )
                                  }
                                  className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ==========================================
          INVITE STAFF MODAL
      ========================================== */}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close invite window"
            onClick={() => {
              if (!inviting) {
                setShowInvite(
                  false
                );
              }
            }}
            className="absolute inset-0 bg-black/40"
          />

          <form
            onSubmit={
              handleInvite
            }
            className="relative z-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Invite Staff
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  The staff member
                  will receive an
                  invitation to join
                  your company.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  inviting
                }
                onClick={() =>
                  setShowInvite(
                    false
                  )
                }
                className="text-2xl text-slate-400 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <Field label="Full Name *">
                <input
                  value={
                    form.fullName
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        fullName:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="Jane Smith"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600"
                />
              </Field>

              <Field label="Email *">
                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        email:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  placeholder="jane@company.com"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-blue-600"
                />
              </Field>

              <Field label="Role *">
                <select
                  value={
                    form.role
                  }
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,

                        role:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600"
                >
                  {ROLE_OPTIONS.map(
                    (role) => (
                      <option
                        key={
                          role.value
                        }
                        value={
                          role.value
                        }
                      >
                        {
                          role.label
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>

              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <strong>
                  Driver accounts
                </strong>{" "}
                are created
                separately because
                they must be linked
                to a specific driver
                record.
              </div>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                disabled={
                  inviting
                }
                onClick={() =>
                  setShowInvite(
                    false
                  )
                }
                className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  inviting
                }
                className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting
                  ? "Sending..."
                  : "Send Invitation"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          CHANGE ROLE MODAL
      ========================================== */}

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close role window"
            onClick={() =>
              setEditingMember(
                null
              )
            }
            className="absolute inset-0 bg-black/40"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-950">
              Change Role
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Update access
              permissions for{" "}
              <strong>
                {
                  editingMember.fullName
                }
              </strong>
              .
            </p>

            <div className="mt-6">
              <Field label="Role">
                <select
                  value={
                    selectedRole
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedRole(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600"
                >
                  {ROLE_OPTIONS.map(
                    (role) => (
                      <option
                        key={
                          role.value
                        }
                        value={
                          role.value
                        }
                      >
                        {
                          role.label
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setEditingMember(
                    null
                  )
                }
                className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  actionUserId ===
                  editingMember.userId
                }
                onClick={() =>
                  void updateMember(
                    editingMember,
                    {
                      role:
                        selectedRole,
                    },
                    `${editingMember.fullName}'s role was updated.`
                  )
                }
                className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionUserId ===
                editingMember.userId
                  ? "Saving..."
                  : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================================================
   COMPONENTS
================================================ */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function TableHead({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
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

function RoleBadge({
  role,
}: {
  role: string;
}) {
  const label = role
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );

  let classes =
    "bg-slate-100 text-slate-700";

  if (role === "owner") {
    classes =
      "bg-purple-100 text-purple-700";
  } else if (
    role === "admin"
  ) {
    classes =
      "bg-blue-100 text-blue-700";
  } else if (
    role === "dispatcher"
  ) {
    classes =
      "bg-cyan-100 text-cyan-700";
  } else if (
    role === "fleet_manager"
  ) {
    classes =
      "bg-amber-100 text-amber-700";
  } else if (
    role === "accountant"
  ) {
    classes =
      "bg-emerald-100 text-emerald-700";
  } else if (
    role === "driver"
  ) {
    classes =
      "bg-slate-200 text-slate-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString();
}