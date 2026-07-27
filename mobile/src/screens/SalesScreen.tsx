import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomerPicker } from "../components/CustomerPicker";
import { ProductPicker } from "../components/ProductPicker";
import { Sheet } from "../components/Sheet";
import {
  allocDisplay,
  allocFromInput,
  defaultAllocations,
  type AllocUnit,
  type SaleAllocation,
} from "../lib/allocations";
import { money, sqft } from "../lib/calc";
import { remainingBalance } from "../lib/payment";
import { mySharePercent, productLabel, type PaymentStatus, type Sale } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

const statusColors: Record<PaymentStatus, { bg: string; fg: string }> = {
  paid: { bg: "#ecfdf5", fg: "#047857" },
  partial: { bg: "#f0f9ff", fg: "#0369a1" },
  unpaid: { bg: "#fffbeb", fg: "#92400e" },
};

const statusLabel: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.filterBlock}>
      <Text style={s.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value || "all"}
              onPress={() => onChange(o.value)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SalesScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);

  const [fName, setFName] = useState("");
  const [fSize, setFSize] = useState("");
  const [fCustomer, setFCustomer] = useState("");
  const [fStatus, setFStatus] = useState<"all" | PaymentStatus | "overdue">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [origQty, setOrigQty] = useState(0);
  const [origProductId, setOrigProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [description, setDescription] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [amountPaidNow, setAmountPaidNow] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [allocations, setAllocations] = useState<SaleAllocation[]>([]);
  const [allocUnit, setAllocUnit] = useState<AllocUnit>("sqft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [payOpen, setPayOpen] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const names = useMemo(
    () => [...new Set(shop.products.map((p) => p.name))].sort(),
    [shop.products]
  );
  const sizes = useMemo(
    () => [...new Set(shop.products.map((p) => p.dimension))].sort(),
    [shop.products]
  );

  const rows = useMemo(() => {
    const today = new Date(new Date().toDateString());
    return shop.sales.filter((r) => {
      const prod = shop.products.find((x) => x.id === r.productId);
      if (fName && prod?.name !== fName) return false;
      if (fSize && prod?.dimension !== fSize) return false;
      if (fCustomer && (r.customerId || "") !== fCustomer) return false;
      if (fStatus === "overdue") {
        if (r.paymentStatus === "paid" || !r.dueDate || new Date(r.dueDate) >= today) return false;
      } else if (fStatus !== "all" && r.paymentStatus !== fStatus) {
        return false;
      }
      if (fFrom && r.date.slice(0, 10) < fFrom) return false;
      if (fTo && r.date.slice(0, 10) > fTo) return false;
      if (fSearch) {
        const cust = shop.customers.find((c) => c.id === r.customerId)?.name || "";
        const hay = `${prod ? productLabel(prod) : ""} ${cust} ${r.description}`.toLowerCase();
        if (!hay.includes(fSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [shop.sales, shop.products, shop.customers, fName, fSize, fCustomer, fStatus, fFrom, fTo, fSearch]);

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const customerOf = (id: string | null) => {
    if (!id) return "—";
    return shop.customers.find((x) => x.id === id)?.name || "—";
  };

  const activeFilters = [fName, fSize, fCustomer, fStatus !== "all", fFrom, fTo, fSearch].filter(Boolean).length;
  const clearFilters = () => {
    setFName("");
    setFSize("");
    setFCustomer("");
    setFStatus("all");
    setFFrom("");
    setFTo("");
    setFSearch("");
  };

  const totalRev = rows.reduce((sum, r) => sum + r.total, 0);
  const totalDue = rows.reduce((sum, r) => sum + remainingBalance(r.total, r.amountPaid || 0), 0);
  const outstanding = shop.sales.filter((x) => x.paymentStatus !== "paid");
  const outstandingDue = outstanding.reduce(
    (sum, x) => sum + remainingBalance(x.total, x.amountPaid || 0),
    0
  );

  const reset = () => {
    setEditId(null);
    setOrigQty(0);
    setOrigProductId("");
    setProductId("");
    setQty("1");
    setUnitPrice("");
    setDescription("");
    setPaymentStatus("paid");
    setAmountPaidNow("");
    setCustomerId("");
    setDueDate("");
    setAllocations([]);
    setAllocUnit("sqft");
    setError("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (r: Sale) => {
    setEditId(r.id);
    setOrigQty(r.qty);
    setOrigProductId(r.productId);
    setProductId(r.productId);
    setQty(String(r.qty));
    setUnitPrice(String(r.unitPrice));
    setDescription(r.description || "");
    setPaymentStatus(r.paymentStatus || "paid");
    setAmountPaidNow(String(r.amountPaid || 0));
    setCustomerId(r.customerId || "");
    setDueDate(r.dueDate ? r.dueDate.slice(0, 10) : "");
    setAllocations([]);
    setError("");
    setOpen(true);
  };

  const syncAllocations = (nextQty: number, pid = productId) => {
    const p = shop.products.find((x) => x.id === pid);
    if (!p?.shares?.length) {
      setAllocations([{ partnerId: null, qty: nextQty }]);
      return;
    }
    setAllocations(defaultAllocations(nextQty, p));
  };

  const onProduct = (id: string) => {
    setProductId(id);
    const p = shop.products.find((x) => x.id === id);
    if (p && !editId) {
      setUnitPrice(String(p.sellPrice || 0));
      setAllocations(defaultAllocations(Number(qty) || 0, p));
    }
    setError("");
  };

  const selected = shop.products.find((p) => p.id === productId);
  const qNum = Number(qty) || 0;
  const priceNum = Number(unitPrice) || 0;
  const revenue = qNum * priceNum;
  const cogs = qNum * (selected?.costPrice ?? 0);
  const profit = revenue - cogs;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const available =
    selected && editId && productId === origProductId
      ? selected.stock + origQty
      : selected?.stock ?? 0;
  const stockAfter = available - qNum;
  const paidNowNum =
    paymentStatus === "paid"
      ? revenue
      : paymentStatus === "partial"
        ? Math.min(Number(amountPaidNow) || 0, revenue)
        : 0;
  const allocSum = allocations.reduce((sum, a) => sum + a.qty, 0);

  const onSubmit = async () => {
    const q = Number(qty);
    const price = Number(unitPrice);
    if (!productId || q <= 0 || price < 0) return;
    if (!editId && q > available) {
      setError(`Only ${sqft(available)} available`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shop.saveSale({
        id: editId ?? undefined,
        productId,
        qty: q,
        unitPrice: price,
        description,
        paymentStatus,
        amountPaid: paymentStatus === "partial" ? Number(amountPaidNow) || 0 : undefined,
        customerId: customerId || null,
        dueDate: paymentStatus !== "paid" && dueDate ? dueDate : null,
        allocations:
          selected?.shares?.length
            ? allocations.length > 1
              ? allocations
              : defaultAllocations(q, selected)
            : undefined,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const openPay = (r: Sale) => {
    setPayOpen(r);
    setPayAmount(String(remainingBalance(r.total, r.amountPaid || 0)));
    setPayNote("");
  };

  const onPaySubmit = async () => {
    if (!payOpen) return;
    setSaving(true);
    try {
      await shop.addSalePayment(payOpen.id, Number(payAmount), payNote);
      setPayOpen(null);
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const onMarkPaid = (r: Sale) => {
    const due = remainingBalance(r.total, r.amountPaid || 0);
    Alert.alert(`Settle remaining ${money(due)}?`, "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Settle",
        onPress: async () => {
          try {
            await shop.markSalePaid(r.id);
          } catch (err) {
            Alert.alert(err instanceof Error ? err.message : "Update failed");
          }
        },
      },
    ]);
  };

  const onDelete = (r: Sale) => {
    Alert.alert(`Delete sale of ${sqft(r.qty)}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await shop.deleteSale(r.id);
          } catch (err) {
            Alert.alert(err instanceof Error ? err.message : "Delete failed");
          }
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await shop.refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={s.header}>
          <View style={s.headIcon}>
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
          </View>
          <View style={s.flex1}>
            <Text style={s.h1}>Sales</Text>
            <Text style={s.hSub}>
              {rows.length} of {shop.sales.length} · {money(totalRev)}
              {totalDue > 0 ? ` · due ${money(totalDue)}` : ""}
            </Text>
          </View>
        </View>

        <Pressable
          style={[s.newBtn, !shop.products.length && s.disabled]}
          disabled={!shop.products.length}
          onPress={openCreate}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>New sale</Text>
        </Pressable>

        {outstanding.length > 0 && (
          <View style={s.openBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#b45309" />
            <Text style={s.openBannerText}>
              <Text style={s.bold}>{outstanding.length} open</Text> · Due {money(outstandingDue)}
            </Text>
          </View>
        )}

        <View style={s.filterCard}>
          <View style={s.filterHead}>
            <View style={s.rowGap}>
              <Ionicons name="funnel-outline" size={15} color={colors.muted} />
              <Text style={s.filterTitle}>FILTERS</Text>
            </View>
            <View style={s.rowGap}>
              {activeFilters > 0 && (
                <Pressable onPress={clearFilters} hitSlop={8}>
                  <Text style={s.clearLink}>Clear ({activeFilters})</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setFiltersOpen((o) => !o)} style={s.showBtn}>
                <Text style={s.showBtnText}>{filtersOpen ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
          </View>

          {filtersOpen && (
            <View style={s.filterBody}>
              <View style={s.filterBlock}>
                <Text style={s.filterLabel}>Search</Text>
                <TextInput
                  style={s.input}
                  value={fSearch}
                  onChangeText={setFSearch}
                  placeholder="Marble, customer…"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <ChipRow
                label="Marble"
                value={fName}
                onChange={setFName}
                options={[{ value: "", label: "All" }, ...names.map((n) => ({ value: n, label: n }))]}
              />
              <ChipRow
                label="Size"
                value={fSize}
                onChange={setFSize}
                options={[{ value: "", label: "All" }, ...sizes.map((d) => ({ value: d, label: d }))]}
              />
              {shop.customers.length > 0 && (
                <ChipRow
                  label="Customer"
                  value={fCustomer}
                  onChange={setFCustomer}
                  options={[
                    { value: "", label: "All" },
                    ...shop.customers.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
              <ChipRow
                label="Status"
                value={fStatus}
                onChange={setFStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "paid", label: "Paid" },
                  { value: "partial", label: "Partial" },
                  { value: "unpaid", label: "Unpaid" },
                  { value: "overdue", label: "Overdue" },
                ]}
              />
              <View style={s.dateRow}>
                <View style={[s.filterBlock, s.flex1]}>
                  <Text style={s.filterLabel}>From (YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    value={fFrom}
                    onChangeText={setFFrom}
                    placeholder="2026-01-01"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                </View>
                <View style={[s.filterBlock, s.flex1]}>
                  <Text style={s.filterLabel}>To</Text>
                  <TextInput
                    style={s.input}
                    value={fTo}
                    onChangeText={setFTo}
                    placeholder="2026-12-31"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>
          )}
        </View>

        {rows.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>
              {shop.sales.length === 0 ? "No sales yet" : "No matches"}
            </Text>
          </View>
        ) : (
          rows.map((r) => {
            const due = remainingBalance(r.total, r.amountPaid || 0);
            const overdue =
              r.paymentStatus !== "paid" &&
              r.dueDate &&
              new Date(r.dueDate) < new Date(new Date().toDateString());
            const prod = shop.products.find((x) => x.id === r.productId);
            const st = statusColors[r.paymentStatus];
            return (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.flex1}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {prod?.name ?? "—"}
                    </Text>
                    {!!prod && <Text style={s.cardDim}>{prod.dimension}</Text>}
                    <Text style={s.cardMeta}>
                      {new Date(r.date).toLocaleDateString()} · {customerOf(r.customerId)}
                    </Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.cardTotal}>{money(r.total)}</Text>
                    <View style={[s.badge, { backgroundColor: st.bg }]}>
                      <Text style={[s.badgeText, { color: st.fg }]}>
                        {statusLabel[r.paymentStatus]}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={s.statRow}>
                  <View style={s.stat}>
                    <Text style={s.statKey}>Paid</Text>
                    <Text style={s.statVal}>{money(r.amountPaid || 0)}</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statKey}>Due</Text>
                    <Text style={[s.statVal, due > 0 && { color: "#92400e" }]}>{money(due)}</Text>
                    {!!r.dueDate && r.paymentStatus !== "paid" && (
                      <Text style={[s.dueBy, overdue && { color: colors.danger }]}>
                        by {new Date(r.dueDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={s.actions}>
                  {r.paymentStatus !== "paid" && (
                    <>
                      <Pressable style={s.payBtn} onPress={() => openPay(r)}>
                        <Text style={s.payText}>Pay</Text>
                      </Pressable>
                      <Pressable style={s.settleBtn} onPress={() => onMarkPaid(r)}>
                        <Text style={s.settleText}>Settle</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable style={s.editBtn} onPress={() => openEdit(r)}>
                    <Text style={s.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={s.deleteBtn} onPress={() => onDelete(r)}>
                    <Text style={s.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Sheet
        open={open}
        onClose={close}
        title={editId ? "Edit sale" : "New sale"}
        subtitle="Stock updates now · payment can be split"
        footer={
          <>
            <Pressable style={s.ghostBtn} onPress={close}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, (saving || (!editId && !productId)) && s.disabled]}
              disabled={saving || (!editId && !productId)}
              onPress={onSubmit}
            >
              <Text style={s.primaryBtnText}>
                {saving ? "Saving…" : editId ? "Save changes" : "Record sale"}
              </Text>
            </Pressable>
          </>
        }
      >
        {!editId ? (
          <>
            <View style={s.filterBlock}>
              <Text style={s.filterLabel}>Marble · size</Text>
              <ProductPicker
                products={shop.products.filter((p) => p.stock > 0)}
                value={productId}
                onChange={onProduct}
              />
              {!!selected && <Text style={s.hint}>{sqft(available)} available</Text>}
            </View>

            <View style={s.dateRow}>
              <View style={[s.filterBlock, s.flex1]}>
                <Text style={s.filterLabel}>Qty (sq ft)</Text>
                <TextInput
                  style={s.input}
                  value={qty}
                  keyboardType="decimal-pad"
                  onChangeText={(t) => {
                    const n = Math.min(Number(t) || 0, available || 0);
                    setQty(t === "" ? "" : String(n));
                    syncAllocations(n);
                  }}
                />
              </View>
              <View style={[s.filterBlock, s.flex1]}>
                <Text style={s.filterLabel}>Price / ft</Text>
                <TextInput
                  style={s.input}
                  value={unitPrice}
                  keyboardType="decimal-pad"
                  onChangeText={setUnitPrice}
                />
              </View>
            </View>

            {allocations.length > 1 && (
              <View style={s.allocBox}>
                <Text style={s.allocTitle}>Sold from whose share?</Text>
                <Text style={s.allocHint}>Defaults to ownership %. Sum must equal qty.</Text>
                <View style={s.unitRow}>
                  {(
                    [
                      ["percent", "%"],
                      ["sqft", "sq ft"],
                      ["amount", "Rs"],
                    ] as const
                  ).map(([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() => setAllocUnit(key)}
                      style={[s.unitChip, allocUnit === key && s.unitChipActive]}
                    >
                      <Text style={[s.unitText, allocUnit === key && s.unitTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {allocations.map((a, i) => {
                  const label = a.partnerId
                    ? shop.partners.find((p) => p.id === a.partnerId)?.name || "Partner"
                    : "You";
                  const display = allocDisplay(a.qty, allocUnit, qNum, priceNum);
                  return (
                    <View key={`${a.partnerId ?? "me"}-${i}`} style={s.allocRow}>
                      <Text style={s.allocName}>{label}</Text>
                      <TextInput
                        style={s.input}
                        keyboardType="decimal-pad"
                        value={String(Number(display.toFixed(2)))}
                        onChangeText={(t) => {
                          const next = [...allocations];
                          next[i] = {
                            ...next[i],
                            qty: allocFromInput(Number(t) || 0, allocUnit, qNum, priceNum),
                          };
                          setAllocations(next);
                        }}
                      />
                      <Text style={s.allocMeta}>
                        {allocUnit !== "sqft" ? `${sqft(a.qty)} · ` : ""}
                        {money(a.qty * priceNum)}
                      </Text>
                    </View>
                  );
                })}
                <Text
                  style={[
                    s.allocSum,
                    Math.abs(allocSum - qNum) > 0.02 ? { color: colors.danger } : null,
                  ]}
                >
                  Allocated {sqft(allocSum)} / {sqft(qNum)}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={s.editSummary}>
            <Text style={s.editSummaryText}>
              {selected ? productLabel(selected) : "—"} · {sqft(qNum)} · {money(revenue)}
            </Text>
          </View>
        )}

        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Payment</Text>
          {!editId && (
            <View style={s.unitRow}>
              {(
                [
                  ["paid", "Paid full"],
                  ["partial", "Partial"],
                  ["unpaid", "Unpaid"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setPaymentStatus(key)}
                  style={[s.unitChip, paymentStatus === key && s.unitChipActive]}
                >
                  <Text style={[s.unitText, paymentStatus === key && s.unitTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {!editId && paymentStatus === "partial" && (
          <View style={s.filterBlock}>
            <Text style={s.filterLabel}>Amount paid now</Text>
            <TextInput
              style={s.input}
              value={amountPaidNow}
              keyboardType="decimal-pad"
              onChangeText={setAmountPaidNow}
            />
            <Text style={s.hint}>
              Remaining {money(Math.max(0, revenue - (Number(amountPaidNow) || 0)))}
            </Text>
          </View>
        )}

        {paymentStatus !== "paid" && (
          <>
            <View style={s.filterBlock}>
              <Text style={s.filterLabel}>Customer</Text>
              <CustomerPicker
                customers={shop.customers}
                value={customerId}
                onChange={setCustomerId}
                onCreated={shop.addCustomerLocal}
              />
            </View>
            <View style={s.filterBlock}>
              <Text style={s.filterLabel}>Due date (YYYY-MM-DD)</Text>
              <TextInput
                style={s.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2026-08-01"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Description</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {!editId && (
          <View style={s.summary}>
            <Text style={s.summaryTitle}>SUMMARY</Text>
            <View style={s.dRow}>
              <Text style={s.dKey}>Total</Text>
              <Text style={s.dVal}>{money(revenue)}</Text>
            </View>
            <View style={s.dRow}>
              <Text style={s.dKey}>Paid now</Text>
              <Text style={s.dVal}>{money(paidNowNum)}</Text>
            </View>
            <View style={s.dRow}>
              <Text style={s.dKey}>Balance due</Text>
              <Text style={s.dVal}>{money(Math.max(0, revenue - paidNowNum))}</Text>
            </View>
            <View style={[s.dRow, s.dRowTop]}>
              <Text style={s.dKeyStrong}>Gross profit</Text>
              <Text style={[s.dValStrong, { color: "#047857" }]}>{money(profit)}</Text>
            </View>
            <View style={s.dRow}>
              <Text style={s.dKey}>Margin</Text>
              <Text style={s.dVal}>{margin.toFixed(1)}%</Text>
            </View>
            {!!selected && (
              <View style={s.dRow}>
                <Text style={s.dKey}>Stock after</Text>
                <Text style={s.dVal}>{sqft(Math.max(0, stockAfter))}</Text>
              </View>
            )}
          </View>
        )}

        {!!error && <Text style={s.error}>{error}</Text>}
      </Sheet>

      <Sheet
        open={!!payOpen}
        onClose={() => setPayOpen(null)}
        title="Add payment"
        subtitle={
          payOpen
            ? `${customerOf(payOpen.customerId)} · due ${money(
                remainingBalance(payOpen.total, payOpen.amountPaid || 0)
              )}`
            : undefined
        }
        footer={
          <>
            <Pressable style={s.ghostBtn} onPress={() => setPayOpen(null)}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, saving && s.disabled]}
              disabled={saving}
              onPress={onPaySubmit}
            >
              <Text style={s.primaryBtnText}>{saving ? "Saving…" : "Record payment"}</Text>
            </Pressable>
          </>
        }
      >
        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Amount (Rs)</Text>
          <TextInput
            style={s.input}
            value={payAmount}
            keyboardType="decimal-pad"
            onChangeText={setPayAmount}
          />
        </View>
        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Note</Text>
          <TextInput
            style={s.input}
            value={payNote}
            onChangeText={setPayNote}
            placeholder="Installment 2, cash, etc."
            placeholderTextColor={colors.muted}
          />
        </View>
        {!!payOpen?.payments.length && (
          <View style={s.payHistory}>
            {payOpen.payments.map((p) => (
              <View key={p.id} style={s.dRow}>
                <Text style={s.dKey}>
                  {new Date(p.paidAt).toLocaleDateString()}
                  {p.note ? ` · ${p.note}` : ""}
                </Text>
                <Text style={s.dVal}>{money(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  flex1: { flex: 1 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  bold: { fontWeight: "700" },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 24, fontWeight: "700", color: colors.text },
  hSub: { fontSize: 13, color: colors.muted, marginTop: 2 },

  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  newBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  openBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  openBannerText: { fontSize: 14, color: "#451a03", flex: 1 },

  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  filterHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.6 },
  clearLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
  showBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  showBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
  filterBody: {
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    padding: 12,
    gap: 12,
  },
  filterBlock: { gap: 6 },
  filterLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  chipRow: { gap: 8, paddingRight: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  dateRow: { flexDirection: "row", gap: 10 },
  hint: { fontSize: 12, color: colors.muted },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 36,
  },
  emptyText: { textAlign: "center", color: colors.muted, fontSize: 14 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardDim: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  cardTotal: { fontSize: 17, fontWeight: "700", color: colors.text },
  badge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statKey: { fontSize: 11, fontWeight: "600", color: colors.muted },
  statVal: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
  dueBy: { fontSize: 11, color: colors.muted, marginTop: 2 },

  actions: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#f4f4f5", paddingTop: 10 },
  payBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 9,
    paddingVertical: 9,
  },
  payText: { fontSize: 13, fontWeight: "600", color: "#0369a1" },
  settleBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 9,
    paddingVertical: 9,
  },
  settleText: { fontSize: 13, fontWeight: "600", color: "#047857" },
  editBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 9,
    paddingVertical: 9,
  },
  editText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  deleteBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 9,
    paddingVertical: 9,
  },
  deleteText: { fontSize: 13, fontWeight: "600", color: colors.danger },

  allocBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  allocTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  allocHint: { fontSize: 12, color: colors.muted },
  unitRow: { flexDirection: "row", gap: 8 },
  unitChip: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 8,
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontSize: 13, fontWeight: "600", color: colors.text },
  unitTextActive: { color: "#fff" },
  allocRow: { gap: 6 },
  allocName: { fontSize: 14, fontWeight: "600", color: colors.text },
  allocMeta: { fontSize: 12, color: colors.muted },
  allocSum: { fontSize: 13, fontWeight: "600", color: colors.muted },

  editSummary: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editSummaryText: { fontSize: 15, fontWeight: "600", color: colors.text },

  summary: {
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 12,
    gap: 8,
  },
  summaryTitle: { fontSize: 12, fontWeight: "700", color: colors.primaryDark, letterSpacing: 0.5 },
  dRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  dRowTop: { borderTopWidth: 1, borderTopColor: "#99f6e4", paddingTop: 8 },
  dKey: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  dVal: { fontSize: 14, fontWeight: "600", color: colors.text },
  dKeyStrong: { fontSize: 15, fontWeight: "700", color: colors.text },
  dValStrong: { fontSize: 16, fontWeight: "700", color: colors.text },

  payHistory: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  ghostBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  ghostBtnText: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.6 },
  error: {
    color: colors.danger,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
  },
});
