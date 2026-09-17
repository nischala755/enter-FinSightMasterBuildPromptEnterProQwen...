// ---------------------------------------------------------------------------
// Northstar Commerce — canonical seed dataset (INR).
// Calibrated so the deterministic engine reproduces the demo figures:
//   current cash ₹4.82 Cr, 90-day forecast ≈ ₹2.17 Cr, at-risk capital ₹28.4L,
//   recoverable leakage ₹38.4L, financial health 78/100,
//   liquidity exposure ≈ ₹64L, breach ≈ 52 days, min safe ₹1.25 Cr.
// ---------------------------------------------------------------------------

import type {
  ApInvoice,
  CashBalance,
  Customer,
  FinSightState,
  Invoice,
  Leak,
  Payment,
  ProjectionTranche,
  PurchaseOrder,
  Receivable,
  Risk,
  Subscription,
  Vendor,
  Workflow,
  AuditEvent,
  Expense,
  Budget,
} from "./types";

export const MIN_SAFE_CASH = 12_500_000; // ₹1.25 Cr
export const CURRENT_CASH = 48_200_000; // ₹4.82 Cr

const iso = (daysFromToday: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const customers: Customer[] = [
  { id: "C-001", name: "Aster Retail", creditTermsDays: 45, paymentBehaviorDays: 78, concentrationPct: 28, flag: "Delaying payments" },
  { id: "C-002", name: "Crescent Mart", creditTermsDays: 45, paymentBehaviorDays: 51, concentrationPct: 22 },
  { id: "C-003", name: "Summit Retail", creditTermsDays: 30, paymentBehaviorDays: 44, concentrationPct: 14 },
  { id: "C-004", name: "Indus Hyper", creditTermsDays: 45, paymentBehaviorDays: 49, concentrationPct: 11 },
  { id: "C-005", name: "Orchard Stores", creditTermsDays: 30, paymentBehaviorDays: 38, concentrationPct: 9 },
  { id: "C-006", name: "Mercado Distributors", creditTermsDays: 60, paymentBehaviorDays: 66, concentrationPct: 7 },
  { id: "C-007", name: "Bayleaf Hotels", creditTermsDays: 30, paymentBehaviorDays: 33, concentrationPct: 5 },
  { id: "C-008", name: "Delta Pharmacies", creditTermsDays: 45, paymentBehaviorDays: 47, concentrationPct: 4 },
];

// ---------------------------------------------------------------------------
// Story invoices (outstanding AR) — consistent with receivables + projection
// ---------------------------------------------------------------------------
export const storyInvoices: Invoice[] = [
  // Aster Retail — aging deterioration
  { id: "INV-24-2214", customerId: "C-001", amount: 5_800_000, issuedAt: iso(-87), dueAt: iso(-42), status: "overdue", agingDays: 87 },
  { id: "INV-24-2211", customerId: "C-001", amount: 4_200_000, issuedAt: iso(-72), dueAt: iso(-27), status: "overdue", agingDays: 72 },
  { id: "INV-24-2205", customerId: "C-001", amount: 3_100_000, issuedAt: iso(-55), dueAt: iso(-10), status: "overdue", agingDays: 55 },
  { id: "INV-24-2198", customerId: "C-001", amount: 2_400_000, issuedAt: iso(-40), dueAt: iso(5), status: "open", agingDays: 40 },
  // Crescent Mart — short payment
  { id: "INV-24-2220", customerId: "C-002", amount: 3_400_000, issuedAt: iso(-48), dueAt: iso(-3), status: "overdue", agingDays: 48 },
  { id: "INV-24-2215", customerId: "C-002", amount: 2_400_000, issuedAt: iso(-30), dueAt: iso(15), status: "open", agingDays: 30 },
  // Summit Retail
  { id: "INV-24-2224", customerId: "C-003", amount: 2_600_000, issuedAt: iso(-35), dueAt: iso(-5), status: "disputed", agingDays: 35 },
  { id: "INV-24-2218", customerId: "C-003", amount: 1_900_000, issuedAt: iso(-22), dueAt: iso(8), status: "open", agingDays: 22 },
  // Indus Hyper
  { id: "INV-24-2226", customerId: "C-004", amount: 2_200_000, issuedAt: iso(-28), dueAt: iso(17), status: "open", agingDays: 28 },
  { id: "INV-24-2219", customerId: "C-004", amount: 1_600_000, issuedAt: iso(-15), dueAt: iso(30), status: "open", agingDays: 15 },
  // Orchard Stores
  { id: "INV-24-2228", customerId: "C-005", amount: 1_400_000, issuedAt: iso(-20), dueAt: iso(10), status: "open", agingDays: 20 },
  { id: "INV-24-2222", customerId: "C-005", amount: 1_200_000, issuedAt: iso(-8), dueAt: iso(22), status: "open", agingDays: 8 },
  // Mercado Distributors
  { id: "INV-24-2230", customerId: "C-006", amount: 1_100_000, issuedAt: iso(-18), dueAt: iso(42), status: "open", agingDays: 18 },
  // Bayleaf Hotels
  { id: "INV-24-2231", customerId: "C-007", amount: 800_000, issuedAt: iso(-12), dueAt: iso(18), status: "open", agingDays: 12 },
  // Delta Pharmacies
  { id: "INV-24-2232", customerId: "C-008", amount: 600_000, issuedAt: iso(-10), dueAt: iso(35), status: "open", agingDays: 10 },
];

// Filler — historical fully-paid invoices for table volume
export const fillerInvoices: Invoice[] = (() => {
  const out: Invoice[] = [];
  const amounts = [1_800_000, 2_400_000, 1_200_000, 3_000_000, 1_500_000, 900_000, 2_100_000, 700_000];
  const customersArr = ["C-001", "C-002", "C-003", "C-004", "C-005", "C-006", "C-007", "C-008"];
  let n = 0;
  for (let m = 5; m >= 1; m--) {
    for (let i = 0; i < customersArr.length; i++) {
      const issued = -m * 30 - i * 3 - (n % 4) * 2;
      const amt = amounts[(n + i * 3) % amounts.length];
      out.push({
        id: `INV-24-${(2100 + n).toString()}`,
        customerId: customersArr[i],
        amount: amt,
        issuedAt: iso(issued),
        dueAt: iso(issued + 45),
        paidAt: iso(issued + 46 + (n % 3) * 8),
        status: "paid",
        agingDays: 0,
      });
      n++;
    }
  }
  return out;
})();

export const invoices: Invoice[] = [...storyInvoices, ...fillerInvoices];

// ---------------------------------------------------------------------------
// Payments (for paid story-adjacent + filler invoices; a few received)
// ---------------------------------------------------------------------------
export const payments: Payment[] = (() => {
  const out: Payment[] = [];
  let n = 0;
  for (const inv of fillerInvoices) {
    if (inv.paidAt && inv.status === "paid") {
      out.push({
        id: `PAY-${(4100 + n).toString()}`,
        invoiceId: inv.id,
        customerId: inv.customerId,
        amount: inv.amount,
        receivedAt: inv.paidAt,
        method: n % 3 === 0 ? "NEFT" : n % 3 === 1 ? "RTGS" : "UPI",
      });
      n++;
    }
  }
  // Recent partial receipt from Crescent (short-pay of INV-24-2220)
  out.push({
    id: "PAY-4721",
    invoiceId: "INV-24-2220",
    customerId: "C-002",
    amount: 1_100_000,
    receivedAt: iso(-2),
    method: "NEFT",
  });
  return out;
})();

// ---------------------------------------------------------------------------
// AP invoices — includes the duplicate pair (INV-48291 / INV-48294)
// ---------------------------------------------------------------------------
export const apInvoices: ApInvoice[] = [
  { id: "AP-INV-48291", vendorId: "V-014", poRef: "PO-1189", amount: 450_000, receivedAt: iso(-70), dueAt: iso(-25), paidAt: iso(-20), payRef: "PAY-3104", status: "paid" },
  { id: "AP-INV-48294", vendorId: "V-014", poRef: "PO-1189", amount: 450_000, receivedAt: iso(-69), dueAt: iso(-24), paidAt: iso(-19), payRef: "PAY-3110", status: "paid", duplicateOf: "AP-INV-48291" },
  { id: "AP-INV-48310", vendorId: "V-004", poRef: "PO-1160", amount: 2_800_000, receivedAt: iso(-40), dueAt: iso(-10), status: "open" },
  { id: "AP-INV-48322", vendorId: "V-019", poRef: "PO-1178", amount: 1_900_000, receivedAt: iso(-22), dueAt: iso(8), status: "open" },
  { id: "AP-INV-48330", vendorId: "V-001", poRef: "PO-1180", amount: 3_600_000, receivedAt: iso(-12), dueAt: iso(18), status: "open" },
];

// ---------------------------------------------------------------------------
// Vendors — V-019 has gradual price creep; V-025 changed bank details
// ---------------------------------------------------------------------------
export const vendors: Vendor[] = [
  {
    id: "V-001", name: "Precision Packaging", category: "Packaging", monthlySpend: 1_800_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.02 },
      { quarter: "Q3 26", index: 1.01 }, { quarter: "Q4 26", index: 1.03 }, { quarter: "Q1 27", index: 1.04 },
    ],
    flags: ["single-source"], bankDetailsChanged: false, singleSource: true, riskIds: [], leakIds: [],
  },
  {
    id: "V-004", name: "Redstar Logistics", category: "Logistics", monthlySpend: 980_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.01 },
      { quarter: "Q3 26", index: 1.02 }, { quarter: "Q4 26", index: 1.03 }, { quarter: "Q1 27", index: 1.05 },
    ],
    flags: ["duplicate-payment-risk"], bankDetailsChanged: false, singleSource: false,
    riskIds: ["R-07"], leakIds: ["LK-04"],
  },
  {
    id: "V-007", name: "ChemCorp Supply", category: "Raw Materials", monthlySpend: 1_400_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.00 },
      { quarter: "Q3 26", index: 1.01 }, { quarter: "Q4 26", index: 1.01 }, { quarter: "Q1 27", index: 1.02 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: [], leakIds: [],
  },
  {
    id: "V-011", name: "Ironclad Freight", category: "Freight", monthlySpend: 760_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.03 },
      { quarter: "Q3 26", index: 1.02 }, { quarter: "Q4 26", index: 1.06 }, { quarter: "Q1 27", index: 1.08 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: ["R-03"], leakIds: ["LK-01"],
  },
  {
    id: "V-014", name: "Avon Logistics", category: "Freight", monthlySpend: 620_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.00 },
      { quarter: "Q3 26", index: 1.01 }, { quarter: "Q4 26", index: 1.02 }, { quarter: "Q1 27", index: 1.02 },
    ],
    flags: ["duplicate-payment-risk"], bankDetailsChanged: false, singleSource: false,
    riskIds: ["R-04"], leakIds: ["LK-03"],
  },
  {
    id: "V-019", name: "NovoTextiles", category: "Raw Materials", monthlySpend: 320_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.048 },
      { quarter: "Q3 26", index: 1.099 }, { quarter: "Q4 26", index: 1.152 }, { quarter: "Q1 27", index: 1.207 },
    ],
    flags: ["price-creep", "single-source"], bankDetailsChanged: false, singleSource: true,
    riskIds: ["R-03"], leakIds: ["LK-01"],
  },
  {
    id: "V-021", name: "CloudServ IT", category: "IT Services", monthlySpend: 140_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.00 },
      { quarter: "Q3 26", index: 1.00 }, { quarter: "Q4 26", index: 1.05 }, { quarter: "Q1 27", index: 1.05 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: ["R-06"], leakIds: ["LK-02"],
  },
  {
    id: "V-025", name: "Atlas Freight", category: "Freight", monthlySpend: 540_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.02 },
      { quarter: "Q3 26", index: 1.04 }, { quarter: "Q4 26", index: 1.05 }, { quarter: "Q1 27", index: 1.06 },
    ],
    flags: ["bank-detail-change"], bankDetailsChanged: true, singleSource: false, riskIds: [], leakIds: [],
  },
  {
    id: "V-033", name: "Willow Paper", category: "Office Supplies", monthlySpend: 180_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.01 },
      { quarter: "Q3 26", index: 1.01 }, { quarter: "Q4 26", index: 1.02 }, { quarter: "Q1 27", index: 1.02 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: [], leakIds: [],
  },
  {
    id: "V-040", name: "Hydra Utilities", category: "Utilities", monthlySpend: 320_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.02 },
      { quarter: "Q3 26", index: 1.03 }, { quarter: "Q4 26", index: 1.05 }, { quarter: "Q1 27", index: 1.07 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: [], leakIds: ["LK-05"],
  },
  {
    id: "V-047", name: "Matrix Software", category: "SaaS", monthlySpend: 58_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.00 },
      { quarter: "Q3 26", index: 1.00 }, { quarter: "Q4 26", index: 1.00 }, { quarter: "Q1 27", index: 1.00 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: ["R-06"], leakIds: ["LK-02"],
  },
  {
    id: "V-052", name: "GreenLeaf Office", category: "Office Supplies", monthlySpend: 96_000,
    priceTrend: [
      { quarter: "Q1 26", index: 1.00 }, { quarter: "Q2 26", index: 1.00 },
      { quarter: "Q3 26", index: 1.00 }, { quarter: "Q4 26", index: 1.00 }, { quarter: "Q1 27", index: 1.00 },
    ],
    flags: [], bankDetailsChanged: false, singleSource: false, riskIds: [], leakIds: [],
  },
];

