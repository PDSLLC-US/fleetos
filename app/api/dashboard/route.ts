import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CompanyRole =
  | "owner"
  | "admin"
  | "dispatcher"
  | "accountant"
  | "fleet_manager"
  | "driver";

type BrokerRelation =
  | { company_name: string | null }
  | { company_name: string | null }[]
  | null;

type DriverRelation =
  | {
      first_name: string | null;
      last_name: string | null;
    }
  | {
      first_name: string | null;
      last_name: string | null;
    }[]
  | null;

type TruckRelation =
  | { truck_number: string | null }
  | { truck_number: string | null }[]
  | null;

type TruckRow = {
  id: string;
  truck_number: string | null;
  status: string | null;
};

type LoadRow = {
  id: string;
  load_number: string | null;
  truck_id: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_date: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_date: string | null;
  linehaul: number | string | null;
  detention: number | string | null;
  layover: number | string | null;
  lumper: number | string | null;
  other_charges: number | string | null;
  status: string | null;
  created_at: string | null;
  brokers: BrokerRelation;
  drivers: DriverRelation;
  trucks: TruckRelation;
};

type ExpenseRow = {
  truck_id: string | null;
  amount: number | string | null;
};

type SettlementRow = {
  net_pay: number | string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: number | string | null;
  paid_amount: number | string | null;
  status: string;
  brokers: BrokerRelation;
};

