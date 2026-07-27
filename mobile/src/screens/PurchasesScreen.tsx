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
import { ProductPicker } from "../components/ProductPicker";
import { Sheet } from "../components/Sheet";
import {
  allocDisplay,
  allocFromInput,
  defaultAllocations,
  validateAllocations,
  type AllocUnit,
  type SaleAllocation,
} from "../lib/allocations";
import { money, sqft } from "../lib/calc";
import { productLabel, type Purchase } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

type SortKey = "date" | "qty" | "unitCost" | "total";

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

export function PurchasesScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);

  const [fName, setFName] = useState("");
  const [fSize, setFSize] = useState("");
  const [fSource, setFSource] = useState<"all" | "trip" | "standalone">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [origQty, setOrigQty] = useState(0);
  const [origProductId, setOrigProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [description, setDescription] = useState("");
  const [allocations, setAllocations] = useState<SaleAllocation[]>([]);
  const [allocUnit, setAllocUnit] = useState<AllocUnit>("percent");
  const [shareWith, setShareWith] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const names = useMemo(
    () => [...new Set(shop.products.map((p) => p.name))].sort(),
    [shop.products]
  );
  const sizes = useMemo(
    () => [...new Set(shop.products.map((p) => p.dimension))].sort(),
    [shop.products]
  );

  const rows = useMemo(() => {
    const list = shop.purchases.filter((r) => {
      const prod = shop.products.find((x) => x.id === r.productId);
      if (fName && prod?.name !== fName) return false;
      if (fSize && prod?.dimension !== fSize) return false;
      if (fSource === "trip" && !r.tripId) return false;
      if (fSource === "standalone" && r.tripId) return false;
      if (fFrom && r.date.slice(0, 10) < fFrom) return false;
      if (fTo && r.date.slice(0, 10) > fTo) return false;
      if (fSearch) {
        const hay = `${prod ? productLabel(prod) : ""} ${r.description}`.toLowerCase();
        if (!hay.includes(fSearch.toLowerCase())) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const val = (r: Purchase) =>
        sortKey === "date" ? new Date(r.date).getTime() : r[sortKey];
      const d = Number(val(a)) - Number(val(b));
      return sortDir === "desc" ? -d : d;
    });
  }, [shop.purchases, shop.products, fName, fSize, fSource, fFrom, fTo, fSearch, sortKey, sortDir]);

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeFilters = [fName, fSize, fSource !== "all", fFrom, fTo, fSearch].filter(Boolean).length;
  const clearFilters = () => {
    setFName("");
    setFSize("");
    setFSource("all");
    setFFrom("");
    setFTo("");
    setFSearch("");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalSpend = rows.reduce((sum, r) => sum + r.total, 0);

  const reset = () => {
    setEditId(null);
    setOrigQty(0);
    setOrigProductId("");
    setProductId("");
    setQty("1");
    setUnitCost("");
    setDescription("");
    setAllocations([]);
    setAllocUnit("percent");
    setShareWith(false);
    setError("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const syncAllocations = (q: number, productIdHint = productId) => {
    const p = shop.products.find((x) => x.id === productIdHint);
    if (!p) {
      setAllocations([{ partnerId: null, qty: q }]);
      return;
    }
    if (p.shares?.length) {
      setAllocations(defaultAllocations(q, p));
      return;
    }
    setAllocations([
      { partnerId: null, qty: q },
      ...shop.partners.map((partner) => ({ partnerId: partner.id, qty: 0 })),
    ]);
  };

  const onProduct = (id: string) => {
    setProductId(id);
    const p = shop.products.find((x) => x.id === id);
    if (p && !editId) {
      setUnitCost(String(p.costPrice));
      if (shareWith) syncAllocations(Number(qty) || 0, id);
    }
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (r: Purchase) => {
    setEditId(r.id);
    setOrigQty(r.qty);
    setOrigProductId(r.productId);
    setProductId(r.productId);
    setQty(String(r.qty));
    setUnitCost(String(r.unitCost));
    setDescription(r.description || "");
    setError("");
    setOpen(true);
  };

  const onSubmit = async () => {
    const q = Number(qty);
    const c = Number(unitCost);
    if (!productId || q <= 0 || c < 0) return;
    if (!editId && shareWith) {
      const err = validateAllocations(q, allocations);
      if (err) {
        setError(err);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await shop.savePurchase({
        id: editId ?? undefined,
        productId,
        qty: q,
        unitCost: c,
        description,
        ...(!editId
          ? {
              allocations: shareWith
                ? allocations
                : [{ partnerId: null, qty: q }],
            }
          : {}),
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (r: Purchase) => {
    Alert.alert(`Delete purchase of ${sqft(r.qty)}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await shop.deletePurchase(r.id);
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

  const qNum = Number(qty) || 0;
  const costNum = Number(unitCost) || 0;
  const totalCost = qNum * costNum;
  const selected = shop.products.find((p) => p.id === productId);
  const stockBase =
    selected && editId && productId === origProductId
      ? selected.stock - origQty
      : selected?.stock ?? 0;
  const stockAfter = Math.max(0, stockBase + qNum);
  const allocSum = allocations.reduce((sum, a) => sum + a.qty, 0);

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
            <Ionicons name="cart-outline" size={20} color={colors.primary} />
          </View>
          <View style={s.flex1}>
            <Text style={s.h1}>Purchases</Text>
            <Text style={s.hSub}>
              {rows.length} of {shop.purchases.length} · {sqft(totalQty)} · {money(totalSpend)}
            </Text>
          </View>
        </View>

        <Pressable
          style={[s.newBtn, !shop.products.length && s.disabled]}
          disabled={!shop.products.length}
          onPress={openCreate}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>New purchase</Text>
        </Pressable>

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
                  placeholder="Marble or note…"
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
              <ChipRow
                label="Source"
                value={fSource}
                onChange={setFSource}
                options={[
                  { value: "all", label: "All" },
                  { value: "trip", label: "From a trip" },
                  { value: "standalone", label: "Standalone" },
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

        <View style={s.sortRow}>
          <Text style={s.sortLabel}>Sort</Text>
          {(
            [
              ["date", "Date"],
              ["qty", "Qty"],
              ["unitCost", "Price"],
              ["total", "Total"],
            ] as const
          ).map(([key, label]) => {
            const active = sortKey === key;
            return (
              <Pressable
                key={key}
                onPress={() => toggleSort(key)}
                style={[s.sortChip, active && s.sortChipActive]}
              >
                <Text style={[s.sortChipText, active && s.sortChipTextActive]}>
                  {label}
                  {active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {rows.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>
              {shop.purchases.length === 0 ? "No purchases yet" : "No matches"}
            </Text>
          </View>
        ) : (
          rows.map((r) => {
            const prod = shop.products.find((x) => x.id === r.productId);
            return (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.flex1}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {prod?.name ?? "—"}
                    </Text>
                    {!!prod && <Text style={s.cardDim}>{prod.dimension}</Text>}
                    <Text style={s.cardMeta}>
                      {new Date(r.date).toLocaleDateString()}
                      {r.tripId ? " · Trip" : " · Standalone"}
                    </Text>
                  </View>
                  <Text style={s.cardTotal}>{money(r.total)}</Text>
                </View>

                <View style={s.statRow}>
                  <View style={s.stat}>
                    <Text style={s.statKey}>Qty</Text>
                    <Text style={s.statVal}>{sqft(r.qty)}</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statKey}>Price / ft</Text>
                    <Text style={s.statVal}>{money(r.unitCost)}</Text>
                  </View>
                </View>

                {!!r.description && (
                  <Text style={s.note} numberOfLines={1}>
                    {r.description}
                  </Text>
                )}

                <View style={s.actions}>
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
        title={editId ? "Edit purchase" : "New purchase"}
        subtitle={editId ? "Update and recalculate stock" : "Add received stock to inventory"}
        footer={
          <>
            <Pressable style={s.ghostBtn} onPress={close}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, (saving || !productId) && s.disabled]}
              disabled={saving || !productId}
              onPress={onSubmit}
            >
              <Text style={s.primaryBtnText}>
                {saving ? "Saving…" : editId ? "Save changes" : "Record purchase"}
              </Text>
            </Pressable>
          </>
        }
      >
        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Marble · size</Text>
          <ProductPicker products={shop.products} value={productId} onChange={onProduct} />
        </View>

        <View style={s.dateRow}>
          <View style={[s.filterBlock, s.flex1]}>
            <Text style={s.filterLabel}>Qty (sq ft)</Text>
            <TextInput
              style={s.input}
              value={qty}
              keyboardType="decimal-pad"
              onChangeText={(t) => {
                setQty(t);
                if (!editId && shareWith) syncAllocations(Number(t) || 0);
              }}
            />
          </View>
          <View style={[s.filterBlock, s.flex1]}>
            <Text style={s.filterLabel}>Price / ft</Text>
            <TextInput
              style={s.input}
              value={unitCost}
              keyboardType="decimal-pad"
              onChangeText={setUnitCost}
            />
          </View>
        </View>

        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Description</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional notes"
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>

        {!editId && shop.partners.length > 0 && !!productId && (
          <View style={s.allocBox}>
            <Pressable
              style={s.checkRow}
              onPress={() => {
                const on = !shareWith;
                setShareWith(on);
                if (on) syncAllocations(Number(qty) || 0);
                else setAllocations([]);
              }}
            >
              <Ionicons
                name={shareWith ? "checkbox" : "square-outline"}
                size={22}
                color={shareWith ? colors.primary : colors.muted}
              />
              <View style={s.flex1}>
                <Text style={s.allocTitle}>Purchase shares</Text>
                <Text style={s.allocHint}>Off = all yours · On = split with partners</Text>
              </View>
            </Pressable>
            {shareWith && (
              <>
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
                      <Text style={[s.unitText, allocUnit === key && s.unitTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {allocations.map((a, i) => {
                  const label = a.partnerId
                    ? shop.partners.find((p) => p.id === a.partnerId)?.name || "Partner"
                    : "You";
                  const display = allocDisplay(a.qty, allocUnit, qNum, costNum);
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
                            qty: allocFromInput(Number(t) || 0, allocUnit, qNum, costNum),
                          };
                          setAllocations(next);
                        }}
                      />
                      <Text style={s.allocMeta}>
                        {allocUnit !== "sqft" ? `${sqft(a.qty)} · ` : ""}
                        {money(a.qty * costNum)}
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
              </>
            )}
          </View>
        )}

        <View style={s.summary}>
          <Text style={s.summaryTitle}>SUMMARY</Text>
          <View style={s.dRow}>
            <Text style={s.dKey}>Quantity</Text>
            <Text style={s.dVal}>{qNum ? sqft(qNum) : "—"}</Text>
          </View>
          <View style={s.dRow}>
            <Text style={s.dKey}>Price / ft</Text>
            <Text style={s.dVal}>{money(costNum)}</Text>
          </View>
          {!!selected && (
            <View style={s.dRow}>
              <Text style={s.dKey}>Stock after</Text>
              <Text style={s.dVal}>{sqft(stockAfter)}</Text>
            </View>
          )}
          <View style={[s.dRow, s.dRowTop]}>
            <Text style={s.dKeyStrong}>Total</Text>
            <Text style={s.dValStrong}>{money(totalCost)}</Text>
          </View>
        </View>

        {!!error && <Text style={s.error}>{error}</Text>}
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

  sortRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sortLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  sortChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortChipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  sortChipTextActive: { color: "#fff" },

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
  cardTotal: { fontSize: 17, fontWeight: "700", color: colors.text },
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
  note: { fontSize: 13, color: colors.muted },
  actions: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#f4f4f5", paddingTop: 10 },
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
    paddingVertical: 7,
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontSize: 13, fontWeight: "600", color: colors.text },
  unitTextActive: { color: "#fff" },
  allocRow: { gap: 6 },
  allocName: { fontSize: 14, fontWeight: "600", color: colors.text },
  allocMeta: { fontSize: 12, color: colors.muted },
  allocSum: { fontSize: 13, fontWeight: "600", color: colors.muted },

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
  dKey: { fontSize: 14, color: colors.muted },
  dVal: { fontSize: 14, fontWeight: "600", color: colors.text },
  dKeyStrong: { fontSize: 15, fontWeight: "700", color: colors.text },
  dValStrong: { fontSize: 16, fontWeight: "700", color: colors.text },

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