// ---------------------------------------------------------------------------
// Purchase orders — includes the bulk inventory PO (drives cash trough)
// ---------------------------------------------------------------------------
export const purchaseOrders: PurchaseOrder[] = [
  { id: "PO-1160", vendorId: "V-004", amount: 2_800_000, status: "fulfilled", issuedAt: iso(-45), expectedDelivery: iso(-38), paid: false },
  { id: "PO-1178", vendorId: "V-019", amount: 1_900_000, status: "fulfilled", issuedAt: iso(-28), expectedDelivery: iso(-21), paid: false },
  { id: "PO-1180", vendorId: "V-001", amount: 3_600_000, status: "fulfilled", issuedAt: iso(-18), expectedDelivery: iso(-10), paid: false },
  { id: "PO-1184", vendorId: "V-001", amount: 7_000_000, status: "approved", issuedAt: iso(-6), expectedDelivery: iso(14), paid: false },
  { id: "PO-1186", vendorId: "V-019", amount: 960_000, status: "open", issuedAt: iso(-3), expectedDelivery: iso(20), paid: false },
  { id: "PO-1188", vendorId: "V-011", amount: 1_500_000, status: "open", issuedAt: iso(-1), expectedDelivery: iso(16), paid: false },
  { id: "PO-1189", vendorId: "V-014", amount: 450_000, status: "fulfilled", issuedAt: iso(-72), expectedDelivery: iso(-68), paid: true },
  { id: "PO-1155", vendorId: "V-007", amount: 2_300_000, status: "fulfilled", issuedAt: iso(-60), expectedDelivery: iso(-52), paid: true },
  { id: "PO-1158", vendorId: "V-011", amount: 1_200_000, status: "fulfilled", issuedAt: iso(-52), expectedDelivery: iso(-44), paid: true },
  { id: "PO-1165", vendorId: "V-025", amount: 1_800_000, status: "fulfilled", issuedAt: iso(-36), expectedDelivery: iso(-28), paid: true },
];

