export type Partner = {
  id: string;
  name: string;
  phone: string;
  incomePercent: number;
};

export type ProductShare = {
  partnerId: string;
  percent: number;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  arrears: number;
};

export type SizeUnit = "sqft" | "piece";

export type Size = {
  id: string;
  label: string;
  unit: SizeUnit;
  sqFtPerTon: number;
};

export type Marble = {
  id: string;
  name: string;
  sizeIds: string[];
  dimensions: string[];
  dimensionWeights: { dimension: string; sqFtPerTon: number }[];
};

export type Product = {
  id: string;
  marbleId: string;
  sizeId: string | null;
  name: string;
  dimension: string;
  unit: SizeUnit;
  sqFtPerTon: number;
  sku: string;
  stock: number;
  costPrice: number;
  costActual: number;
  costFreight: number;
  costLoss: number;
  sellPrice: number;
  lowStockAt: number;
  shares: ProductShare[];
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

export type SalePayment = {
  id: string;
  amount: number;
  note: string;
  paidAt: string;
};

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
  payments: SalePayment[];
  allocations: { partnerId: string | null; qty: number }[];
  customerId: string | null;
  dueDate: string | null;
  paidAt: string | null;
  date: string;
};

export type PartnerLedgerEntry = {
  id: string;
  partnerId: string;
  type: "sale_share" | "payout" | "adjustment" | "investment" | "purchase_share" | "freight_share" | "loss_share" | "surplus_share" | "ownership_share";
  amount: number;
  qty: number;
  saleId: string | null;
  purchaseId?: string | null;
  productId: string | null;
  note: string;
  date: string;
};

export type Expense = {
  id: string;
  category: string;
  amount: number;
  description: string;
  spentAt: string;
  date: string;
};

export type ShopData = {
  partners: Partner[];
  customers: Customer[];
  sizes: Size[];
  marbles: Marble[];
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
};

export const productLabel = (p: Pick<Product, "name" | "dimension">) =>
  `${p.name} · ${p.dimension}`;

export const customerLabel = (c: Pick<Customer, "name" | "phone">) =>
  `${c.name} · ${c.phone}`;

/** Your ownership % (100 − partner shares). */
export const mySharePercent = (p: Pick<Product, "shares">) =>
  Math.max(0, 100 - (p.shares ?? []).reduce((s, x) => s + x.percent, 0));