type QueryResult<T> = {
  data: T | null;
  error: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry<T>(
  label: string,
  queryFactory: () => PromiseLike<QueryResult<T>>,
  attempts = 2
): Promise<QueryResult<T>> {
  let lastResult: QueryResult<T> = {
    data: null,
    error: new Error(`${label} failed`),
  };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await queryFactory();
      lastResult = result;

      if (!result.error) {
        return result;
      }

      console.error(
        `Dashboard ${label} query failed (attempt ${attempt}/${attempts}):`,
        result.error
      );
    } catch (error) {
      lastResult = {
        data: null,
        error,
      };

      console.error(
        `Dashboard ${label} query threw (attempt ${attempt}/${attempts}):`,
        error
      );
    }

    if (attempt < attempts) {
      await sleep(350);
    }
  }

  return lastResult;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPlace(
  city: string | null | undefined,
  state: string | null | undefined
) {
  const c = city ?? "";
  const s = state ?? "";

  if (!c && !s) return "—";
  if (c && s) return `${c}, ${s}`;

  return c || s;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const membershipResult = await runWithRetry(
      "membership",
      () =>
        supabase
          .from("company_members")
          .select("role,is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle()
    );

    if (membershipResult.error || !membershipResult.data) {
      return NextResponse.json(
        { error: "Unable to determine company role" },
        { status: 403 }
      );
    }

    const role = (membershipResult.data as { role: CompanyRole }).role;

    if (role === "driver") {
      return NextResponse.json(
        { error: "Driver dashboard is separate" },
        { status: 403 }
      );
    }

    const canReadFleet =
      role === "owner" ||
      role === "admin" ||
      role === "dispatcher" ||
      role === "fleet_manager";

    const canReadFinance =
      role === "owner" ||
      role === "admin" ||
      role === "accountant";

    const canReadLoads =
      role === "owner" ||
      role === "admin" ||
      role === "dispatcher" ||
      role === "fleet_manager";

    const trucksPromise = canReadFleet
      ? runWithRetry<TruckRow[]>("trucks", () =>
          supabase
            .from("trucks")
            .select("id,truck_number,status")
        )
      : Promise.resolve({
          data: [] as TruckRow[],
          error: null,
        });

    const loadsPromise = canReadLoads
      ? runWithRetry<LoadRow[]>("loads", () =>
          supabase
            .from("loads")
            .select(`
              id,
              load_number,
              truck_id,
              pickup_city,
              pickup_state,
              pickup_date,
              delivery_city,
              delivery_state,
              delivery_date,
              linehaul,
              detention,
              layover,
              lumper,
              other_charges,
              status,
              created_at,
              brokers (
                company_name
              ),
              drivers (
                first_name,
                last_name
              ),
              trucks (
                truck_number
              )
            `)
            .order("created_at", { ascending: false })
        )
      : Promise.resolve({
          data: [] as LoadRow[],
          error: null,
        });

    const expensesPromise = canReadFinance
      ? runWithRetry<ExpenseRow[]>("expenses", () =>
          supabase
            .from("expenses")
            .select("truck_id,amount")
        )
      : Promise.resolve({
          data: [] as ExpenseRow[],
          error: null,
        });

    const settlementsPromise = canReadFinance
      ? runWithRetry<SettlementRow[]>("settlements", () =>
          supabase
            .from("driver_settlements")
            .select("net_pay")
            .in("status", ["approved", "paid"])
        )
      : Promise.resolve({
          data: [] as SettlementRow[],
          error: null,
        });

    const invoicesPromise = canReadFinance
      ? runWithRetry<InvoiceRow[]>("invoices", () =>
          supabase
            .from("invoices")
            .select(`
              id,
              invoice_number,
              invoice_date,
              due_date,
              amount,
              paid_amount,
              status,
              brokers (
                company_name
              )
            `)
            .neq("status", "cancelled")
            .order("invoice_date", { ascending: false })
        )
      : Promise.resolve({
          data: [] as InvoiceRow[],
          error: null,
        });

    const [
      trucksResult,
      loadsResult,
      expensesResult,
      settlementsResult,
      invoicesResult,
    ] = await Promise.all([
      trucksPromise,
      loadsPromise,
      expensesPromise,
      settlementsPromise,
      invoicesPromise,
    ]);

    const degradedSources: string[] = [];

    if (trucksResult.error) degradedSources.push("trucks");
    if (loadsResult.error) degradedSources.push("loads");
    if (expensesResult.error) degradedSources.push("expenses");
    if (settlementsResult.error) degradedSources.push("settlements");
    if (invoicesResult.error) degradedSources.push("invoices");

    /*
     * Important:
     * Do not crash the entire dashboard just because one non-auth query
     * temporarily failed. Use the data that did succeed and expose a
     * lightweight degraded flag instead.
     */
    const trucks = trucksResult.data ?? [];
    const loads = loadsResult.data ?? [];
    const expenses = expensesResult.data ?? [];
    const settlements = settlementsResult.data ?? [];
    const invoices = invoicesResult.data ?? [];

    // --------------------------------------------------------
    // TRUCK COUNTS
    // --------------------------------------------------------

    const activeTrucks = trucks.filter(
      (truck) => truck.status === "active"
    ).length;

    const availableTrucks = trucks.filter(
      (truck) => truck.status === "available"
    ).length;

    const maintenanceTrucks = trucks.filter(
      (truck) => truck.status === "maintenance"
    ).length;

    const inactiveTrucks = trucks.filter(
      (truck) => truck.status === "inactive"
    ).length;

    // --------------------------------------------------------
    // LOAD COUNTS
    // --------------------------------------------------------

    const activeLoadStatuses = new Set([
      "booked",
      "dispatched",
      "picked_up",
      "in_transit",
    ]);

    const deliveredLoadStatuses = new Set([
      "delivered",
      "pod_received",
      "invoiced",
      "paid",
    ]);

    const activeLoads = loads.filter(
      (load) => load.status && activeLoadStatuses.has(load.status)
    ).length;

    const deliveredLoads = loads.filter(
      (load) => load.status && deliveredLoadStatuses.has(load.status)
    ).length;

    const awaitingPod = loads.filter(
      (load) => load.status === "delivered"
    ).length;

    const invoicedLoads = loads.filter(
      (load) => load.status === "invoiced"
    ).length;

    // --------------------------------------------------------
    // FINANCIALS
    // --------------------------------------------------------

    const totalRevenue = canReadFinance
      ? loads.reduce((total, load) => {
          return (
            total +
            numberValue(load.linehaul) +
            numberValue(load.detention) +
            numberValue(load.layover) +
            numberValue(load.lumper) +
            numberValue(load.other_charges)
          );
        }, 0)
      : 0;

    const operatingExpenses = canReadFinance
      ? expenses.reduce((total, expense) => {
          return total + numberValue(expense.amount);
        }, 0)
      : 0;

    const driverPayroll = canReadFinance
      ? settlements.reduce((total, settlement) => {
          return total + numberValue(settlement.net_pay);
        }, 0)
      : 0;

    const netProfit =
      totalRevenue - operatingExpenses - driverPayroll;

    // --------------------------------------------------------
    // ACCOUNTS RECEIVABLE
    // --------------------------------------------------------

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(
      sevenDaysFromNow.getDate() + 7
    );

    let outstandingReceivables = 0;
    let overdueReceivables = 0;
    let dueThisWeek = 0;

    for (const invoice of invoices) {
      const amount = numberValue(invoice.amount);
      const paidAmount = numberValue(invoice.paid_amount);
      const balance = Math.max(amount - paidAmount, 0);

      if (balance <= 0) continue;

      outstandingReceivables += balance;

      if (invoice.due_date) {
        const dueDate = new Date(
          `${invoice.due_date}T00:00:00`
        );

        if (dueDate < today) {
          overdueReceivables += balance;
        } else if (
          dueDate >= today &&
          dueDate <= sevenDaysFromNow
        ) {
          dueThisWeek += balance;
        }
      }
    }

    // --------------------------------------------------------
    // RECENT INVOICES
    // --------------------------------------------------------

    const recentInvoices = invoices
      .slice(0, 5)
      .map((invoice) => {
        const amount = numberValue(invoice.amount);
        const paidAmount = numberValue(invoice.paid_amount);
        const balance = Math.max(amount - paidAmount, 0);

        let displayStatus = invoice.status;

        if (
          balance > 0 &&
          invoice.due_date &&
          !["paid", "cancelled"].includes(invoice.status)
        ) {
          const dueDate = new Date(
            `${invoice.due_date}T00:00:00`
          );

          if (dueDate < today) {
            displayStatus = "overdue";
          }
        }

        const broker = firstRelation(invoice.brokers);

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          broker: broker?.company_name ?? "—",
          amount,
          paidAmount,
          balance,
          dueDate: invoice.due_date,
          status: displayStatus,
        };
      });

    // --------------------------------------------------------
    // RECENT LOADS
    // --------------------------------------------------------

    const recentLoads = loads
      .slice(0, 5)
      .map((load) => {
        const broker = firstRelation(load.brokers);
        const driver = firstRelation(load.drivers);
        const truck = firstRelation(load.trucks);

        const driverName =
          driver?.first_name || driver?.last_name
            ? `${driver?.first_name ?? ""} ${
                driver?.last_name ?? ""
              }`.trim()
            : "—";

        const revenue =
          numberValue(load.linehaul) +
          numberValue(load.detention) +
          numberValue(load.layover) +
          numberValue(load.lumper) +
          numberValue(load.other_charges);

        return {
          id: load.id,
          loadNumber: load.load_number ?? "—",
          broker: broker?.company_name ?? "—",
          driver: driverName,
          truck: truck?.truck_number ?? "—",
          pickup: buildPlace(
            load.pickup_city,
            load.pickup_state
          ),
          pickupDate: load.pickup_date ?? null,
          delivery: buildPlace(
            load.delivery_city,
            load.delivery_state
          ),
          deliveryDate: load.delivery_date ?? null,
          revenue,
          status: load.status ?? "",
        };
      });

    // --------------------------------------------------------
    // TRUCK PROFITABILITY
    // --------------------------------------------------------

    const truckProfitability = canReadFinance
      ? trucks
          .map((truck) => {
            const revenue = loads
              .filter(
                (load) => load.truck_id === truck.id
              )
              .reduce((sum, load) => {
                return (
                  sum +
                  numberValue(load.linehaul) +
                  numberValue(load.detention) +
                  numberValue(load.layover) +
                  numberValue(load.lumper) +
                  numberValue(load.other_charges)
                );
              }, 0);

            const truckExpenses = expenses
              .filter(
                (expense) =>
                  expense.truck_id === truck.id
              )
              .reduce((sum, expense) => {
                return (
                  sum +
                  numberValue(expense.amount)
                );
              }, 0);

            const payroll = 0;

            return {
              truckId: truck.id,
              truckNumber:
                truck.truck_number ?? "—",
              status: truck.status ?? "",
              revenue,
              expenses: truckExpenses,
              payroll,
              netProfit:
                revenue - truckExpenses,
            };
          })
          .sort(
            (a, b) =>
              b.netProfit -
              a.netProfit
          )
          .slice(0, 5)
      : [];

    return NextResponse.json({
      activeTrucks,
      availableTrucks,
      maintenanceTrucks,
      inactiveTrucks,

      activeLoads,
      deliveredLoads,
      awaitingPod,
      invoicedLoads,

      totalRevenue,
      driverPayroll,
      operatingExpenses,
      netProfit,

      outstandingReceivables,
      overdueReceivables,
      dueThisWeek,

      recentInvoices,
      recentLoads,
      truckProfitability,

      /*
       * Useful for future UI status messaging.
       * Existing dashboard code can safely ignore these fields.
       */
      degraded:
        degradedSources.length > 0,
      degradedSources,
      role,
    });
  } catch (error) {
    console.error(
      "Dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load dashboard data",
      },
      {
        status: 500,
      }
    );
  }
}