// ---------------------------------------------------------------------------
// Subscriptions — zombie/underused volume calibrates LK-02 to ≈ ₹6.2L/yr
// ---------------------------------------------------------------------------
export const subscriptions: Subscription[] = [
  { id: "SUB-01", name: "Matrix CRM", vendorId: "V-047", monthlyAmount: 26_000, seats: 40, activeSeats: 22, lastUsedAt: iso(-95), status: "zombie" },
  { id: "SUB-02", name: "CloudServ Object Storage", vendorId: "V-021", monthlyAmount: 42_000, seats: 0, activeSeats: 0, lastUsedAt: iso(-140), status: "zombie" },
  { id: "SUB-03", name: "Atlas Fleet Tracking", vendorId: "V-025", monthlyAmount: 65_000, seats: 30, activeSeats: 14, lastUsedAt: iso(-30), status: "underused" },
  { id: "SUB-04", name: "Nova Analytics", vendorId: "V-047", monthlyAmount: 38_000, seats: 12, activeSeats: 12, lastUsedAt: iso(-1), status: "active" },
  { id: "SUB-05", name: "WorkBoard PM", monthlyAmount: 24_000, seats: 25, activeSeats: 6, lastUsedAt: iso(-75), status: "zombie" },
  { id: "SUB-06", name: "SecureMail", monthlyAmount: 18_000, seats: 60, activeSeats: 58, lastUsedAt: iso(-1), status: "active" },
  { id: "SUB-07", name: "DataLake BI", monthlyAmount: 52_000, seats: 20, activeSeats: 9, lastUsedAt: iso(-42), status: "underused" },
  { id: "SUB-08", name: "VidBridge", monthlyAmount: 12_000, seats: 8, activeSeats: 2, lastUsedAt: iso(-60), status: "zombie" },
];

