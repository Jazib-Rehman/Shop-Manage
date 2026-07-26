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
import type { ShopData } from "./types";

const empty: ShopData = {
  partners: [],
  customers: [],
  marbles: [],
  products: [],
  purchases: [],
  sales: [],
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
    dimensions: string[];
    dimensionWeights: { dimension: string; sqFtPerTon: number }[];
  }) => Promise<void>;
  deleteMarble: (id: string) => Promise<void>;
  savePartner: (input: {
    id?: string;
    name: string;
    phone?: string;
    incomePercent?: number;
  }) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;
  saveCustomer: (input: { id?: string; name: string; phone: string }) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
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
  markSalePaid: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
};

const ShopCtx = createContext<ShopApi | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo<ShopApi>(() => {
    const saveMarble = async (input: {
      id?: string;
      name: string;
      dimensions: string[];
      dimensionWeights: { dimension: string; sqFtPerTon: number }[];
    }) => {
      await api(input.id ? `/api/marbles/${input.id}` : "/api/marbles", {
        method: input.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          dimensions: input.dimensions,
          dimensionWeights: input.dimensionWeights,
        }),
      });
      await refresh();
    };

    const deleteMarble = async (id: string) => {
      await api(`/api/marbles/${id}`, { method: "DELETE" });
      await refresh();
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
      await api(input.id ? `/api/purchases/${input.id}` : "/api/purchases", {
        method: input.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await refresh();
    };

    const deletePurchase = async (id: string) => {
      await api(`/api/purchases/${id}`, { method: "DELETE" });
      await refresh();
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
      await api(input.id ? `/api/sales/${input.id}` : "/api/sales", {
        method: input.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await refresh();
    };

    const saveCustomer = async (input: { id?: string; name: string; phone: string }) => {
      await api(input.id ? `/api/customers/${input.id}` : "/api/customers", {
        method: input.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await refresh();
    };

    const deleteCustomer = async (id: string) => {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      await refresh();
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
      await api(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addPayment: amount, note }),
      });
      await refresh();
    };

    const markSalePaid = async (id: string) => {
      await api(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markPaid: true }),
      });
      await refresh();
    };

    const deleteSale = async (id: string) => {
      await api(`/api/sales/${id}`, { method: "DELETE" });
      await refresh();
    };

    const savePartner = async (input: {
      id?: string;
      name: string;
      phone?: string;
      incomePercent?: number;
    }) => {
      await api(input.id ? `/api/partners/${input.id}` : "/api/partners", {
        method: input.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await refresh();
    };

    const deletePartner = async (id: string) => {
      await api(`/api/partners/${id}`, { method: "DELETE" });
      await refresh();
    };

    const saveProductShares = async (
      productId: string,
      shares: { partnerId: string; percent: number }[]
    ) => {
      await api(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shares }),
      });
      await refresh();
    };

    return {
      ...data,
      ready,
      refresh,
      saveMarble,
      deleteMarble,
      savePartner,
      deletePartner,
      saveCustomer,
      deleteCustomer,
      saveProductShares,
      savePurchase,
      deletePurchase,
      saveSale,
      addCustomerLocal,
      addSalePayment,
      markSalePaid,
      deleteSale,
    };
  }, [data, ready, refresh]);

  return <ShopCtx.Provider value={value}>{children}</ShopCtx.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopCtx);
  if (!ctx) throw new Error("useShop requires ShopProvider");
  return ctx;
}
