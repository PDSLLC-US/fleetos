"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: string;
  company_id: string;
  truck_id: string | null;
  driver_id: string | null;
  load_id: string | null;
  category: string;
  description: string | null;
  amount: number | string;
  expense_date: string | null;
  vendor_name: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TruckOption = {
  id: string;
  truck_number: string;
};

type DriverOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type LoadOption = {
  id: string;
  load_number: string;
};

type ExpenseForm = {
  expense_date: string;
  category: string;
  amount: string;
  vendor_name: string;
  description: string;
  truck_id: string;
  driver_id: string;
  load_id: string;
  notes: string;
};

const CATEGORIES = [
  "Fuel",
  "Maintenance",
  "Tires",
  "Insurance",
  "Tolls",
  "Parking",
  "Permits",
  "Repairs",
  "Dispatch",
  "Factoring",
  "Truck Payment",
  "Trailer Payment",
  "Office/Admin",
  "Other",
];

function todayValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyForm(): ExpenseForm {
  return {
    expense_date: todayValue(),
    category: "Fuel",
    amount: "",
    vendor_name: "",
    description: "",
    truck_id: "",
    driver_id: "",
    load_id: "",
    notes: "",
  };
}

export default function ExpensesPage() {
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loads, setLoads] = useState<LoadOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null);

  const [form, setForm] = useState<ExpenseForm>(emptyForm());

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      /*
       * IMPORTANT:
       * These are four COMPLETELY SEPARATE queries.
       *
       * expense_date is queried ONLY from public.expenses.
       * We do NOT use an embedded loads relationship here.
       */

      const expensesPromise = supabase
        .from("expenses")
        .select(
          `
          id,
          company_id,
          truck_id,
          driver_id,
          load_id,
          category,
          description,
          amount,
          expense_date,
          vendor_name,
          receipt_path,
          notes,
          created_at,
          updated_at
        `
        )
        .order("expense_date", { ascending: false });

      const trucksPromise = supabase
        .from("trucks")
        .select("id, truck_number")
        .order("truck_number", { ascending: true });

      const driversPromise = supabase
        .from("drivers")
        .select("id, first_name, last_name")
        .order("first_name", { ascending: true });

      const loadsPromise = supabase
        .from("loads")
        .select("id, load_number")
        .order("created_at", { ascending: false });

      const [
        expensesResult,
        trucksResult,
        driversResult,
        loadsResult,
      ] = await Promise.all([
        expensesPromise,
        trucksPromise,
        driversPromise,
        loadsPromise,
      ]);

      /*
       * Handle each result independently.
       * This allows a working dropdown to still load even if
       * another table has an unrelated problem.
       */

      if (expensesResult.error) {
        console.error(
          "Expenses query error:",
          expensesResult.error
        );

        setError(
          `Expenses error: ${expensesResult.error.message}`
        );

        setExpenses([]);
      } else {
        setExpenses(
          (expensesResult.data ?? []) as unknown as Expense[]
        );
      }

      if (trucksResult.error) {
        console.error(
          "Trucks dropdown query error:",
          trucksResult.error
        );
        setTrucks([]);
      } else {
        setTrucks(
          (trucksResult.data ?? []) as unknown as TruckOption[]
        );
      }

      if (driversResult.error) {
        console.error(
          "Drivers dropdown query error:",
          driversResult.error
        );
        setDrivers([]);
      } else {
        setDrivers(
          (driversResult.data ?? []) as unknown as DriverOption[]
        );
      }

      if (loadsResult.error) {
        console.error(
          "Loads dropdown query error:",
          loadsResult.error
        );
        setLoads([]);
      } else {
        setLoads(
          (loadsResult.data ?? []) as unknown as LoadOption[]
        );
      }
    } catch (err) {
      console.error("Expenses page load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load expense data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const truckMap = useMemo(() => {
    return new Map(
      trucks.map((truck) => [truck.id, truck.truck_number])
    );
  }, [trucks]);

  const driverMap = useMemo(() => {
    return new Map(
      drivers.map((driver) => {
        const fullName = [
          driver.first_name,
          driver.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

        return [
          driver.id,
          fullName || "Unnamed Driver",
        ];
      })
    );
  }, [drivers]);

  const loadMap = useMemo(() => {
    return new Map(
      loads.map((load) => [load.id, load.load_number])
    );
  }, [loads]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const truckNumber = expense.truck_id
        ? truckMap.get(expense.truck_id) ?? ""
        : "";

      const driverName = expense.driver_id
        ? driverMap.get(expense.driver_id) ?? ""
        : "";

      const loadNumber = expense.load_id
        ? loadMap.get(expense.load_id) ?? ""
        : "";

      const matchesSearch =
        !query ||
        expense.category.toLowerCase().includes(query) ||
        (expense.description ?? "")
          .toLowerCase()
          .includes(query) ||
        (expense.vendor_name ?? "")
          .toLowerCase()
          .includes(query) ||
        truckNumber.toLowerCase().includes(query) ||
        driverName.toLowerCase().includes(query) ||
        loadNumber.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "All" ||
        expense.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [
    expenses,
    search,
    categoryFilter,
    truckMap,
    driverMap,
    loadMap,
  ]);

  const totals = useMemo(() => {
    let total = 0;
    let fuel = 0;
    let maintenance = 0;
    let tolls = 0;
    let other = 0;

    for (const expense of expenses) {
      const amount = Number(expense.amount ?? 0);

      total += amount;

      if (expense.category === "Fuel") {
        fuel += amount;
      } else if (expense.category === "Maintenance") {
        maintenance += amount;
      } else if (expense.category === "Tolls") {
        tolls += amount;
      } else {
        other += amount;
      }
    }

    return {
      total,
      fuel,
      maintenance,
      tolls,
      other,
    };
  }, [expenses]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString();
  }

  function openCreateForm() {
    setEditingExpense(null);
    setForm(emptyForm());
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(expense: Expense) {
    setEditingExpense(expense);

    setForm({
      expense_date: expense.expense_date ?? todayValue(),
      category: expense.category || "Fuel",
      amount: String(expense.amount ?? ""),
      vendor_name: expense.vendor_name ?? "",
      description: expense.description ?? "",
      truck_id: expense.truck_id ?? "",
      driver_id: expense.driver_id ?? "",
      load_id: expense.load_id ?? "",
      notes: expense.notes ?? "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingExpense(null);
    setForm(emptyForm());
  }

  async function getCompanyId() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Auth error:", userError);
      throw userError;
    }

    if (!user) {
      throw new Error("You are not logged in.");
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

    if (profileError) {
      console.error(
        "Profile company lookup error:",
        profileError
      );
      throw profileError;
    }

    if (!profile?.company_id) {
      throw new Error(
        "Your FleetOS profile is not connected to a company."
      );
    }

    return profile.company_id as string;
  }

  async function handleSave(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const amount = Number(form.amount);

    if (!form.expense_date) {
      setError("Expense date is required.");
      return;
    }

    if (!form.category) {
      setError("Category is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSaving(true);

    try {
      if (editingExpense) {
        const { error: updateError } = await supabase
          .from("expenses")
          .update({
            truck_id: form.truck_id || null,
            driver_id: form.driver_id || null,
            load_id: form.load_id || null,
            category: form.category,
            description: form.description.trim() || null,
            amount,
            expense_date: form.expense_date,
            vendor_name: form.vendor_name.trim() || null,
            notes: form.notes.trim() || null,
          })
          .eq("id", editingExpense.id);

        if (updateError) {
          console.error(
            "Expense update error:",
            updateError
          );
          throw updateError;
        }

        setSuccess("Expense updated successfully.");
      } else {
        const companyId = await getCompanyId();

        const { error: insertError } = await supabase
          .from("expenses")
          .insert({
            company_id: companyId,
            truck_id: form.truck_id || null,
            driver_id: form.driver_id || null,
            load_id: form.load_id || null,
            category: form.category,
            description: form.description.trim() || null,
            amount,
            expense_date: form.expense_date,
            vendor_name: form.vendor_name.trim() || null,
            receipt_path: null,
            notes: form.notes.trim() || null,
          });

        if (insertError) {
          console.error(
            "Expense insert error:",
            insertError
          );
          throw insertError;
        }

        setSuccess("Expense created successfully.");
      }

      setShowForm(false);
      setEditingExpense(null);
      setForm(emptyForm());

      await loadData();
    } catch (err) {
      console.error("Expense save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save expense."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);

      if (deleteError) {
        console.error(
          "Expense delete error:",
          deleteError
        );
        throw deleteError;
      }

      setSuccess("Expense deleted successfully.");

      await loadData();
    } catch (err) {
      console.error("Expense delete error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete expense."
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-600">
            Loading expenses...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">
              FleetOS
            </p>

            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              Expenses
            </h1>

            <p className="mt-2 text-slate-600">
              Track fleet operating costs, vendors,
              equipment and load-related expenses.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search category, vendor, truck..."
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            />

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="All">All</option>

              {CATEGORIES.map((category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
            >
              + Add Expense
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-green-700">
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label="Total Expenses"
            value={formatCurrency(totals.total)}
          />

          <SummaryCard
            label="Fuel"
            value={formatCurrency(totals.fuel)}
          />

          <SummaryCard
            label="Maintenance"
            value={formatCurrency(totals.maintenance)}
          />

          <SummaryCard
            label="Tolls"
            value={formatCurrency(totals.tolls)}
          />

          <SummaryCard
            label="Other"
            value={formatCurrency(totals.other)}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-950">
              Expenses
            </h2>

            <span className="text-sm text-slate-500">
              {filteredExpenses.length} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Vendor</TableHeader>
                  <TableHeader>Truck</TableHeader>
                  <TableHeader>Driver</TableHeader>
                  <TableHeader>Load</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No expenses found. Add your first
                      expense to get started.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-slate-50"
                    >
                      <TableCell>
                        {formatDate(expense.expense_date)}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {expense.category}
                        </span>
                      </TableCell>

                      <TableCell>
                        {expense.description || "—"}
                      </TableCell>

                      <TableCell>
                        {expense.vendor_name || "—"}
                      </TableCell>

                      <TableCell>
                        {expense.truck_id
                          ? truckMap.get(expense.truck_id) ??
                            "—"
                          : "—"}
                      </TableCell>

                      <TableCell>
                        {expense.driver_id
                          ? driverMap.get(expense.driver_id) ??
                            "—"
                          : "—"}
                      </TableCell>

                      <TableCell>
                        {expense.load_id
                          ? loadMap.get(expense.load_id) ?? "—"
                          : "—"}
                      </TableCell>

                      <TableCell>
                        <span className="font-semibold text-slate-950">
                          {formatCurrency(
                            Number(expense.amount ?? 0)
                          )}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(expense)
                            }
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(expense)
                            }
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-7 py-5">
              <h2 className="text-2xl font-bold text-slate-950">
                {editingExpense
                  ? "Edit Expense"
                  : "Add Expense"}
              </h2>

              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                className="text-slate-500 hover:text-slate-950"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-5 p-7"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Expense Date">
                  <input
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        expense_date: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </Field>

                <Field label="Category *">
                  <select
                    required
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    {CATEGORIES.map((category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Amount *">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </Field>

                <Field label="Vendor">
                  <input
                    type="text"
                    value={form.vendor_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vendor_name: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Description">
                <input
                  type="text"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="input"
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Truck">
                  <select
                    value={form.truck_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        truck_id: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">None</option>

                    {trucks.map((truck) => (
                      <option
                        key={truck.id}
                        value={truck.id}
                      >
                        {truck.truck_number}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Driver">
                  <select
                    value={form.driver_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        driver_id: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">None</option>

                    {drivers.map((driver) => {
                      const name = [
                        driver.first_name,
                        driver.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")
                        .trim();

                      return (
                        <option
                          key={driver.id}
                          value={driver.id}
                        >
                          {name || "Unnamed Driver"}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field label="Load">
                  <select
                    value={form.load_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        load_id: event.target.value,
                      }))
                    }
                    className="input"
                  >
                    <option value="">None</option>

                    {loads.map((load) => (
                      <option
                        key={load.id}
                        value={load.id}
                      >
                        {load.load_number}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="input resize-y"
                />
              </Field>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingExpense
                      ? "Save Changes"
                      : "Create Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.75rem;
          padding: 0.75rem 0.9rem;
          background: white;
          color: rgb(15 23 42);
          outline: none;
        }

        .input:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 1px rgb(59 130 246);
        }
      `}</style>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="whitespace-nowrap px-5 py-4 text-left text-sm font-semibold text-slate-600">
      {children}
    </th>
  );
}

function TableCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
      {children}
    </td>
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
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}