// ---------------------------------------------------------------------------
// Expenses — includes anomalies feeding LK-05
// ---------------------------------------------------------------------------
export const expenses: Expense[] = [
  { id: "EXP-3101", category: "Supplies", department: "Operations", amount: 480_000, date: iso(-16), vendorId: "V-040", status: "anomalous" },
  { id: "EXP-3102", category: "Travel", department: "Sales", amount: 210_000, date: iso(-12), status: "anomalous" },
  { id: "EXP-3103", category: "Travel", department: "Sales", amount: 96_000, date: iso(-11), status: "anomalous" },
  { id: "EXP-3104", category: "Supplies", department: "Operations", amount: 145_000, date: iso(-9), vendorId: "V-052", status: "approved" },
  { id: "EXP-3105", category: "Marketing", department: "Marketing", amount: 350_000, date: iso(-6), status: "pending" },
  { id: "EXP-3106", category: "Supplies", department: "Operations", amount: 122_000, date: iso(-4), vendorId: "V-052", status: "approved" },
  { id: "EXP-3107", category: "Software", department: "Engineering", amount: 88_000, date: iso(-2), vendorId: "V-047", status: "approved" },
];

export const budgets: Budget[] = [
  { department: "Procurement", period: "FY26", allocated: 26_000_000, spent: 27_400_000 },
  { department: "Operations", period: "FY26", allocated: 18_500_000, spent: 19_100_000 },
  { department: "Sales", period: "FY26", allocated: 7_200_000, spent: 7_800_000 },
  { department: "Marketing", period: "FY26", allocated: 6_800_000, spent: 7_460_000 },
  { department: "Admin", period: "FY26", allocated: 4_100_000, spent: 4_220_000 },
  { department: "Engineering", period: "FY26", allocated: 9_000_000, spent: 8_900_000 },
];

// ---------------------------------------------------------------------------
// Receivables (aging buckets) — consistent with story invoices
// ---------------------------------------------------------------------------
export const receivables: Receivable[] = [
  { invoiceId: "INV-24-2214", customerId: "C-001", amount: 5_800_000, ageBucket: "90+" },
  { invoiceId: "INV-24-2211", customerId: "C-001", amount: 4_200_000, ageBucket: "61-90" },
  { invoiceId: "INV-24-2205", customerId: "C-001", amount: 3_100_000, ageBucket: "31-60" },
  { invoiceId: "INV-24-2198", customerId: "C-001", amount: 2_400_000, ageBucket: "1-30" },
  { invoiceId: "INV-24-2220", customerId: "C-002", amount: 2_300_000, ageBucket: "31-60" }, // 3.4M less 1.1M received
  { invoiceId: "INV-24-2215", customerId: "C-002", amount: 2_400_000, ageBucket: "1-30" },
  { invoiceId: "INV-24-2224", customerId: "C-003", amount: 2_600_000, ageBucket: "31-60" },
  { invoiceId: "INV-24-2218", customerId: "C-003", amount: 1_900_000, ageBucket: "1-30" },
  { invoiceId: "INV-24-2226", customerId: "C-004", amount: 2_200_000, ageBucket: "1-30" },
  { invoiceId: "INV-24-2219", customerId: "C-004", amount: 1_600_000, ageBucket: "current" },
  { invoiceId: "INV-24-2228", customerId: "C-005", amount: 1_400_000, ageBucket: "1-30" },
  { invoiceId: "INV-24-2222", customerId: "C-005", amount: 1_200_000, ageBucket: "current" },
  { invoiceId: "INV-24-2230", customerId: "C-006", amount: 1_100_000, ageBucket: "current" },
  { invoiceId: "INV-24-2231", customerId: "C-007", amount: 800_000, ageBucket: "current" },
  { invoiceId: "INV-24-2232", customerId: "C-008", amount: 600_000, ageBucket: "current" },
];

// ---------------------------------------------------------------------------
// Cash history — 26 weekly points ending exactly at ₹4.82 Cr, declining from
// ~₹8.2 Cr as collections slowed and outflows accelerated.
// ---------------------------------------------------------------------------
export const cashHistory: CashBalance[] = (() => {
  const points: CashBalance[] = [];
  const base = 82_000_000; // ₹8.2 Cr twenty-six weeks ago
  // Weekly net outflow (₹), growing from ~₹4L to ~₹29L as the drain accelerates.
  const weeklyDrop = [
    400_000, 550_000, 300_000, 700_000, 450_000, 600_000, 500_000, 800_000,
    650_000, 750_000, 900_000, 700_000, 950_000, 1_100_000, 1_200_000, 1_350_000,
    1_500_000, 1_650_000, 1_800_000, 2_000_000, 2_150_000, 2_300_000, 2_450_000,
    2_600_000, 2_750_000, 2_900_000,
  ];
  let bal = base;
  for (let w = 0; w <= 26; w++) {
    points.push({ date: iso((w - 26) * 7), balance: bal });
    if (w < weeklyDrop.length) bal = base - weeklyDrop.slice(0, w + 1).reduce((a, b) => a + b, 0);
  }
  // Rebase so the final point equals CURRENT_CASH exactly, preserving shape.
  const shift = CURRENT_CASH - points[points.length - 1].balance;
  return points.map((p) => ({ ...p, balance: p.balance + shift }));
})();

