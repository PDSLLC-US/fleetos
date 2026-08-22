"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LoadOption = {
  id: string;
  load_number: string;
  linehaul?: number | null;
  detention?: number | null;
  layover?: number | null;
  lumper?: number | null;
  other_charges?: number | null;
  status?: string | null;
  driver_id?: string | null;
};

type DriverOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type BrokerOption = {
  id: string;
  company_name: string;
  payment_terms_days?: number | null;
};

type Invoice = {
  id: string;
  company_id?: string | null;
  load_id?: string | null;
  broker_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  amount: number;
  paid_amount: number;
  status: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  loads?: { load_number?: string } | null;
  brokers?: {
    company_name?: string;
    payment_terms_days?: number | null;
  } | null;
};

type Payment = {
  id: string;
  company_id?: string | null;
  invoice_id: string;
  payment_date?: string | null;
  amount: number;
  payment_method?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  created_at?: string;
};

const STATUS_OPTIONS = [
  "All",
  "draft",
  "invoiced",
  "due",
  "overdue",
  "partially_paid",
  "paid",
  "cancelled",
];

function todayLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyStatus(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function InvoicesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loads, setLoads] = useState<LoadOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [showPayment, setShowPayment] = useState<Invoice | null>(null);
  const [showDetails, setShowDetails] = useState<Invoice | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loadId, setLoadId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayLocalDate());
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [status, setStatus] = useState<string>("draft");
  const [notes, setNotes] = useState("");

  const [paymentDate, setPaymentDate] = useState(todayLocalDate());
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("ACH");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [iRes, pRes, lRes, dRes, bRes] = await Promise.all([
        supabase
          .from("invoices")
          .select(`
            *,
            loads (
              load_number
            ),
            brokers (
              company_name,
              payment_terms_days
            )
          `)
          .order("invoice_date", { ascending: false }),

        supabase.from("payments").select("*"),

        supabase
          .from("loads")
          .select(`
            id,
            load_number,
            linehaul,
            detention,
            layover,
            lumper,
            other_charges,
            status,
            driver_id
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("drivers")
          .select("id, first_name, last_name")
          .order("first_name", { ascending: true }),

        supabase
          .from("brokers")
          .select(`
            id,
            company_name,
            payment_terms_days
          `)
          .order("company_name"),
      ]);

      if (iRes.error) throw iRes.error;
      if (pRes.error) throw pRes.error;
      if (lRes.error) throw lRes.error;
      if (dRes.error) throw dRes.error;
      if (bRes.error) throw bRes.error;

      setInvoices((iRes.data as unknown as Invoice[]) || []);
      setPayments((pRes.data as unknown as Payment[]) || []);
      setLoads((lRes.data as unknown as LoadOption[]) || []);
      setDrivers((dRes.data as unknown as DriverOption[]) || []);
      setBrokers((bRes.data as unknown as BrokerOption[]) || []);
    } catch (err: unknown) {
      console.error("Error loading invoices data", err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  }

  function money(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  }

  function balanceOf(invoice: Invoice) {
    return Number(invoice.amount || 0) - Number(invoice.paid_amount || 0);
  }

  const driverMap = useMemo(() => {
    return new Map(
      drivers.map((driver) => {
        const fullName = [driver.first_name, driver.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        return [driver.id, fullName || "Unnamed Driver"];
      })
    );
  }, [drivers]);

  const billedLoadIds = useMemo(() => {
    return new Set(
      invoices
        .filter((invoice) => invoice.status !== "cancelled")
        .map((invoice) => invoice.load_id)
        .filter((id): id is string => Boolean(id))
    );
  }, [invoices]);

  const billingReadyLoads = useMemo(() => {
    return loads.filter((load) => {
      if (editing?.load_id === load.id) {
        return true;
      }

      return (
        load.status === "pod_received" &&
        !billedLoadIds.has(load.id)
      );
    });
  }, [loads, billedLoadIds, editing]);

  const summaries = useMemo(() => {
    const summary = {
      totalInvoiced: 0,
      outstanding: 0,
      overdue: 0,
      paid: 0,
      partialCount: 0,
    };

    const today = new Date();

    invoices.forEach((invoice) => {
      if (invoice.status === "cancelled") return;

      summary.totalInvoiced += Number(invoice.amount || 0);
      summary.paid += Number(invoice.paid_amount || 0);

      const balance = balanceOf(invoice);
      summary.outstanding += Math.max(balance, 0);

      if (invoice.status === "partially_paid") {
        summary.partialCount += 1;
      }

      if (balance > 0 && invoice.due_date) {
        const due = new Date(`${invoice.due_date}T00:00:00`);

        if (due < today) {
          summary.overdue += Math.max(balance, 0);
        }
      }
    });

    return summary;
  }, [invoices]);

  const filtered = invoices.filter((invoice) => {
    if (
      statusFilter !== "All" &&
      invoice.status !== statusFilter
    ) {
      return false;
    }

    const query = search.trim().toLowerCase();

    if (!query) return true;

    const loadNumber = invoice.loads?.load_number || "";
    const brokerName = invoice.brokers?.company_name || "";

    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      loadNumber.toLowerCase().includes(query) ||
      brokerName.toLowerCase().includes(query)
    );
  });

  function suggestedAmountForLoad(id?: string) {
    if (!id) return 0;

    const load = loads.find((item) => item.id === id);

    if (!load) return 0;

    return (
      Number(load.linehaul || 0) +
      Number(load.detention || 0) +
      Number(load.layover || 0) +
      Number(load.lumper || 0) +
      Number(load.other_charges || 0)
    );
  }

  function suggestDueDate(
    selectedInvoiceDate?: string,
    selectedBrokerId?: string
  ) {
    if (!selectedInvoiceDate || !selectedBrokerId) return "";

    const broker = brokers.find(
      (item) => item.id === selectedBrokerId
    );

    const terms = broker?.payment_terms_days;

    if (terms === null || terms === undefined) {
      return "";
    }

    try {
      const date = new Date(`${selectedInvoiceDate}T00:00:00`);
      date.setDate(date.getDate() + Number(terms || 0));

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  }

  function loadOptionLabel(load: LoadOption) {
    const driverName = load.driver_id
      ? driverMap.get(load.driver_id) ?? "Unknown Driver"
      : "Unassigned";

    return `Load #${load.load_number} — ${prettyStatus(
      load.status
    )} — ${driverName}`;
  }

  function openCreate(edit?: Invoice) {
    setError(null);
    setSuccess(null);

    if (!edit) {
      setEditing(null);

      setInvoiceNumber("");
      setLoadId("");
      setBrokerId("");
      setInvoiceDate(todayLocalDate());
      setDueDate("");
      setAmount("");
      setStatus("invoiced");
      setNotes("");

      setShowForm(true);
      return;
    }

    setEditing(edit);

    setInvoiceNumber(edit.invoice_number);
    setLoadId(edit.load_id || "");
    setBrokerId(edit.broker_id || "");

    setInvoiceDate(
      edit.invoice_date
        ? edit.invoice_date.substring(0, 10)
        : todayLocalDate()
    );

    setDueDate(
      edit.due_date
        ? edit.due_date.substring(0, 10)
        : ""
    );

    setAmount(String(edit.amount || 0));
    setStatus(edit.status || "draft");
    setNotes(edit.notes || "");

    setShowForm(true);
  }

  useEffect(() => {
    if (!editing) return;

    if (!invoiceDate && editing.invoice_date) {
      setInvoiceDate(
        editing.invoice_date.substring(0, 10)
      );
    }
  }, [editing, invoiceDate]);

  useEffect(() => {
    if (!editing && loadId && !amount) {
      const suggested = suggestedAmountForLoad(loadId);

      if (suggested > 0) {
        setAmount(String(suggested));
      }
    }

    if (invoiceDate && brokerId) {
      const suggestedDate = suggestDueDate(
        invoiceDate,
        brokerId
      );

      if (suggestedDate) {
        setDueDate(suggestedDate);
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId, invoiceDate, brokerId]);

  async function submitInvoice(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    try {
      if (!invoiceNumber.trim()) {
        setError("Invoice number is required");
        return;
      }

      if (!invoiceDate) {
        setError("Invoice date is required");
        return;
      }

      if (!loadId) {
        setError("Please select a load.");
        return;
      }

      const selectedLoad = loads.find(
        (item) => item.id === loadId
      );

      if (
        !editing &&
        selectedLoad?.status !== "pod_received"
      ) {
        setError(
          "New invoices can only be created for loads with POD Received status."
        );
        return;
      }

      if (
        !editing &&
        billedLoadIds.has(loadId)
      ) {
        setError(
          "This load already has an active invoice."
        );
        return;
      }

      const parsedAmount = Number(amount) || 0;

      if (parsedAmount <= 0) {
        setError(
          "Invoice amount must be greater than 0"
        );
        return;
      }

      const userResult =
        await supabase.auth.getUser();

      if (userResult.error) {
        throw userResult.error;
      }

      const userId = userResult.data.user?.id;

      if (!userId) {
        throw new Error("You must be logged in.");
      }

      const profileResult =
        await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", userId)
          .maybeSingle();

      if (profileResult.error) {
        throw profileResult.error;
      }

      const companyId =
        profileResult.data?.company_id;

      if (!companyId) {
        throw new Error(
          "Your FleetOS account is not connected to a company."
        );
      }

      const payload = {
        invoice_number: invoiceNumber.trim(),
        load_id: loadId,
        broker_id: brokerId || null,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        amount: parsedAmount,
        status: status || "invoiced",
        notes: notes.trim() || null,
      };

      if (editing) {
        const result = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editing.id);

        if (result.error) {
          throw result.error;
        }

        setSuccess("Invoice updated");
      } else {
        const result = await supabase
          .from("invoices")
          .insert({
            ...payload,
            company_id: companyId,
            paid_amount: 0,
          })
          .select();

        if (result.error) {
          throw result.error;
        }

        setSuccess(
          "Invoice created. Linked load moved into the invoiced workflow."
        );
      }

      setShowForm(false);

      await loadAll();

      setTimeout(
        () => setSuccess(null),
        3000
      );
    } catch (err: unknown) {
      console.error("Error saving invoice", err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  async function cancelInvoice(
    invoice: Invoice
  ) {
    if (
      !window.confirm(
        "Are you sure you want to cancel this invoice?"
      )
    ) {
      return;
    }

    try {
      const result = await supabase
        .from("invoices")
        .update({
          status: "cancelled",
        })
        .eq("id", invoice.id);

      if (result.error) {
        throw result.error;
      }

      setSuccess("Invoice cancelled");

      await loadAll();

      setTimeout(
        () => setSuccess(null),
        3000
      );
    } catch (err: unknown) {
      console.error(
        "Error cancelling invoice",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  async function openPayment(
    invoice: Invoice
  ) {
    setError(null);
    setSuccess(null);

    setShowPayment(invoice);
    setPaymentDate(todayLocalDate());

    setPaymentAmount(
      String(
        Math.max(
          0,
          balanceOf(invoice)
        )
      )
    );

    setPaymentMethod("ACH");
    setPaymentRef("");
    setPaymentNotes("");
  }

  async function submitPayment(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!showPayment) return;

    setError(null);
    setSuccess(null);

    try {
      if (!paymentDate) {
        setError(
          "Payment date is required"
        );
        return;
      }

      const payment = Number(paymentAmount) || 0;

      if (payment <= 0) {
        setError(
          "Payment amount must be greater than 0"
        );
        return;
      }

      const balance = balanceOf(showPayment);

      if (payment > balance) {
        setError(
          "Payment exceeds remaining balance"
        );
        return;
      }

      const userResult =
        await supabase.auth.getUser();

      if (userResult.error) {
        throw userResult.error;
      }

      const userId = userResult.data.user?.id;

      if (!userId) {
        throw new Error("You must be logged in.");
      }

      const profileResult =
        await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", userId)
          .maybeSingle();

      if (profileResult.error) {
        throw profileResult.error;
      }

      const companyId =
        profileResult.data?.company_id;

      if (!companyId) {
        throw new Error(
          "Your FleetOS account is not connected to a company."
        );
      }

      const paymentResult =
        await supabase
          .from("payments")
          .insert({
            company_id: companyId,
            invoice_id: showPayment.id,
            payment_date: paymentDate,
            amount: payment,
            payment_method: paymentMethod,
            reference_number:
              paymentRef.trim() || null,
            notes:
              paymentNotes.trim() || null,
          })
          .select();

      if (paymentResult.error) {
        throw paymentResult.error;
      }

      const newPaid =
        Number(showPayment.paid_amount || 0) + payment;

      const invoiceAmount =
        Number(showPayment.amount || 0);

      const newStatus =
        newPaid >= invoiceAmount
          ? "paid"
          : newPaid > 0
            ? "partially_paid"
            : showPayment.status;

      const invoiceResult =
        await supabase
          .from("invoices")
          .update({
            paid_amount: newPaid,
            status: newStatus,
          })
          .eq("id", showPayment.id);

      if (invoiceResult.error) {
        throw invoiceResult.error;
      }

      setSuccess(
        newStatus === "paid"
          ? "Payment recorded. Invoice and linked load are now paid."
          : "Payment recorded."
      );

      setShowPayment(null);

      await loadAll();

      setTimeout(
        () => setSuccess(null),
        3000
      );
    } catch (err: unknown) {
      console.error(
        "Error recording payment",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  async function viewDetails(
    invoice: Invoice
  ) {
    setShowDetails(invoice);

    try {
      const result = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("payment_date", {
          ascending: false,
        });

      if (result.error) {
        throw result.error;
      }

      setPayments((previous) => {
        const other = previous.filter(
          (payment) =>
            payment.invoice_id !==
            invoice.id
        );

        return [
          ...other,
          ...((result.data as unknown as Payment[]) || []),
        ];
      });
    } catch (err: unknown) {
      console.error(
        "Error loading payments",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] text-blue-600">
              FLEETOS
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Invoices
            </h1>

            <p className="mt-2 text-slate-500">
              Manage billing, receivables, broker payments and outstanding balances.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search invoice, load, broker"
              className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm sm:block"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => openCreate()}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              + Create Invoice
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label="Total Invoiced"
            value={money(summaries.totalInvoiced)}
          />

          <SummaryCard
            label="Outstanding"
            value={money(summaries.outstanding)}
          />

          <SummaryCard
            label="Overdue"
            value={money(summaries.overdue)}
          />

          <SummaryCard
            label="Paid"
            value={money(summaries.paid)}
          />

          <SummaryCard
            label="Ready to Invoice"
            value={String(
              loads.filter(
                (load) =>
                  load.status === "pod_received" &&
                  !billedLoadIds.has(load.id)
              ).length
            )}
          />
        </div>

        <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-blue-950">
                Billing Queue
              </p>

              <p className="mt-1 text-sm text-blue-800">
                {billingReadyLoads.length === 0
                  ? "No POD-received loads are waiting for an invoice."
                  : `${billingReadyLoads.length} load${
                      billingReadyLoads.length === 1 ? "" : "s"
                    } ready for billing.`}
              </p>
            </div>

            {billingReadyLoads.length > 0 && (
              <button
                type="button"
                onClick={() => openCreate()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create Invoice
              </button>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Invoices
            </h2>

            <div className="text-sm text-slate-500">
              {loading
                ? "Loading..."
                : `${filtered.length} items`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Load</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filtered.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-slate-500"
                    >
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((invoice) => {
                    const balance = balanceOf(invoice);

                    const isOverdue =
                      invoice.status !== "paid" &&
                      invoice.status !== "cancelled" &&
                      Boolean(invoice.due_date) &&
                      new Date(`${invoice.due_date}T00:00:00`) <
                        new Date() &&
                      balance > 0;

                    return (
                      <tr
                        key={invoice.id}
                        className="hover:bg-slate-50"
                      >
                        <TableData className="font-medium">
                          {invoice.invoice_number}
                        </TableData>

                        <TableData>
                          {invoice.loads?.load_number || "—"}
                        </TableData>

                        <TableData>
                          {invoice.brokers?.company_name || "—"}
                        </TableData>

                        <TableData>
                          {invoice.invoice_date
                            ? new Date(
                                `${invoice.invoice_date}T00:00:00`
                              ).toLocaleDateString()
                            : "—"}
                        </TableData>

                        <TableData>
                          {invoice.due_date
                            ? new Date(
                                `${invoice.due_date}T00:00:00`
                              ).toLocaleDateString()
                            : "—"}
                        </TableData>

                        <TableData className="font-semibold text-slate-900">
                          {money(Number(invoice.amount || 0))}
                        </TableData>

                        <TableData>
                          {money(
                            Number(invoice.paid_amount || 0)
                          )}
                        </TableData>

                        <TableData
                          className={`font-semibold ${
                            isOverdue
                              ? "text-rose-600"
                              : "text-slate-900"
                          }`}
                        >
                          {money(balance)}
                        </TableData>

                        <TableData>
                          <StatusBadge
                            status={
                              isOverdue
                                ? "overdue"
                                : invoice.status
                            }
                          />
                        </TableData>

                        <TableData>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openCreate(invoice)
                              }
                              className="rounded-2xl bg-slate-100 px-3 py-1 text-sm"
                            >
                              Edit
                            </button>

                            {invoice.status !== "cancelled" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void cancelInvoice(invoice)
                                }
                                className="rounded-2xl bg-rose-50 px-3 py-1 text-sm text-rose-600"
                              >
                                Cancel
                              </button>
                            )}

                            {balance > 0 &&
                              invoice.status !== "cancelled" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void openPayment(invoice)
                                  }
                                  className="rounded-2xl bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
                                >
                                  Record Payment
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() =>
                                void viewDetails(invoice)
                              }
                              className="rounded-2xl bg-slate-50 px-3 py-1 text-sm"
                            >
                              View
                            </button>
                          </div>
                        </TableData>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <ModalBackdrop onClose={() => setShowForm(false)}>
          <form
            onSubmit={submitInvoice}
            className="relative z-50 mx-4 mt-10 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg"
          >
            <ModalHeader
              title={editing ? "Edit Invoice" : "Create Invoice"}
              onClose={() => setShowForm(false)}
            />

            {!editing && (
              <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="font-semibold text-blue-950">
                  Ready-to-Invoice Loads Only
                </p>

                <p className="mt-1 text-sm text-blue-800">
                  FleetOS only lists loads with POD Received status that do not already have an active invoice.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Invoice Number *">
                <input
                  required
                  value={invoiceNumber}
                  onChange={(event) =>
                    setInvoiceNumber(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <Field label="Load *">
                <select
                  required
                  value={loadId}
                  onChange={(event) => {
                    const nextLoadId = event.target.value;
                    setLoadId(nextLoadId);

                    if (!editing) {
                      const suggested =
                        suggestedAmountForLoad(nextLoadId);

                      if (suggested > 0) {
                        setAmount(String(suggested));
                      }
                    }
                  }}
                  className="form-input"
                >
                  <option value="">
                    Select a billing-ready load
                  </option>

                  {billingReadyLoads.map((load) => (
                    <option
                      key={load.id}
                      value={load.id}
                    >
                      {loadOptionLabel(load)}
                    </option>
                  ))}
                </select>

                {!editing && billingReadyLoads.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    No POD-received loads are currently waiting for billing.
                  </p>
                )}
              </Field>

              <Field label="Broker">
                <select
                  value={brokerId}
                  onChange={(event) =>
                    setBrokerId(event.target.value)
                  }
                  className="form-input"
                >
                  <option value="">None</option>

                  {brokers.map((broker) => (
                    <option
                      key={broker.id}
                      value={broker.id}
                    >
                      {broker.company_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Invoice Date *">
                <input
                  required
                  type="date"
                  value={invoiceDate}
                  onChange={(event) =>
                    setInvoiceDate(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <Field label="Due Date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <Field label="Amount *">
                <input
                  required
                  min="0.01"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <Field label="Status">
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                  className="form-input"
                >
                  <option value="draft">draft</option>
                  <option value="invoiced">invoiced</option>
                  <option value="due">due</option>
                  <option value="overdue">overdue</option>
                  <option value="partially_paid">
                    partially_paid
                  </option>
                  <option value="paid">paid</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    className="form-input"
                    rows={3}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2 space-y-1 text-sm text-slate-500">
                {loadId && (
                  <div>
                    Suggested Amount from load:{" "}
                    <strong>
                      {money(
                        suggestedAmountForLoad(loadId)
                      )}
                    </strong>
                  </div>
                )}

                {brokerId && invoiceDate && (
                  <div>
                    Suggested Due Date from broker terms:{" "}
                    <strong>
                      {suggestDueDate(
                        invoiceDate,
                        brokerId
                      ) || "—"}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!editing && billingReadyLoads.length === 0}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editing ? "Update Invoice" : "Create Invoice"}
              </button>
            </div>
          </form>
        </ModalBackdrop>
      )}

      {showPayment && (
        <ModalBackdrop onClose={() => setShowPayment(null)}>
          <form
            onSubmit={submitPayment}
            className="relative z-50 mx-4 mt-10 w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg"
          >
            <ModalHeader
              title={`Record Payment for ${showPayment.invoice_number}`}
              onClose={() => setShowPayment(null)}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment Date *">
                <input
                  required
                  type="date"
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <Field label="Amount *">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <Field label="Method">
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value)
                  }
                  className="form-input"
                >
                  {[
                    "ACH",
                    "Zelle",
                    "Check",
                    "Wire",
                    "Cash",
                    "Credit Card",
                    "Factoring",
                    "Other",
                  ].map((method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {method}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reference #">
                <input
                  value={paymentRef}
                  onChange={(event) =>
                    setPaymentRef(event.target.value)
                  }
                  className="form-input"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={paymentNotes}
                    onChange={(event) =>
                      setPaymentNotes(event.target.value)
                    }
                    className="form-input"
                    rows={2}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPayment(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-white"
              >
                Record Payment
              </button>
            </div>
          </form>
        </ModalBackdrop>
      )}

      {showDetails && (
        <ModalBackdrop onClose={() => setShowDetails(null)}>
          <div className="relative z-50 mx-4 mt-10 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
            <ModalHeader
              title={`Invoice ${showDetails.invoice_number}`}
              onClose={() => setShowDetails(null)}
            />

            <div className="mb-4 text-sm text-slate-700">
              <div>
                Load: {showDetails.loads?.load_number || "—"}
              </div>

              <div>
                Broker: {showDetails.brokers?.company_name || "—"}
              </div>

              <div>
                Invoice Date:{" "}
                {showDetails.invoice_date
                  ? new Date(
                      `${showDetails.invoice_date}T00:00:00`
                    ).toLocaleDateString()
                  : "—"}
              </div>

              <div>
                Due Date:{" "}
                {showDetails.due_date
                  ? new Date(
                      `${showDetails.due_date}T00:00:00`
                    ).toLocaleDateString()
                  : "—"}
              </div>

              <div className="mt-2">
                Notes: {showDetails.notes || "—"}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold">
                Payments
              </h4>

              <div className="mt-2 overflow-x-auto">
                {payments.filter(
                  (payment) =>
                    payment.invoice_id === showDetails.id
                ).length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No payments yet
                  </div>
                ) : (
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Notes</TableHead>
                      </tr>
                    </thead>

                    <tbody className="text-slate-700">
                      {payments
                        .filter(
                          (payment) =>
                            payment.invoice_id ===
                            showDetails.id
                        )
                        .map((payment) => (
                          <tr
                            key={payment.id}
                            className="border-t border-slate-100"
                          >
                            <TableData>
                              {payment.payment_date
                                ? new Date(
                                    `${payment.payment_date}T00:00:00`
                                  ).toLocaleDateString()
                                : "—"}
                            </TableData>

                            <TableData>
                              {money(
                                Number(payment.amount || 0)
                              )}
                            </TableData>

                            <TableData>
                              {payment.payment_method || "—"}
                            </TableData>

                            <TableData>
                              {payment.reference_number || "—"}
                            </TableData>

                            <TableData>
                              {payment.notes || "—"}
                            </TableData>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetails(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.75rem;
          padding: 0.6rem 1rem;
          background: white;
          color: rgb(15 23 42);
          outline: none;
        }

        .form-input:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 1px rgb(59 130 246);
        }
      `}</style>
    </div>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
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
    <th className="whitespace-nowrap py-3 pr-6">
      {children}
    </th>
  );
}

function TableData({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap py-4 pr-6 ${className}`}
    >
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
    <div>
      <label className="mb-1 block text-sm text-slate-600">
        {label}
      </label>

      {children}
    </div>
  );
}

function ModalHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-semibold text-slate-900">
        {title}
      </h3>

      <button
        type="button"
        onClick={onClose}
        className="text-sm text-slate-500"
      >
        Close
      </button>
    </div>
  );
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />

      {children}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (status === "paid") {
    classes =
      "bg-emerald-100 text-emerald-700";
  } else if (status === "invoiced") {
    classes =
      "bg-sky-100 text-sky-700";
  } else if (status === "due") {
    classes =
      "bg-amber-100 text-amber-700";
  } else if (status === "overdue") {
    classes =
      "bg-rose-50 text-rose-600";
  } else if (status === "partially_paid") {
    classes =
      "bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}