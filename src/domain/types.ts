// ---------------------------------------------------------------------------
// FinSight domain types. All monetary values are in INR (whole rupees).
// Deterministic engine in engine.ts is the only source of numeric truth.
// ---------------------------------------------------------------------------

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type CaseType = "base" | "downside" | "upside";
export type LeakCategory =
  | "vendor-price-creep"
  | "unused-subscriptions"
  | "duplicate-invoices"
  | "late-payment-penalties"
  | "expense-anomalies"
  | "receivable-leakage";

export type WorkflowStatus =
  | "Detected"
  | "Investigating"
  | "Awaiting Approval"
  | "Approved"
  | "Executed";

export interface Customer {
  id: string;
  name: string;
  creditTermsDays: number;
  paymentBehaviorDays: number; // observed average days to pay
  concentrationPct: number; // share of monthly invoicing
  flag?: string;
}

export type VendorFlag =
  | "price-creep"
  | "bank-detail-change"
  | "duplicate-payment-risk"
  | "single-source";

export interface VendorPricePoint {
  quarter: string; // e.g. "Q1 26"
  index: number; // price index, baseline = 1.00
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  monthlySpend: number;
  priceTrend: VendorPricePoint[];
  flags: VendorFlag[];
  bankDetailsChanged: boolean;
  singleSource: boolean;
  riskIds: string[];
  leakIds: string[];
}

export type InvoiceStatus = "paid" | "partial" | "open" | "overdue" | "disputed";

export interface Invoice {
  id: string;
  customerId: string;
  amount: number;
  issuedAt: string; // ISO date
  dueAt: string;
  paidAt?: string;
  status: InvoiceStatus;
  poRef?: string;
  agingDays: number;
}

export interface ApInvoice {
  id: string;
  vendorId: string;
  poRef?: string;
  amount: number;
  receivedAt: string;
  dueAt: string;
  paidAt?: string;
  payRef?: string;
  status: "open" | "paid" | "disputed";
  duplicateOf?: string; // set when this entry is a duplicate of another
}

export interface Payment {
  id: string;
  invoiceId?: string;
  customerId: string;
  amount: number;
  receivedAt: string;
  method: string;
}

export type PoStatus = "open" | "approved" | "fulfilled" | "cancelled";

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  amount: number;
  status: PoStatus;
  issuedAt: string;
  expectedDelivery: string;
  paid: boolean;
}

export interface Expense {
  id: string;
  category: string;
  department: string;
  amount: number;
  date: string;
  vendorId?: string;
  subscriptionId?: string;
  status: "approved" | "pending" | "anomalous" | "rejected";
}

export interface Budget {
  department: string;
  period: string;
  allocated: number;
  spent: number;
}

export type SubscriptionStatus = "active" | "underused" | "zombie";

export interface Subscription {
  id: string;
  name: string;
  vendorId?: string;
  monthlyAmount: number;
  seats: number;
  activeSeats: number;
  lastUsedAt: string;
  status: SubscriptionStatus;
}

export interface Receivable {
  invoiceId: string;
  customerId: string;
  amount: number;
  ageBucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
}

export interface CashBalance {
  date: string;
  balance: number;
}

export interface ProjectionTranche {
  day: number;
  label: string;
  amount: number; // positive = inflow, negative = outflow
  confidence: number; // 0..1
  source: "receivable" | "customer" | "vendor" | "loan" | "po" | "opex" | "other";
}

export interface EvidenceRef {
  type:
    | "invoice"
    | "vendor"
    | "po"
    | "payment"
    | "expense"
    | "subscription"
    | "customer"
    | "budget"
    | "loan";
  id: string;
  amount?: number;
  note?: string;
}

export interface CausalNode {
  id: string;
  label: string;
  metric?: string;
  value?: string;
  evidence?: EvidenceRef[];
}

export type RiskCategory =
  | "liquidity"
  | "receivables"
  | "vendor"
  | "duplicate"
  | "subscription"
  | "inventory"
  | "penalties";

export interface Risk {
  id: string;
  title: string;
  category: RiskCategory;
  level: RiskLevel;
  impact: number; // INR at risk
  probability: number; // 0..1
  confidence: number; // 0..1
  horizonDays: number;
  drivers: string[];
  evidence: EvidenceRef[];
  recommendedAction: string;
  causalChain: CausalNode[];
  lastUpdated: string;
}