// ---------------------------------------------------------------------------
// 90-day cash projection (the calibrated forecast backbone).
// Constructed so the deterministic engine reproduces:
//   current cash ₹4.82 Cr → trough ≈ ₹61L (exposure ≈ ₹64L) → ₹2.17 Cr day 90,
//   with the first crossing below min-safe at day 52.
// ---------------------------------------------------------------------------
export const projection: ProjectionTranche[] = [
  // Recurring opex
  { day: 1, label: "Payroll & rent", amount: -3_450_000, confidence: 1, source: "opex" },
  { day: 5, label: "Subscription billing", amount: -240_000, confidence: 1, source: "opex" },
  { day: 8, label: "Vendor run — Redstar", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 12, label: "Operating overhead", amount: -900_000, confidence: 1, source: "opex" },
  { day: 16, label: "Vendor run — ChemCorp", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 24, label: "Vendor run — Precision", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 30, label: "Payroll & rent", amount: -3_450_000, confidence: 1, source: "opex" },
  { day: 35, label: "Subscription billing", amount: -240_000, confidence: 1, source: "opex" },
  { day: 38, label: "Vendor run — Redstar", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 42, label: "Operating overhead", amount: -900_000, confidence: 1, source: "opex" },
  { day: 54, label: "Vendor run — Precision", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 58, label: "Vendor run — ChemCorp", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 65, label: "Subscription billing", amount: -240_000, confidence: 1, source: "opex" },
  { day: 68, label: "Vendor run — Redstar", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 72, label: "Operating overhead", amount: -900_000, confidence: 1, source: "opex" },
  { day: 76, label: "Vendor run — ChemCorp", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 84, label: "Vendor run — Precision", amount: -2_600_000, confidence: 0.95, source: "vendor" },
  { day: 90, label: "Payroll & rent", amount: -3_450_000, confidence: 1, source: "opex" },
  // Lumpy obligations — the trough drivers
  { day: 38, label: "Working-capital loan installment", amount: -8_800_000, confidence: 1, source: "loan" },
  { day: 45, label: "Bulk inventory PO-1184", amount: -7_000_000, confidence: 1, source: "po" },
  { day: 50, label: "Vendor run — ChemCorp (accelerated)", amount: -1_400_000, confidence: 0.9, source: "vendor" },
  { day: 52, label: "Supplier settlement — NovoTex", amount: -2_250_000, confidence: 0.9, source: "vendor" },
  // Collections — suppressed days 1–52, then settlement-led recovery
  { day: 6, label: "Collections — current terms", amount: 200_000, confidence: 0.6, source: "customer" },
  { day: 33, label: "Collections — current terms", amount: 180_000, confidence: 0.5, source: "customer" },
  { day: 47, label: "Partial — Crescent", amount: 1_200_000, confidence: 0.5, source: "receivable" },
  { day: 55, label: "Catch-up — Crescent", amount: 550_000, confidence: 0.6, source: "receivable" },
  { day: 60, label: "Aster settlement tranche", amount: 15_500_000, confidence: 0.55, source: "receivable" },
  { day: 62, label: "Catch-up — Summit", amount: 2_600_000, confidence: 0.6, source: "receivable" },
  { day: 69, label: "Catch-up — Indus", amount: 3_400_000, confidence: 0.6, source: "receivable" },
  { day: 76, label: "Catch-up — Orchard", amount: 3_400_000, confidence: 0.6, source: "receivable" },
  { day: 83, label: "Catch-up — Mercado", amount: 2_800_000, confidence: 0.5, source: "receivable" },
  { day: 88, label: "Misc receipts", amount: 300_000, confidence: 0.4, source: "customer" },
];

// ---------------------------------------------------------------------------
// Leaks — total recoverable ≈ ₹38.4L
// ---------------------------------------------------------------------------
export const leaks: Leak[] = [
  {
    id: "LK-01", category: "vendor-price-creep", title: "Vendor price creep — NovoTextiles (V-019)",
    amount: 960_000, frequency: "Annual", status: "open", vendorId: "V-019",
    detectedReason: "Quarterly price index on V-019 climbed 20.7% over 4 quarters while comparable raw-material vendors moved <3%. No renegotiation or rebid on record.",
    evidence: [
      { type: "vendor", id: "V-019", note: "Price index Q1 26 → Q1 27: 1.00 → 1.207", amount: 320_000 },
      { type: "po", id: "PO-1178", amount: 1_900_000, note: "Recent PO at inflated rate" },
    ],
    baselineComparison: "Vendor spend would be ₹9.6L/yr lower at Q1 26 pricing",
    confidence: 0.92,
  },
  {
    id: "LK-02", category: "unused-subscriptions", title: "Unused & underused subscriptions",
    amount: 620_000, frequency: "Annual", status: "open",
    detectedReason: "6 of 8 subscriptions show <30% seat utilisation or >60 days since last sign-in. Zombie licences billed monthly.",
    evidence: [
      { type: "subscription", id: "SUB-01", amount: 26_000, note: "Matrix CRM — 22/40 seats active, last use 95d ago" },
      { type: "subscription", id: "SUB-02", amount: 42_000, note: "CloudServ storage — 0 seats, last use 140d ago" },
      { type: "subscription", id: "SUB-05", amount: 24_000, note: "WorkBoard PM — 6/25 seats active" },
      { type: "subscription", id: "SUB-08", amount: 12_000, note: "VidBridge — 2/8 seats active" },
    ],
    baselineComparison: "Zombie licences alone represent ₹12.5L of committed annual spend",
    confidence: 0.95,
  },
  {
    id: "LK-03", category: "duplicate-invoices", title: "Duplicate payment — AP-INV-48291 / AP-INV-48294",
    amount: 450_000, frequency: "One-time", status: "open", vendorId: "V-014",
    detectedReason: "Two AP entries reference PO-1189 (Avon Logistics, ₹4.5L freight) with identical amount and overlapping dates, both settled. No separate delivery record for the second invoice.",
    evidence: [
      { type: "invoice", id: "AP-INV-48291", amount: 450_000, note: "Paid PAY-3104" },
      { type: "invoice", id: "AP-INV-48294", amount: 450_000, note: "Paid PAY-3110 — duplicate of AP-INV-48291" },
      { type: "po", id: "PO-1189", amount: 450_000, note: "Single freight shipment" },
    ],
    baselineComparison: "One freight shipment invoiced and paid twice",
    confidence: 0.97,
  },
  {
    id: "LK-04", category: "late-payment-penalties", title: "Late-payment penalties — Redstar Logistics",
    amount: 510_000, frequency: "Annual", status: "open", vendorId: "V-004",
    detectedReason: "12 of 14 vendor payments in the last two quarters settled 8–14 days past due date, incurring the 1.5%/mo penalty clause. 3 penalty invoices were silently absorbed into the next PO.",
    evidence: [
      { type: "vendor", id: "V-004", note: "1.5%/mo penalty clause; 86% late settlement rate" },
      { type: "invoice", id: "AP-INV-48310", amount: 2_800_000, note: "Open — penalty accruing" },
    ],
    baselineComparison: "No penalty invoices would accrue with on-time settlement",
    confidence: 0.85,
  },
  {
    id: "LK-05", category: "expense-anomalies", title: "Expense anomalies — no-PO supplies & duplicate travel",
    amount: 380_000, frequency: "Annual", status: "open",
    detectedReason: "₹4.8L 'supplies' payment to Hydra Utilities without a PO or purchase request; two travel claims from the same Sales trip within 24h, both reimbursed.",
    evidence: [
      { type: "expense", id: "EXP-3101", amount: 480_000, note: "No PO attached" },
      { type: "expense", id: "EXP-3102", amount: 210_000, note: "Claim A" },
      { type: "expense", id: "EXP-3103", amount: 96_000, note: "Claim B — overlapping dates" },
    ],
    baselineComparison: "Matched policies would have caught both patterns",
    confidence: 0.8,
  },
  {
    id: "LK-06", category: "receivable-leakage", title: "Receivable leakage — short pays & disputes",
    amount: 920_000, frequency: "Annual", status: "open",
    detectedReason: "Crescent Mart short-paid INV-24-2220 by ₹1.3L with no credit note; Summit Retail disputes ₹2.6L on delivery-quality grounds; 90+ day Aster exposure grows monthly.",
    evidence: [
      { type: "invoice", id: "INV-24-2220", amount: 3_400_000, note: "₹1.3L short-paid, no credit note" },
      { type: "invoice", id: "INV-24-2224", amount: 2_600_000, note: "Disputed" },
      { type: "invoice", id: "INV-24-2214", amount: 5_800_000, note: "90+ days" },
    ],
    baselineComparison: "Collection-cycle discipline would recover these within 60 days",
    confidence: 0.78,
  },
];

