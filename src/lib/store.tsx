"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAlert } from "@/components/Alert";
import type { ShopData } from "./types";

const empty: ShopData = {
  partners: [],
  customers: [],
  sizes: [],
  marbles: [],
  products: [],
  purchases: [],
  sales: [],
  expenses: [],
};

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

type ShopApi = ShopData & {
  ready: boolean;
  refresh: () => Promise<void>;
  saveMarble: (input: {
    id?: string;
    name: string;
    sizeIds: string[];
  }) => Promise<void>;
  deleteMarble: (id: string) => Promise<void>;
  saveSize: (input: {
    id?: string;
    label: string;
    unit: "sqft" | "piece";
    sqFtPerTon: number;
  }) => Promise<void>;
  deleteSize: (id: string) => Promise<void>;
  savePartner: (input: {
    id?: string;
    name: string;
    phone?: string;
    incomePercent?: number;
  }) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;
  saveCustomer: (input: {
    id?: string;
    name: string;
    phone: string;
    arrears?: number;
  }) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  saveExpense: (input: {
    id?: string;
    category: string;
    amount: number;
    description?: string;
  }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  saveProductShares: (
    productId: string,
    shares: { partnerId: string; percent: number }[]
  ) => Promise<void>;
  savePurchase: (input: {
    id?: string;
    productId: string;
    qty: number;
    unitCost: number;
    description?: string;
    shares?: { partnerId: string; percent: number }[];
    allocations?: { partnerId: string | null; qty: number }[];
  }) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  saveSale: (input: {
    id?: string;
    productId: string;
    qty: number;
    unitPrice: number;
    description?: string;
    paymentStatus?: "paid" | "partial" | "unpaid";
    amountPaid?: number;
    customerId?: string | null;
    dueDate?: string | null;
    allocations?: { partnerId: string | null; qty: number }[];
  }) => Promise<void>;
  addCustomerLocal: (c: ShopData["customers"][number]) => void;
  addSalePayment: (id: string, amount: number, note?: string) => Promise<void>;
  updateSalePayment: (
    saleId: string,
    paymentId: string,
    amount: number,
    note?: string
  ) => Promise<void>;
  deleteSalePayment: (saleId: string, paymentId: string) => Promise<void>;
  markSalePaid: (id: string, opts?: { quiet?: boolean }) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
};

const ShopCtx = createContext<ShopApi | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { toast } = useAlert();
  const [data, setData] = useState<ShopData>(empty);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/shop");
    if (!res.ok) throw new Error("Failed to load");
    setData(await res.json());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const mutate = useCallback(
    async (url: string, init: RequestInit | undefined, ok: string, quiet = false) => {
      try {
        const out = await api(url, init);
        if (!quiet) toast(ok, "success");
        await refresh();
        return out;
      } catch (err) {
        if (!quiet) toast(err instanceof Error ? err.message : "Request failed", "error");
        throw err;
      }
    },
    [refresh, toast]
  );

  const value = useMemo<ShopApi>(() => {
    const saveMarble = async (input: {
      id?: string;
      name: string;
      sizeIds: string[];
    }) => {
      await mutate(
        input.id ? `/api/marbles/${input.id}` : "/api/marbles",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            sizeIds: input.sizeIds,
          }),
        },
        input.id ? "Marble updated" : "Marble created"
      );
    };

    const deleteMarble = async (id: string) => {
      await mutate(`/api/marbles/${id}`, { method: "DELETE" }, "Marble deleted");
    };

    const saveSize = async (input: {
      id?: string;
      label: string;
      unit: "sqft" | "piece";
      sqFtPerTon: number;
    }) => {
      await mutate(
        input.id ? `/api/sizes/${input.id}` : "/api/sizes",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        input.id ? "Size updated" : "Size created"
      );
    };

    const deleteSize = async (id: string) => {
      await mutate(`/api/sizes/${id}`, { method: "DELETE" }, "Size deleted");
    };

    const savePurchase = async (input: {
      id?: string;
      productId: string;
      qty: number;
      unitCost: number;
      description?: string;
      shares?: { partnerId: string; percent: number }[];
      allocations?: { partnerId: string | null; qty: number }[];
    }) => {
      await mutate(
        input.id ? `/api/purchases/${input.id}` : "/api/purchases",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        input.id ? "Purchase updated" : "Purchase recorded"
      );
    };

    const deletePurchase = async (id: string) => {
      await mutate(`/api/purchases/${id}`, { method: "DELETE" }, "Purchase deleted");
    };

    const saveSale = async (input: {
      id?: string;
      productId: string;
      qty: number;
      unitPrice: number;
      description?: string;
      paymentStatus?: "paid" | "partial" | "unpaid";
      amountPaid?: number;
      customerId?: string | null;
      dueDate?: string | null;
      allocations?: { partnerId: string | null; qty: number }[];
    }) => {
      await mutate(
        input.id ? `/api/sales/${input.id}` : "/api/sales",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        input.id ? "Sale updated" : "Sale recorded"
      );
    };

    const saveCustomer = async (input: {
      id?: string;
      name: string;
      phone: string;
      arrears?: number;
    }) => {
      await mutate(
        input.id ? `/api/customers/${input.id}` : "/api/customers",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        input.id ? "Customer updated" : "Customer added"
      );
    };

    const deleteCustomer = async (id: string) => {
      await mutate(`/api/customers/${id}`, { method: "DELETE" }, "Customer deleted");
    };

    const saveExpense = async (input: {
      id?: string;
      category: string;
      amount: number;
      description?: string;
    }) => {
      await mutate(
        input.id ? `/api/expenses/${input.id}` : "/api/expenses",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        input.id ? "Expense updated" : "Expense recorded"
      );
    };

    const deleteExpense = async (id: string) => {
      await mutate(`/api/expenses/${id}`, { method: "DELETE" }, "Expense deleted");
    };

    const addCustomerLocal = (c: ShopData["customers"][number]) => {
      setData((prev) => ({
        ...prev,
        customers: prev.customers.some((x) => x.id === c.id)
          ? prev.customers
          : [...prev.customers, c].sort((a, b) => a.name.localeCompare(b.name)),
      }));
    };

    const addSalePayment = async (id: string, amount: number, note = "") => {
      await mutate(
        `/api/sales/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addPayment: amount, note }),
        },
        "Payment recorded"
      );
    };

    const updateSalePayment = async (
      saleId: string,
      paymentId: string,
      amount: number,
      note = ""
    ) => {
      await mutate(
        `/api/sales/${saleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updatePayment: { id: paymentId, amount, note } }),
        },
        "Payment updated"
      );
    };

    const deleteSalePayment = async (saleId: string, paymentId: string) => {
      await mutate(
        `/api/sales/${saleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deletePayment: paymentId }),
        },
        "Payment deleted"
      );
    };

    const markSalePaid = async (id: string, opts?: { quiet?: boolean }) => {
      await mutate(
        `/api/sales/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markPaid: true }),
        },
        "Sale settled",
        opts?.quiet
      );
    };

    const deleteSale = async (id: string) => {
      await mutate(`/api/sales/${id}`, { method: "DELETE" }, "Sale deleted");
    };

    const savePartner = async (input: {
      id?: string;
      name: string;
      phone?: string;
      incomePercent?: number;
    }) => {
      await mutate(
        input.id ? `/api/partners/${input.id}` : "/api/partners",
        {
          method: input.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        input.id ? "Partner updated" : "Partner added"
      );
    };

    const deletePartner = async (id: string) => {
      await mutate(`/api/partners/${id}`, { method: "DELETE" }, "Partner deleted");
    };

    const saveProductShares = async (
      productId: string,
      shares: { partnerId: string; percent: number }[]
    ) => {
      await mutate(
        `/api/products/${productId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shares }),
        },
        "Ownership updated"
      );
    };

    return {
      ...data,
      ready,
      refresh,
      saveMarble,
      deleteMarble,
      saveSize,
      deleteSize,
      savePartner,
      deletePartner,
      saveCustomer,
      deleteCustomer,
      saveExpense,
      deleteExpense,
      saveProductShares,
      savePurchase,
      deletePurchase,
      saveSale,
      addCustomerLocal,
      addSalePayment,
      updateSalePayment,
      deleteSalePayment,
      markSalePaid,
      deleteSale,
    };
  }, [data, ready, refresh, mutate]);

  return <ShopCtx.Provider value={value}>{children}</ShopCtx.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopCtx);
  if (!ctx) throw new Error("useShop requires ShopProvider");
  return ctx;
}
