export type Partner = { id: string; name: string; phone: string; incomePercent: number };

export type Customer = { id: string; name: string; phone: string };

export type Marble = {
  id: string;
  name: string;
  dimensions: string[];
  dimensionWeights: { dimension: string; sqFtPerTon: number }[];
};

export type Product = {
  id: string;
  marbleId: string;
  name: string;
  dimension: string;
  sqFtPerTon: number;
  sku: string;
  stock: number;
  costPrice: number;
  costActual: number;
  costFreight: number;
  costLoss: number;
  sellPrice: number;
  lowStockAt: number;
  shares: { partnerId: string; percent: number }[];
};

export type Purchase = {
  id: string;
  productId: string;
  qty: number;
  unitCost: number;
  total: number;
  description: string;
  tripId?: string | null;
  date: string;
};

export type Trip = {
  id: string;
  note: string;
  truckFare: number;
  loadingCost: number;
  unloadingCost: number;
  expensesTotal: number;
  tons: number;
  date: string;
  lines: Purchase[];
};

export type PaymentStatus = "paid" | "partial" | "unpaid";

export type Sale = {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  total: number;
  costTotal: number;
  profit: number;
  description: string;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  payments: { id: string; amount: number; note: string; paidAt: string }[];
  allocations: { partnerId: string | null; qty: number }[];
  customerId: string | null;
  dueDate: string | null;
  paidAt: string | null;
  date: string;
};

export type ShopData = {
  partners: Partner[];
  customers: Customer[];
  marbles: Marble[];
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
};

export type PartnerLedgerEntry = {
  id: string;
  partnerId: string;
  type: "sale_share" | "payout" | "adjustment" | "investment" | "purchase_share";
  amount: number;
  qty: number;
  saleId: string | null;
  purchaseId?: string | null;
  productId: string | null;
  note: string;
  date: string;
};

export const productLabel = (p: Pick<Product, "name" | "dimension">) =>
  `${p.name} · ${p.dimension}`;

export const customerLabel = (c: Pick<Customer, "name" | "phone">) =>
  `${c.name} · ${c.phone}`;

/** Your ownership % (100 − partner shares). */
export const mySharePercent = (p: Pick<Product, "shares">) =>
  Math.max(0, 100 - (p.shares ?? []).reduce((s, x) => s + x.percent, 0));