// ---------------------------------------------------------------------------
// Risks — causal chains drive Trace Cause
// ---------------------------------------------------------------------------
export const risks: Risk[] = [
  {
    id: "R-01",
    title: "Liquidity pressure",
    category: "liquidity",
    level: "critical",
    impact: 6_400_000,
    probability: 0.82,
    confidence: 0.9,
    horizonDays: 52,
    drivers: [
      "Aster Retail (28% of invoicing) withholding payments for 80+ days",
      "Collections near zero for the next 7 weeks under current behaviour",
      "₹88L working-capital loan installment due day 38",
      "Bulk inventory PO-1184 (₹70L) landing day 45",
    ],
    evidence: [
      { type: "customer", id: "C-001", note: "Payment behaviour 45 → 78 days" },
      { type: "invoice", id: "INV-24-2214", amount: 5_800_000, note: "90+ days overdue" },
      { type: "po", id: "PO-1184", amount: 7_000_000, note: "Bulk inventory order" },
      { type: "loan", id: "LN-091", note: "Working-capital facility, installment day 38" },
    ],
    recommendedAction: "Escalate Aster collections to settlement; defer PO-1184 to post-settlement; negotiate vendor terms to 60 days.",
    causalChain: [
      { id: "n1", label: "Delayed customer payments", metric: "Aster pays at 78d vs 45d terms", value: "1.55 Cr receivable aging" },
      { id: "n2", label: "Receivables aging increases", metric: "AR 90+ up 28% MoM", value: "58L in 90+ bucket", evidence: [{ type: "invoice", id: "INV-24-2214", amount: 5_800_000 }] },
      { id: "n3", label: "Expected cash inflow decreases", metric: "Collections ≈ 0 over 52 days", value: "−3.57 Cr vs plan" },
      { id: "n4", label: "Cash reserve declines", metric: "Cash ₹4.82 Cr → ₹61L", value: "below min-safe ₹1.25 Cr", evidence: [{ type: "po", id: "PO-1184", amount: 7_000_000 }] },
      { id: "n5", label: "AP obligations become exposed", metric: "Payroll + vendor run ₹26L/wk", value: "₹1.19 Cr due day 1–52" },
      { id: "n6", label: "Liquidity risk in 52 days", metric: "Breach below ₹1.25 Cr", value: "exposure ₹64L" },
    ],
    lastUpdated: iso(-1),
  },
  {
    id: "R-02",
    title: "Receivables deterioration",
    category: "receivables",
    level: "high",
    impact: 2_600_000,
    probability: 0.74,
    confidence: 0.86,
    horizonDays: 45,
    drivers: ["DSO 47 → 68 days", "Concentration: top-2 customers = 50% of AR", "Disputed invoices rising"],
    evidence: [
      { type: "customer", id: "C-001", note: "78-day behaviour vs 45-day terms" },
      { type: "invoice", id: "INV-24-2224", amount: 2_600_000, note: "Disputed" },
    ],
    recommendedAction: "Launch a collections task per customer over ₹1 Cr of AR; automate dunning; put new orders on hold for 90+ accounts.",
    causalChain: [
      { id: "n1", label: "Terms creep & withholding", metric: "Aster 78d, Crescent 51d", value: "behavior > terms" },
      { id: "n2", label: "DSO climbs", metric: "47 → 68 days", value: "+44%" },
      { id: "n3", label: "AR concentrates in 90+", metric: "58L in 90+ bucket", value: "28% MoM increase" },
      { id: "n4", label: "Expected inflow delays", metric: "collection window slips", value: "−₹2.9 Cr over 90d" },
    ],
    lastUpdated: iso(-2),
  },
  {
    id: "R-03",
    title: "Vendor cost escalation",
    category: "vendor",
    level: "high",
    impact: 960_000,
    probability: 0.88,
    confidence: 0.92,
    horizonDays: 90,
    drivers: ["NovoTextiles price index +20.7% over 4 quarters", "Single-source dependency", "No rebid in 14 months"],
    evidence: [
      { type: "vendor", id: "V-019", note: "Index 1.00 → 1.207" },
      { type: "po", id: "PO-1178", amount: 1_900_000, note: "At inflated pricing" },
    ],
    recommendedAction: "Create a vendor review workflow: rebid, dual-source, and claw back to index 1.05.",
    causalChain: [
      { id: "n1", label: "Quarterly price raises", metric: "+4.8% per quarter", value: "4 consecutive quarters" },
      { id: "n2", label: "Price index compounds", metric: "1.00 → 1.207", value: "+20.7%" },
      { id: "n3", label: "Vendor spend inflates", metric: "₹9.6L/yr over baseline", value: "V-019 + V-011" },
      { id: "n4", label: "Cash outflow creep", metric: "margin −0.7%", value: "60d forward impact" },
    ],
    lastUpdated: iso(-1),
  },
  {
    id: "R-04",
    title: "Duplicate invoice exposure",
    category: "duplicate",
    level: "medium",
    impact: 450_000,
    probability: 0.95,
    confidence: 0.97,
    horizonDays: 14,
    drivers: ["AP-INV-48291 / AP-INV-48294 both paid against PO-1189"],
    evidence: [
      { type: "invoice", id: "AP-INV-48291", amount: 450_000 },
      { type: "invoice", id: "AP-INV-48294", amount: 450_000, note: "duplicate" },
    ],
    recommendedAction: "Open a recovery workflow to reverse the second payment and add 2-way matching control.",
    causalChain: [
      { id: "n1", label: "Single shipment invoiced twice", metric: "PO-1189", value: "₹4.5L" },
      { id: "n2", label: "2-way matching gap", metric: "no delivery verification", value: "PO + invoice only" },
      { id: "n3", label: "Second payment settles", metric: "PAY-3110", value: "₹4.5L double-paid" },
      { id: "n4", label: "Recoverable leakage", metric: "confirmed", value: "₹4.5L" },
    ],
    lastUpdated: iso(0),
  },
  {
    id: "R-05",
    title: "Inventory cash burn",
    category: "inventory",
    level: "medium",
    impact: 1_400_000,
    probability: 0.6,
    confidence: 0.75,
    horizonDays: 60,
    drivers: ["PO volume +31% vs prior quarter", "PO-1184 ₹70L bulk order against falling cash", "Inventory holding days up"],
    evidence: [{ type: "po", id: "PO-1184", amount: 7_000_000, note: "Bulk restock" }],
    recommendedAction: "Hold PO-1184 until Aster settlement clears; right-size stock to 45 days.",
    causalChain: [
      { id: "n1", label: "Restock program accelerated", metric: "PO volume +31%", value: "₹70L bulk order" },
      { id: "n2", label: "Cash outflow spikes", metric: "day 45", value: "₹70L" },
      { id: "n3", label: "Trough deepens", metric: "cash ₹61L", value: "64L below floor" },
    ],
    lastUpdated: iso(-1),
  },
  {
    id: "R-06",
    title: "Subscription waste",
    category: "subscription",
    level: "low",
    impact: 620_000,
    probability: 0.9,
    confidence: 0.95,
    horizonDays: 90,
    drivers: ["4 zombie licences", "2 underused platforms", "No utilisation review in 2 quarters"],
    evidence: [{ type: "subscription", id: "SUB-01", amount: 26_000 }],
    recommendedAction: "Cancel zombie licences; renegotiate underused contracts to seat-based pricing.",
    causalChain: [
      { id: "n1", label: "Seat utilisation drops", metric: "<30% on 6 tools", value: "4 zombie" },
      { id: "n2", label: "Billing continues", metric: "monthly", value: "₹12.5L/yr committed" },
      { id: "n3", label: "Recoverable leakage", metric: "confirmed", value: "₹6.2L/yr" },
    ],
    lastUpdated: iso(-3),
  },
  {
    id: "R-07",
    title: "Late-payment penalties",
    category: "penalties",
    level: "low",
    impact: 510_000,
    probability: 0.8,
    confidence: 0.85,
    horizonDays: 90,
    drivers: ["86% of Redstar payments 8–14 days late", "1.5%/mo penalty clause"],
    evidence: [{ type: "vendor", id: "V-004", note: "penalty clause" }],
    recommendedAction: "Sequence AP runs to hit due dates; schedule payments 5 days ahead.",
    causalChain: [
      { id: "n1", label: "AP run timing slippage", metric: "8–14 days late", value: "86% of payments" },
      { id: "n2", label: "Penalty clause triggers", metric: "1.5%/mo", value: "₹5.1L/yr" },
    ],
    lastUpdated: iso(-4),
  },
];

