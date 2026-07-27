import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { SaleAllocation } from "../lib/allocations";
import type { Customer, PaymentStatus, ShopData, Trip } from "../lib/types";

const empty: ShopData = {
  partners: [],
  customers: [],
  marbles: [],
  products: [],
  purchases: [],
  sales: [],
};

type ShopState = ShopData & {
  trips: Trip[];
  ready: boolean;
  error: string;
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
    allocations?: SaleAllocation[];
  }) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  saveSale: (input: {
    id?: string;
    productId: string;
    qty: number;
    unitPrice: number;
    description?: string;
    paymentStatus?: PaymentStatus;
    amountPaid?: number;
    customerId?: string | null;
    dueDate?: string | null;
    allocations?: SaleAllocation[];
  }) => Promise<void>;
  addCustomerLocal: (c: Customer) => void;
  addSalePayment: (id: string, amount: number, note?: string) => Promise<void>;
  markSalePaid: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
};

const ShopCtx = createContext<ShopState | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ShopData>(empty);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [shop, trip] = await Promise.all([api<ShopData>("/api/shop"), api<Trip[]>("/api/trips")]);
      setData(shop);
      setTrips(trip);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProductShares = useCallback(
    async (productId: string, shares: { partnerId: string; percent: number }[]) => {
      await api(`/api/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ shares }),
      });
      await refresh();
    },
    [refresh]
  );

  const saveMarble = useCallback(
    async (input: {
      id?: string;
      name: string;
      dimensions: string[];
      dimensionWeights: { dimension: string; sqFtPerTon: number }[];
    }) => {
      await api(input.id ? `/api/marbles/${input.id}` : "/api/marbles", {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const deleteMarble = useCallback(
    async (id: string) => {
      await api(`/api/marbles/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  const savePartner = useCallback(
    async (input: {
      id?: string;
      name: string;
      phone?: string;
      incomePercent?: number;
    }) => {
      await api(input.id ? `/api/partners/${input.id}` : "/api/partners", {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const deletePartner = useCallback(
    async (id: string) => {
      await api(`/api/partners/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  const saveCustomer = useCallback(
    async (input: { id?: string; name: string; phone: string }) => {
      await api(input.id ? `/api/customers/${input.id}` : "/api/customers", {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  const savePurchase = useCallback(
    async (input: {
      id?: string;
      productId: string;
      qty: number;
      unitCost: number;
      description?: string;
      allocations?: SaleAllocation[];
    }) => {
      await api(input.id ? `/api/purchases/${input.id}` : "/api/purchases", {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const deletePurchase = useCallback(
    async (id: string) => {
      await api(`/api/purchases/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  const saveSale = useCallback(
    async (input: {
      id?: string;
      productId: string;
      qty: number;
      unitPrice: number;
      description?: string;
      paymentStatus?: PaymentStatus;
      amountPaid?: number;
      customerId?: string | null;
      dueDate?: string | null;
      allocations?: SaleAllocation[];
    }) => {
      await api(input.id ? `/api/sales/${input.id}` : "/api/sales", {
        method: input.id ? "PATCH" : "POST",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const addCustomerLocal = useCallback((c: Customer) => {
    setData((prev) => ({
      ...prev,
      customers: prev.customers.some((x) => x.id === c.id)
        ? prev.customers
        : [...prev.customers, c].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, []);

  const addSalePayment = useCallback(
    async (id: string, amount: number, note = "") => {
      await api(`/api/sales/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ addPayment: amount, note }),
      });
      await refresh();
    },
    [refresh]
  );

  const markSalePaid = useCallback(
    async (id: string) => {
      await api(`/api/sales/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ markPaid: true }),
      });
      await refresh();
    },
    [refresh]
  );

  const deleteSale = useCallback(
    async (id: string) => {
      await api(`/api/sales/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  return (
    <ShopCtx.Provider
      value={{
        ...data,
        trips,
        ready,
        error,
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
      }}
    >
      {children}
    </ShopCtx.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopCtx);
  if (!ctx) throw new Error("useShop requires ShopProvider");
  return ctx;
}