export interface Leak {
  id: string;
  category: LeakCategory;
  title: string;
  amount: number; // annualized recoverable INR
  frequency: string;
  detectedReason: string;
  evidence: EvidenceRef[];
  baselineComparison: string;
  confidence: number; // 0..1
  status: "open" | "recovering" | "recovered";
  vendorId?: string;
  workflowId?: string;
}

export interface Approval {
  approver: string;
  role: string;
  at: string;
  note?: string;
}

export interface WorkflowEvent {
  at: string;
  status: WorkflowStatus;
  actor: string;
  note?: string;
}

export type WorkflowType =
  | "approval"
  | "hold-payment"
  | "investigation"
  | "finance-task"
  | "vendor-review"
  | "collections-task"
  | "recovery";

export interface Workflow {
  id: string;
  type: WorkflowType;
  title: string;
  sourceRiskId?: string;
  sourceLeakId?: string;
  status: WorkflowStatus;
  createdAt: string;
  approvals: Approval[];
  events: WorkflowEvent[];
  evidence: EvidenceRef[];
  amount?: number;
  owner: string;
  origin: "enterpro" | "finsight";
}

export type AuditAction =
  | "risk.acknowledged"
  | "risk.traced"
  | "workflow.created"
  | "workflow.status_changed"
  | "workflow.approved"
  | "workflow.executed"
  | "leak.recovered"
  | "leak.recovery_initiated"
  | "simulation.run"
  | "analyst.question"
  | "analyst.answer"
  | "demo.loaded"
  | "demo.step";

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: AuditAction;
  reason?: string;
  evidence: EvidenceRef[];
  riskId?: string;
  workflowId?: string;
  approvalState?: string;
  outcome?: string;
  amount?: number;
}

export interface ScenarioInputs {
  revenueChangePct: number; // e.g. -15
  receivablesDelayDays: number; // extra days customers delay, 0..60
  vendorCostChangePct: number; // e.g. +8
  discretionarySpendChangePct: number; // e.g. -20
  inventorySpendChangePct: number; // e.g. +25
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  impact: number; // INR improvement over 90 days
  risk: "low" | "medium" | "high";
  complexity: "low" | "medium" | "high";
  appliesTo: Partial<Record<keyof ScenarioInputs, "mitigate">>;
  recommended?: boolean;
}

export interface DayPoint {
  day: number;
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
  isForecast: boolean;
}

export interface ForecastResult {
  series: DayPoint[];
  history: DayPoint[];
  minSafe: number;
  breachDay: number | null; // first day balance < minSafe (forecast segment)
  troughDay: number | null;
  troughBalance: number | null;
  liquidityExposure: number; // max shortfall vs minSafe
  day90Balance: number;
  endOfMonthBalances: { day: number; balance: number }[];
  drivers: string[];
  disclaimer: string;
}

export interface ScenarioResult {
  baseline: ForecastResult;
  scenario: ForecastResult;
  intervened: ForecastResult;
  intervention?: Strategy;
  optimal?: Strategy;
  ranked: Strategy[];
}

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  score: number; // 0..100
  contribution: number; // score * weight
  detail: string;
  signal: "positive" | "warn" | "danger";
}

export interface FinancialHealth {
  score: number; // 0..100
  grade: string;
  summary: string;
  components: ScoreComponent[];
}

export interface AnalystQuestion {
  id: string;
  prompt: string;
  at: string;
}

export interface AnalystAnswer {
  id: string;
  questionId: string;
  question: string;
  answer: string;
  metricsUsed: string[];
  evidence: EvidenceRef[];
  confidence: number; // 0..1
  recommendedActions: string[];
  limitations: string[];
  mode: "live" | "fallback";
}

export interface TraceCauseState {
  risk: Risk;
  step: number; // index of active causal node (-1 = idle, >=0 running)
  playing: boolean;
}

export interface FinSightState {
  customers: Customer[];
  vendors: Vendor[];
  invoices: Invoice[];
  apInvoices: ApInvoice[];
  payments: Payment[];
  purchaseOrders: PurchaseOrder[];
  expenses: Expense[];
  budgets: Budget[];
  subscriptions: Subscription[];
  receivables: Receivable[];
  cashHistory: CashBalance[];
  projection: ProjectionTranche[];
  risks: Risk[];
  leaks: Leak[];
  workflows: Workflow[];
  auditEvents: AuditEvent[];
  minSafeCash: number;
  currentCash: number;
  currency: "INR";
  aiMode: "live" | "fallback";
  currentUser: { name: string; role: string };
}