// ---------------------------------------------------------------------------
// Workflows (seeded across states) + audit events
// ---------------------------------------------------------------------------
const now = new Date();
const wfAt = (daysAgo: number, h = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, 24, 0, 0);
  return d.toISOString();
};

export const workflows: Workflow[] = [
  {
    id: "WF-1001", type: "vendor-review", title: "Vendor review — NovoTextiles pricing", sourceRiskId: "R-03", sourceLeakId: "LK-01",
    status: "Awaiting Approval", createdAt: wfAt(3), approvals: [], owner: "P. Iyer",
    events: [
      { at: wfAt(3), status: "Detected", actor: "FinSight", note: "Price creep flagged" },
      { at: wfAt(3, 14), status: "Investigating", actor: "S. Rao", note: "Gathering pricing evidence" },
      { at: wfAt(1), status: "Awaiting Approval", actor: "P. Iyer", note: "Rebid proposal ready" },
    ],
    evidence: [{ type: "vendor", id: "V-019" }, { type: "po", id: "PO-1178" }],
    amount: 960_000, origin: "enterpro",
  },
  {
    id: "WF-1002", type: "recovery", title: "Recover duplicate payment — Avon Logistics", sourceRiskId: "R-04", sourceLeakId: "LK-03",
    status: "Investigating", createdAt: wfAt(1), approvals: [], owner: "K. Nair",
    events: [
      { at: wfAt(1), status: "Detected", actor: "FinSight", note: "Duplicate pair confirmed" },
      { at: wfAt(1, 16), status: "Investigating", actor: "K. Nair", note: "Verifying delivery records" },
    ],
    evidence: [{ type: "invoice", id: "AP-INV-48294" }, { type: "po", id: "PO-1189" }],
    amount: 450_000, origin: "enterpro",
  },
  {
    id: "WF-1003", type: "finance-task", title: "Subscription utilisation audit", sourceRiskId: "R-06", sourceLeakId: "LK-02",
    status: "Detected", createdAt: wfAt(0), approvals: [], owner: "P. Iyer",
    events: [{ at: wfAt(0), status: "Detected", actor: "FinSight", note: "4 zombie licences identified" }],
    evidence: [{ type: "subscription", id: "SUB-01" }],
    amount: 620_000, origin: "enterpro",
  },
  {
    id: "WF-1004", type: "hold-payment", title: "Hold bulk inventory PO-1184", sourceRiskId: "R-05",
    status: "Detected", createdAt: wfAt(0), approvals: [], owner: "K. Nair",
    events: [{ at: wfAt(0), status: "Detected", actor: "FinSight", note: "PO lands day 45 vs cash trough" }],
    evidence: [{ type: "po", id: "PO-1184" }],
    amount: 7_000_000, origin: "enterpro",
  },
  {
    id: "WF-1005", type: "collections-task", title: "Collections escalation — Aster Retail", sourceRiskId: "R-02",
    status: "Approved", createdAt: wfAt(6), approvals: [
      { approver: "A. Mehta", role: "Finance Manager", at: wfAt(4), note: "Escalate to settlement" },
    ], owner: "S. Rao",
    events: [
      { at: wfAt(6), status: "Detected", actor: "FinSight", note: "90+ exposure growing" },
      { at: wfAt(5), status: "Investigating", actor: "S. Rao" },
      { at: wfAt(4), status: "Awaiting Approval", actor: "S. Rao" },
      { at: wfAt(4, 18), status: "Approved", actor: "A. Mehta", note: "Approve escalation plan" },
    ],
    evidence: [{ type: "customer", id: "C-001" }, { type: "invoice", id: "INV-24-2214" }],
    amount: 15_500_000, origin: "enterpro",
  },
  {
    id: "WF-1006", type: "finance-task", title: "AP run timing review", sourceRiskId: "R-07", sourceLeakId: "LK-04",
    status: "Executed", createdAt: wfAt(10), approvals: [
      { approver: "A. Mehta", role: "Finance Manager", at: wfAt(8) },
      { approver: "D. Kulkarni", role: "CFO", at: wfAt(8, 12) },
    ], owner: "P. Iyer",
    events: [
      { at: wfAt(10), status: "Detected", actor: "FinSight", note: "86% late settlement" },
      { at: wfAt(9), status: "Investigating", actor: "P. Iyer" },
      { at: wfAt(8), status: "Awaiting Approval", actor: "P. Iyer" },
      { at: wfAt(8, 12), status: "Approved", actor: "D. Kulkarni" },
      { at: wfAt(6), status: "Executed", actor: "P. Iyer", note: "AP run re-sequenced 5 days ahead of due dates" },
    ],
    evidence: [{ type: "vendor", id: "V-004" }],
    amount: 510_000, origin: "enterpro",
  },
];

