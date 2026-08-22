"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Driver = {
	id: string;
	first_name: string;
	last_name: string;
	pay_type: "percentage" | "per_mile" | "flat_rate" | "hourly" | string;
	pay_rate: number;
};

type Load = {
	id: string;
	load_number: string;
	driver_id?: string | null;
	miles?: number | null;
	linehaul?: number | null;
	detention?: number | null;
	layover?: number | null;
	lumper?: number | null;
	other_charges?: number | null;
	status?: string | null;
	pickup_date?: string | null;
	delivery_date?: string | null;
};

type SettlementItem = {
	id?: string;
	settlement_id?: string | null;
	load_id?: string | null;
	item_type: string;
	description?: string | null;
	amount: number;
};

type Settlement = {
	id: string;
	company_id?: string | null;
	driver_id: string;
	settlement_number: string;
	period_start: string | null;
	period_end: string | null;
	gross_pay: number;
	total_deductions: number;
	net_pay: number;
	status: "draft" | "approved" | "paid" | "void" | string;
	paid_date?: string | null;
	notes?: string | null;
	created_at?: string;
	updated_at?: string;
	drivers?: { first_name?: string; last_name?: string } | null;
};

const STATUS_OPTIONS = ["All", "draft", "approved", "paid", "void"];

export default function PayrollPage() {
	const supabase = createClient();

	const [loading, setLoading] = useState(false);
	const [drivers, setDrivers] = useState<Driver[]>([]);
	const [settlements, setSettlements] = useState<Settlement[]>([]);
	const [items, setItems] = useState<SettlementItem[]>([]);

	const [showForm, setShowForm] = useState(false);
	const [showDetails, setShowDetails] = useState<Settlement | null>(null);

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("All");

	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// create settlement form state
	const [formDriverId, setFormDriverId] = useState<string>("");
	const [periodStart, setPeriodStart] = useState<string>("");
	const [periodEnd, setPeriodEnd] = useState<string>("");
	const [settlementNumber, setSettlementNumber] = useState<string>("");
	const [manualBonus, setManualBonus] = useState<string>("0");
	const [manualDeduction, setManualDeduction] = useState<string>("0");
	const [notes, setNotes] = useState<string>("");

	const [selectedLoads, setSelectedLoads] = useState<Load[]>([]);
	const [loadingLoads, setLoadingLoads] = useState(false);

	useEffect(() => {
		loadInitial();
	}, []);

	async function loadInitial() {
		setLoading(true);
		setError(null);
		try {
			const [dRes, sRes] = await Promise.all([
				supabase.from("drivers").select("id,first_name,last_name,pay_type,pay_rate,status").order("first_name"),
				supabase.from("driver_settlements").select(`*, drivers ( first_name, last_name )`).order("created_at", { ascending: false }).limit(200),
			]);

			if (dRes.error) throw dRes.error;
			if (sRes.error) throw sRes.error;

			setDrivers((dRes.data as Driver[]) || []);
			setSettlements((sRes.data as Settlement[]) || []);
		} catch (err: any) {
			console.error("Error loading payroll data", err);
			setError(err.message || String(err));
		} finally {
			setLoading(false);
		}
	}

	async function loadDriverLoads(driverId: string, start?: string, end?: string) {
		if (!driverId) return;
		setLoadingLoads(true);
		try {
			let query = supabase.from("loads").select("id,load_number,miles,linehaul,detention,layover,lumper,other_charges,status,pickup_date,delivery_date").eq("driver_id", driverId).neq("status", "cancelled");
			if (start) query = query.gte("delivery_date", start);
			if (end) query = query.lte("delivery_date", end);
			const res = await query.order("delivery_date", { ascending: false });
			if (res.error) throw res.error;
			setSelectedLoads((res.data as Load[]) || []);
		} catch (err: any) {
			console.error("Error loading driver loads", err);
			setError(err.message || String(err));
		} finally {
			setLoadingLoads(false);
		}
	}

	const totals = useMemo(() => {
		const acc = { draft: 0, approved: 0, paid: 0, totalPayroll: 0 } as any;
		settlements.forEach((s) => {
			if (s.status === "draft") acc.draft += 1;
			if (s.status === "approved") acc.approved += 1;
			if (s.status === "paid") acc.paid += 1;
			acc.totalPayroll += Number(s.net_pay || 0);
		});
		return acc;
	}, [settlements]);

	const filtered = settlements.filter((s) => {
		if (statusFilter !== "All" && s.status !== statusFilter) return false;
		const q = search.trim().toLowerCase();
		if (!q) return true;
		const driverName = s.drivers ? `${s.drivers.first_name} ${s.drivers.last_name}`.toLowerCase() : "";
		return s.settlement_number.toLowerCase().includes(q) || driverName.includes(q);
	});

	function revenueOfLoad(l: Load) {
		return (
			Number(l.linehaul || 0) +
			Number(l.detention || 0) +
			Number(l.layover || 0) +
			Number(l.lumper || 0) +
			Number(l.other_charges || 0)
		);
	}

	function calcLoadPayForDriver(l: Load, drv?: Driver) {
		if (!drv) return 0;
		const revenue = revenueOfLoad(l);
		if (drv.pay_type === "percentage") return revenue * (Number(drv.pay_rate || 0) / 100);
		if (drv.pay_type === "per_mile") return Number(l.miles || 0) * Number(drv.pay_rate || 0);
		if (drv.pay_type === "flat_rate") return Number(drv.pay_rate || 0);
		if (drv.pay_type === "hourly") return 0; // manual
		return 0;
	}

	function money(v: number) {
		return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
	}

	async function handleCreateSettlement(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		try {
			if (!formDriverId || !periodStart || !periodEnd || !settlementNumber) {
				setError("Driver, period start/end and settlement number are required.");
				return;
			}

			const drv = drivers.find((d) => d.id === formDriverId);
			// compute load pays
			const loadPays = selectedLoads.map((l) => ({ load: l, pay: calcLoadPayForDriver(l, drv) }));
			const bonus = Number(manualBonus) || 0;
			const deduction = Number(manualDeduction) || 0;
			const gross = loadPays.reduce((s, x) => s + Number(x.pay || 0), 0) + bonus;
			const totalDeductions = deduction;
			const net = gross - totalDeductions;

			const userRes = await supabase.auth.getUser();
			if (userRes.error) throw userRes.error;
			const userId = userRes.data.user?.id;
			const profileRes = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
			if (profileRes.error) throw profileRes.error;
			const company_id = profileRes.data?.company_id || null;

			const payload: any = {
				company_id,
				driver_id: formDriverId,
				settlement_number: settlementNumber,
				period_start: periodStart || null,
				period_end: periodEnd || null,
				gross_pay: gross,
				total_deductions: totalDeductions,
				net_pay: net,
				status: "draft",
				notes: notes || null,
			};

			const res = await supabase.from("driver_settlements").insert(payload).select().maybeSingle();
			if (res.error) throw res.error;
			const created = res.data as Settlement;

			// create settlement_items
			const itemsToInsert: SettlementItem[] = [];
			loadPays.forEach((lp) => {
				itemsToInsert.push({ settlement_id: created.id, load_id: lp.load.id, item_type: "load_pay", description: `Load ${lp.load.load_number}`, amount: Number(lp.pay || 0) });
			});
			if (bonus > 0) itemsToInsert.push({ settlement_id: created.id, load_id: null, item_type: "bonus", description: "Manual Bonus", amount: bonus });
			if (deduction > 0) itemsToInsert.push({ settlement_id: created.id, load_id: null, item_type: "deduction", description: "Manual Deduction", amount: -Math.abs(deduction) });

			if (itemsToInsert.length > 0) {
				const itRes = await supabase.from("settlement_items").insert(itemsToInsert);
				if (itRes.error) throw itRes.error;
			}

			setSuccess("Settlement created");
			setShowForm(false);
			// reset
			setFormDriverId("");
			setPeriodStart("");
			setPeriodEnd("");
			setSettlementNumber("");
			setManualBonus("0");
			setManualDeduction("0");
			setNotes("");
			setSelectedLoads([]);

			await loadInitial();
			setTimeout(() => setSuccess(null), 3000);
		} catch (err: any) {
			console.error("Error creating settlement", err);
			setError(err.message || String(err));
		}
	}

	async function approveSettlement(id: string) {
		try {
			const res = await supabase.from("driver_settlements").update({ status: "approved" }).eq("id", id);
			if (res.error) throw res.error;
			setSuccess("Settlement approved");
			await loadInitial();
			setTimeout(() => setSuccess(null), 3000);
		} catch (err: any) {
			console.error("Error approving settlement", err);
			setError(err.message || String(err));
		}
	}

	async function markPaid(id: string) {
		try {
			const paid_date = new Date().toISOString();
			const res = await supabase.from("driver_settlements").update({ status: "paid", paid_date }).eq("id", id);
			if (res.error) throw res.error;
			setSuccess("Settlement marked paid");
			await loadInitial();
			setTimeout(() => setSuccess(null), 3000);
		} catch (err: any) {
			console.error("Error marking paid", err);
			setError(err.message || String(err));
		}
	}

	async function voidSettlement(id: string) {
		if (!confirm("Are you sure you want to void this settlement?")) return;
		try {
			const res = await supabase.from("driver_settlements").update({ status: "void" }).eq("id", id);
			if (res.error) throw res.error;
			setSuccess("Settlement voided");
			await loadInitial();
			setTimeout(() => setSuccess(null), 3000);
		} catch (err: any) {
			console.error("Error voiding settlement", err);
			setError(err.message || String(err));
		}
	}

	async function viewDetails(s: Settlement) {
		setShowDetails(s);
		try {
			const res = await supabase.from("settlement_items").select("*, loads ( load_number )").eq("settlement_id", s.id).order("created_at", { ascending: true });
			if (res.error) throw res.error;
			setItems((res.data as SettlementItem[]) || []);
		} catch (err: any) {
			console.error("Error loading settlement items", err);
			setError(err.message || String(err));
		}
	}

	// when driver or period changes in form, load loads
	useEffect(() => {
		if (formDriverId && periodStart && periodEnd) {
			loadDriverLoads(formDriverId, periodStart, periodEnd);
		}
	}, [formDriverId, periodStart, periodEnd]);

	return (
		<div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
			<div className="mx-auto max-w-7xl">
				<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<p className="text-sm font-semibold tracking-[0.25em] text-blue-600">FLEETOS</p>
						<h1 className="mt-2 text-3xl font-bold text-slate-950">Payroll & Settlements</h1>
						<p className="mt-2 text-slate-500">Calculate driver pay, deductions, net settlements and payment status.</p>
					</div>
					<div className="flex items-center gap-3">
						<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search settlement # or driver" className="hidden sm:block rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm" />
						<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
							{STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
						</select>
						<button onClick={() => setShowForm(true)} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500">+ Create Settlement</button>
					</div>
				</div>

				{error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
				{success && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-3xl border border-slate-200 bg-white p-4">
						<p className="text-sm text-slate-500">Draft Settlements</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{totals.draft}</p>
					</div>
					<div className="rounded-3xl border border-slate-200 bg-white p-4">
						<p className="text-sm text-slate-500">Approved</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{totals.approved}</p>
					</div>
					<div className="rounded-3xl border border-slate-200 bg-white p-4">
						<p className="text-sm text-slate-500">Paid</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{totals.paid}</p>
					</div>
					<div className="rounded-3xl border border-slate-200 bg-white p-4">
						<p className="text-sm text-slate-500">Total Driver Payroll</p>
						<p className="mt-2 text-2xl font-semibold text-slate-900">{money(totals.totalPayroll)}</p>
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-slate-900">Settlements</h2>
						<div className="text-sm text-slate-500">{loading ? "Loading..." : `${filtered.length} items`}</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full text-left text-sm">
							<thead className="border-b border-slate-200 text-slate-500">
								<tr>
									<th className="py-3 pr-6">Settlement #</th>
									<th className="py-3 pr-6">Driver</th>
									<th className="py-3 pr-6">Period</th>
									<th className="py-3 pr-6">Gross Pay</th>
									<th className="py-3 pr-6">Deductions</th>
									<th className="py-3 pr-6">Net Pay</th>
									<th className="py-3 pr-6">Status</th>
									<th className="py-3 pr-6">Paid Date</th>
									<th className="py-3">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200 text-slate-700">
								{filtered.length === 0 && !loading ? (
									<tr>
										<td colSpan={9} className="py-12 text-center text-slate-500">No settlements found. Create your first driver settlement to get started.</td>
									</tr>
								) : (
									filtered.map((s) => (
										<tr key={s.id} className="hover:bg-slate-50">
											<td className="py-4 pr-6 font-medium">{s.settlement_number}</td>
											<td className="py-4 pr-6">{s.drivers ? `${s.drivers.first_name} ${s.drivers.last_name}` : "—"}</td>
											<td className="py-4 pr-6">{s.period_start && s.period_end ? `${new Date(s.period_start).toLocaleDateString()} → ${new Date(s.period_end).toLocaleDateString()}` : "—"}</td>
											<td className="py-4 pr-6 font-semibold text-slate-900">{money(Number(s.gross_pay || 0))}</td>
											<td className="py-4 pr-6">{money(Number(s.total_deductions || 0))}</td>
											<td className="py-4 pr-6 font-semibold text-slate-900">{money(Number(s.net_pay || 0))}</td>
											<td className="py-4 pr-6">
												<span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${s.status === 'draft' ? 'bg-slate-100 text-slate-700' : s.status === 'approved' ? 'bg-amber-100 text-amber-700' : s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{s.status}</span>
											</td>
											<td className="py-4 pr-6">{s.paid_date ? new Date(s.paid_date).toLocaleDateString() : "—"}</td>
											<td className="py-4 pr-6">
												<div className="flex items-center gap-2">
													<button onClick={() => viewDetails(s)} className="rounded-2xl bg-slate-100 px-3 py-1 text-sm">View</button>
													{s.status === "draft" && <button onClick={() => approveSettlement(s.id)} className="rounded-2xl bg-sky-50 px-3 py-1 text-sm text-sky-700">Approve</button>}
													{s.status === "approved" && <button onClick={() => markPaid(s.id)} className="rounded-2xl bg-emerald-50 px-3 py-1 text-sm text-emerald-700">Mark Paid</button>}
													{(s.status === "draft" || s.status === "approved") && <button onClick={() => voidSettlement(s.id)} className="rounded-2xl bg-rose-50 px-3 py-1 text-sm text-rose-600">Void</button>}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Create settlement form modal */}
				{showForm && (
					<div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
						<div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
						<form onSubmit={handleCreateSettlement} className="relative z-50 mx-4 mt-10 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
							<div className="mb-4 flex items-center justify-between">
								<h3 className="text-lg font-semibold text-slate-900">Create Settlement</h3>
								<button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500">Close</button>
							</div>

							<div className="grid gap-3 sm:grid-cols-3">
								<div className="sm:col-span-1">
									<label className="mb-1 block text-sm text-slate-600">Driver *</label>
									<select required value={formDriverId} onChange={(e) => setFormDriverId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2">
										<option value="">Select Driver</option>
										{drivers.map((d) => (<option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>))}
									</select>
								</div>

								<div>
									<label className="mb-1 block text-sm text-slate-600">Period Start *</label>
									<input required type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
								</div>

								<div>
									<label className="mb-1 block text-sm text-slate-600">Period End *</label>
									<input required type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
								</div>

								<div>
									<label className="mb-1 block text-sm text-slate-600">Settlement Number *</label>
									<input required value={settlementNumber} onChange={(e) => setSettlementNumber(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
								</div>

								<div>
									<label className="mb-1 block text-sm text-slate-600">Manual Bonus</label>
									<input type="number" step="0.01" value={manualBonus} onChange={(e) => setManualBonus(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
								</div>

								<div>
									<label className="mb-1 block text-sm text-slate-600">Manual Deduction</label>
									<input type="number" step="0.01" value={manualDeduction} onChange={(e) => setManualDeduction(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
								</div>

								<div className="sm:col-span-3">
									<label className="mb-1 block text-sm text-slate-600">Notes</label>
									<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2" rows={2} />
								</div>
							</div>

							<div className="mt-4">
								<h4 className="mb-2 text-sm font-semibold">Included Loads</h4>
								{loadingLoads ? <div className="text-sm text-slate-500">Loading loads...</div> : (
									<div className="mb-4 max-h-48 overflow-auto border border-slate-100 p-2">
										{selectedLoads.length === 0 ? <div className="text-sm text-slate-500">No loads for selected driver and period.</div> : (
											<table className="min-w-full text-left text-sm">
												<thead className="text-slate-500">
													<tr>
														<th className="py-2 pr-4">Load</th>
														<th className="py-2 pr-4">Miles</th>
														<th className="py-2 pr-4">Revenue</th>
														<th className="py-2 pr-4">Driver Pay</th>
													</tr>
												</thead>
												<tbody className="text-slate-700">
													{selectedLoads.map((l) => {
														const drv = drivers.find((d) => d.id === formDriverId);
														const revenue = revenueOfLoad(l);
														const pay = calcLoadPayForDriver(l, drv);
														return (
															<tr key={l.id} className="border-t border-slate-100">
																<td className="py-2 pr-4">{l.load_number}</td>
																<td className="py-2 pr-4">{l.miles ?? "—"}</td>
																<td className="py-2 pr-4">{money(revenue)}</td>
																<td className="py-2 pr-4">{drv?.pay_type === 'hourly' ? <span className="text-sm text-slate-500">Hourly - manual</span> : money(pay)}</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										)}
									</div>
								)}
							</div>

							<div className="mt-4 flex items-center justify-between">
								<div className="text-sm text-slate-500">
									<div>Gross Pay: <strong>{money(selectedLoads.reduce((s, l) => s + calcLoadPayForDriver(l, drivers.find(d=>d.id===formDriverId)), 0) + (Number(manualBonus)||0))}</strong></div>
									<div>Deductions: <strong>{money(Number(manualDeduction)||0)}</strong></div>
									<div>Net Pay: <strong>{money((selectedLoads.reduce((s, l) => s + calcLoadPayForDriver(l, drivers.find(d=>d.id===formDriverId)), 0) + (Number(manualBonus)||0)) - (Number(manualDeduction)||0))}</strong></div>
								</div>
								<div className="flex items-center gap-3">
									<button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-slate-200 px-4 py-2">Cancel</button>
									<button type="submit" className="rounded-2xl bg-blue-600 px-4 py-2 text-white">Create Settlement</button>
								</div>
							</div>
						</form>
					</div>
				)}

				{/* Details modal */}
				{showDetails && (
					<div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
						<div className="absolute inset-0 bg-black/40" onClick={() => setShowDetails(null)} />
						<div className="relative z-50 mx-4 mt-10 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
							<div className="mb-4 flex items-center justify-between">
								<h3 className="text-lg font-semibold text-slate-900">Settlement {showDetails.settlement_number}</h3>
								<button onClick={() => setShowDetails(null)} className="text-sm text-slate-500">Close</button>
							</div>
							<div className="mb-4 text-sm text-slate-700">
								<div>Driver: {showDetails.drivers ? `${showDetails.drivers.first_name} ${showDetails.drivers.last_name}` : '—'}</div>
								<div>Period: {showDetails.period_start && showDetails.period_end ? `${new Date(showDetails.period_start).toLocaleDateString()} → ${new Date(showDetails.period_end).toLocaleDateString()}` : '—'}</div>
								<div className="mt-2">Notes: {showDetails.notes || '—'}</div>
							</div>
							<div className="mb-4">
								<h4 className="text-sm font-semibold">Items</h4>
								<div className="mt-2">
									{items.length === 0 ? <div className="text-sm text-slate-500">No items</div> : (
										<table className="min-w-full text-left text-sm">
											<thead className="text-slate-500">
												<tr>
													<th className="py-2 pr-4">Type</th>
													<th className="py-2 pr-4">Description</th>
													<th className="py-2 pr-4">Amount</th>
												</tr>
											</thead>
											<tbody className="text-slate-700">
												{items.map((it) => (
													<tr key={it.id} className="border-t border-slate-100">
														<td className="py-2 pr-4">{it.item_type}</td>
														<td className="py-2 pr-4">{it.description}</td>
														<td className="py-2 pr-4">{money(it.amount)}</td>
													</tr>
												))}
											</tbody>
										</table>
									)}
								</div>
							</div>
							<div className="flex items-center justify-end gap-3">
								{showDetails.status === 'draft' && <button onClick={() => { approveSettlement(showDetails.id); setShowDetails(null); }} className="rounded-2xl bg-amber-100 px-4 py-2 text-amber-700">Approve</button>}
								{showDetails.status === 'approved' && <button onClick={() => { markPaid(showDetails.id); setShowDetails(null); }} className="rounded-2xl bg-emerald-100 px-4 py-2 text-emerald-700">Mark Paid</button>}
								{(showDetails.status === 'draft' || showDetails.status === 'approved') && <button onClick={() => { voidSettlement(showDetails.id); setShowDetails(null); }} className="rounded-2xl bg-rose-50 px-4 py-2 text-rose-600">Void</button>}
								<button onClick={() => setShowDetails(null)} className="rounded-2xl border border-slate-200 px-4 py-2">Close</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