export const auditEvents: AuditEvent[] = [
  { id: "EV-9001", at: wfAt(6), actor: "FinSight", role: "System", action: "risk.traced", riskId: "R-02", workflowId: "WF-1005", outcome: "Causal chain traced", evidence: [{ type: "customer", id: "C-001" }] },
  { id: "EV-9002", at: wfAt(5), actor: "FinSight", role: "System", action: "workflow.created", workflowId: "WF-1005", outcome: "Collections task created", evidence: [{ type: "invoice", id: "INV-24-2214" }] },
  { id: "EV-9003", at: wfAt(4), actor: "A. Mehta", role: "Finance Manager", action: "workflow.status_changed", workflowId: "WF-1005", approvalState: "Approved", reason: "Escalate to settlement", evidence: [] },
  { id: "EV-9004", at: wfAt(3), actor: "FinSight", role: "System", action: "workflow.created", workflowId: "WF-1001", outcome: "Vendor review created from R-03", evidence: [{ type: "vendor", id: "V-019" }] },
  { id: "EV-9005", at: wfAt(1), actor: "FinSight", role: "System", action: "workflow.created", workflowId: "WF-1002", outcome: "Recovery workflow from LK-03", evidence: [{ type: "invoice", id: "AP-INV-48294" }] },
  { id: "EV-9006", at: wfAt(0), actor: "FinSight", role: "System", action: "workflow.created", workflowId: "WF-1003", outcome: "Subscription audit from LK-02", evidence: [{ type: "subscription", id: "SUB-01" }] },
  { id: "EV-9007", at: wfAt(8), actor: "D. Kulkarni", role: "CFO", action: "workflow.approved", workflowId: "WF-1006", approvalState: "Approved", reason: "AP timing fix", evidence: [] },
  { id: "EV-9008", at: wfAt(6), actor: "P. Iyer", role: "Finance", action: "workflow.executed", workflowId: "WF-1006", approvalState: "Executed", outcome: "AP run re-sequenced", evidence: [] },
  { id: "EV-9009", at: wfAt(2), actor: "A. Mehta", role: "Finance Manager", action: "risk.acknowledged", riskId: "R-01", reason: "Acknowledged liquidity trajectory", evidence: [] },
];

// ---------------------------------------------------------------------------
// Assembled seed state
// ---------------------------------------------------------------------------
export function buildSeedState(): FinSightState {
  return {
    customers,
    vendors,
    invoices,
    apInvoices,
    payments,
    purchaseOrders,
    expenses,
    budgets,
    subscriptions,
    receivables,
    cashHistory,
    projection,
    risks,
    leaks,
    workflows,
    auditEvents,
    minSafeCash: MIN_SAFE_CASH,
    currentCash: CURRENT_CASH,
    currency: "INR",
    aiMode: "fallback",
    currentUser: { name: "A. Mehta", role: "Finance Manager" },
  };
}
