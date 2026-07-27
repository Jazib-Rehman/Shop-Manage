import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
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
import { api } from "../api/client";
import { Sheet } from "../components/Sheet";
import { money, sqft } from "../lib/calc";
import { mySharePercent, productLabel, type Product } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

type ShareUnit = "percent" | "sqft" | "amount";
type Share = { partnerId: string; percent: number };
type HistEntry = {
  id: string;
  kind: "purchase" | "loss" | "surplus";
  qty: number;
  unitCost?: number;
  tripId?: string | null;
  note: string;
  date: string;
};

const kindLabel = { purchase: "Purchase", loss: "Loss", surplus: "Surplus" } as const;

function toPercent(value: number, unit: ShareUnit, p: Product) {
  if (unit === "percent") return value;
  if (unit === "sqft") return p.stock > 0 ? (value / p.stock) * 100 : 0;
  const stockValue = p.stock * p.costPrice;
  return stockValue > 0 ? (value / stockValue) * 100 : 0;
}

function fromPercent(percent: number, unit: ShareUnit, p: Product) {
  if (unit === "percent") return percent;
  if (unit === "sqft") return (percent / 100) * p.stock;
  return (percent / 100) * p.stock * p.costPrice;
}

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

function Btn({
  label,
  icon,
  tone = "neutral",
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "neutral" | "warn" | "teal";
  onPress: () => void;
}) {
  const color =
    tone === "warn" ? "#92400e" : tone === "teal" ? colors.primary : colors.text;
  const border = tone === "warn" ? "#fde68a" : tone === "teal" ? "#99f6e4" : "#e4e4e7";
  return (
    <Pressable style={[s.actionBtn, { borderColor: border }]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[s.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function InventoryScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");
  const [size, setSize] = useState("");
  const [own, setOwn] = useState<"all" | "yours" | "shared">("all");
  const [stock, setStock] = useState<"all" | "in" | "low" | "out">("all");
  const [partnerId, setPartnerId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"stock" | "cost" | "value">("stock");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [costFor, setCostFor] = useState<Product | null>(null);

  const [hist, setHist] = useState<Product | null>(null);
  const [entries, setEntries] = useState<HistEntry[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const [adjFor, setAdjFor] = useState<Product | null>(null);
  const [adjEditId, setAdjEditId] = useState<string | null>(null);
  const [adjType, setAdjType] = useState<"loss" | "surplus">("loss");
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState("");

  const [edit, setEdit] = useState<Product | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [unit, setUnit] = useState<ShareUnit>("percent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async (productId: string) => {
    setHistLoading(true);
    try {
      const data = await api<{ entries: HistEntry[] }>(`/api/products/${productId}/history`);
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hist) loadHistory(hist.id);
  }, [hist, loadHistory]);

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const partnerName = (id: string) => shop.partners.find((x) => x.id === id)?.name ?? "Partner";

  const sizes = [...new Set(shop.products.map((p) => p.dimension))].sort();
  const names = [...new Set(shop.products.map((p) => p.name))].sort();
  const activeFilters = [q, size, own !== "all", partnerId, stock !== "all"].filter(Boolean).length;

  const rows = shop.products
    .filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (size && p.dimension !== size) return false;
      if (own === "yours" && p.shares?.length) return false;
      if (own === "shared" && !p.shares?.length) return false;
      if (partnerId && !p.shares?.some((x) => x.partnerId === partnerId)) return false;
      if (stock === "in" && !(p.stock > 0)) return false;
      if (stock === "out" && p.stock > 0) return false;
      if (stock === "low" && !(p.stock > 0 && p.stock <= p.lowStockAt)) return false;
      return true;
    })
    .sort((a, b) => {
      const av = sortKey === "stock" ? a.stock : sortKey === "cost" ? a.costPrice : a.stock * a.costPrice;
      const bv = sortKey === "stock" ? b.stock : sortKey === "cost" ? b.costPrice : b.stock * b.costPrice;
      return sortDir === "desc" ? bv - av : av - bv;
    });

  const toggleSort = (key: "stock" | "cost" | "value") => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const clearFilters = () => {
    setQ("");
    setSize("");
    setOwn("all");
    setPartnerId("");
    setStock("all");
  };

  const ownershipLines = (p: Product) => {
    const lines: string[] = [];
    const mine = mySharePercent(p);
    if (mine > 0) lines.push(`You · ${sqft((mine / 100) * p.stock)}`);
    for (const x of p.shares || []) {
      if (x.percent > 0) lines.push(`${partnerName(x.partnerId)} · ${sqft((x.percent / 100) * p.stock)}`);
    }
    if (!lines.length) lines.push(`You · ${sqft(p.stock)}`);
    return lines;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await shop.refresh();
    setRefreshing(false);
  };

  const openAdjCreate = (p: Product) => {
    setAdjFor(p);
    setAdjEditId(null);
    setAdjType("loss");
    setAdjQty("");
    setAdjNote("");
    setAdjError("");
  };

  const openAdjEdit = (e: HistEntry) => {
    if (!hist || e.kind === "purchase") return;
    setAdjFor(hist);
    setAdjEditId(e.id);
    setAdjType(e.kind);
    setAdjQty(String(e.qty));
    setAdjNote(e.note || "");
    setAdjError("");
  };

  const syncProduct = (updated: Product) => {
    if (hist?.id === updated.id) setHist({ ...hist, stock: updated.stock, costPrice: updated.costPrice });
  };

  const onAdjust = async () => {
    if (!adjFor) return;
    setAdjSaving(true);
    setAdjError("");
    try {
      const url = adjEditId
        ? `/api/products/${adjFor.id}/adjustments/${adjEditId}`
        : `/api/products/${adjFor.id}/adjustments`;
      const data = await api<{ product: Product }>(url, {
        method: adjEditId ? "PATCH" : "POST",
        body: JSON.stringify({ type: adjType, qty: Number(adjQty), note: adjNote }),
      });
      const target = adjFor;
      setAdjFor(null);
      await shop.refresh();
      syncProduct(data.product);
      if (hist?.id === target.id) await loadHistory(target.id);
    } catch (err) {
      setAdjError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdjSaving(false);
    }
  };

  const onDeleteAdj = (e: HistEntry) => {
    if (!hist || e.kind === "purchase") return;
    Alert.alert(`Delete this ${e.kind}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await api<{ product: Product }>(
              `/api/products/${hist.id}/adjustments/${e.id}`,
              { method: "DELETE" }
            );
            await shop.refresh();
            syncProduct(data.product);
            await loadHistory(hist.id);
          } catch (err) {
            Alert.alert(err instanceof Error ? err.message : "Failed");
          }
        },
      },
    ]);
  };

  const openShares = (p: Product) => {
    setEdit(p);
    setShares(p.shares?.length ? [...p.shares] : []);
    setUnit("percent");
    setError("");
  };

  const partnerSum = shares.reduce((sum, x) => sum + (Number(x.percent) || 0), 0);
  const myPct = Math.max(0, 100 - partnerSum);

  const onSaveShares = async () => {
    if (!edit) return;
    if (partnerSum > 100) {
      setError("Partner shares cannot exceed 100%");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shop.saveProductShares(
        edit.id,
        shares.filter((x) => x.partnerId && x.percent > 0)
      );
      setEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addShareRow = () => {
    const next = shop.partners.find((p) => !shares.some((x) => x.partnerId === p.id));
    if (next) setShares([...shares, { partnerId: next.id, percent: 0 }]);
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
            <Ionicons name="grid-outline" size={20} color={colors.primary} />
          </View>
          <View style={s.flex1}>
            <Text style={s.h1}>Inventory</Text>
            <Text style={s.hSub}>
              {rows.length} of {shop.products.length} SKUs · by{" "}
              {sortKey === "cost" ? "avg cost" : sortKey}
            </Text>
          </View>
        </View>

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
                  value={q}
                  onChangeText={setQ}
                  placeholder="Type marble name…"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <ChipRow
                label="Marble"
                value={names.includes(q) ? q : ""}
                onChange={setQ}
                options={[{ value: "", label: "All" }, ...names.map((n) => ({ value: n, label: n }))]}
              />
              <ChipRow
                label="Size"
                value={size}
                onChange={setSize}
                options={[{ value: "", label: "All" }, ...sizes.map((d) => ({ value: d, label: d }))]}
              />
              <ChipRow
                label="Ownership"
                value={own}
                onChange={setOwn}
                options={[
                  { value: "all", label: "All" },
                  { value: "yours", label: "Yours only" },
                  { value: "shared", label: "Shared" },
                ]}
              />
              {shop.partners.length > 0 && (
                <ChipRow
                  label="Partner"
                  value={partnerId}
                  onChange={setPartnerId}
                  options={[
                    { value: "", label: "Any" },
                    ...shop.partners.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              )}
              <ChipRow
                label="Stock status"
                value={stock}
                onChange={setStock}
                options={[
                  { value: "all", label: "All" },
                  { value: "in", label: "In stock" },
                  { value: "low", label: "Low stock" },
                  { value: "out", label: "Out of stock" },
                ]}
              />
            </View>
          )}
        </View>

        <View style={s.sortRow}>
          <Text style={s.sortLabel}>Sort</Text>
          {(
            [
              ["stock", "Stock"],
              ["cost", "Cost"],
              ["value", "Value"],
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
              {shop.products.length === 0 ? "No SKUs — add marbles & sizes" : "No matches"}
            </Text>
          </View>
        ) : (
          rows.map((p) => (
            <View key={p.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.flex1}>
                  <Text style={s.cardName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={s.cardDim}>{p.dimension}</Text>
                </View>
                <Text style={[s.cardStock, p.stock <= p.lowStockAt && s.lowStock]}>
                  {sqft(p.stock)}
                </Text>
              </View>

              <View style={s.ownership}>
                {ownershipLines(p).map((line) => (
                  <Text key={line} style={s.ownLine} numberOfLines={1}>
                    {line}
                  </Text>
                ))}
              </View>

              <View style={s.statRow}>
                <Pressable style={s.stat} onPress={() => setCostFor(p)}>
                  <Text style={s.statKey}>Landed</Text>
                  <Text style={[s.statVal, { color: colors.primary }]}>{money(p.costPrice)}</Text>
                </Pressable>
                <View style={s.stat}>
                  <Text style={s.statKey}>Value</Text>
                  <Text style={s.statVal}>{money(p.stock * p.costPrice)}</Text>
                </View>
              </View>

              <View style={s.actions}>
                <Btn label="History" icon="time-outline" onPress={() => setHist(p)} />
                <Btn label="Adjust" icon="warning-outline" tone="warn" onPress={() => openAdjCreate(p)} />
                <Btn label="Owners" icon="people-outline" tone="teal" onPress={() => openShares(p)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet
        open={!!costFor}
        onClose={() => setCostFor(null)}
        title="Cost breakdown"
        subtitle={costFor ? productLabel(costFor) : undefined}
      >
        {costFor && (
          <>
            {[
              ["Actual", costFor.costActual || 0],
              ["Freight", costFor.costFreight || 0],
              ["Loss", costFor.costLoss || 0],
            ].map(([k, v]) => (
              <View key={String(k)} style={s.dRow}>
                <Text style={s.dKey}>{k}</Text>
                <Text style={s.dVal}>{money(Number(v))} / sq ft</Text>
              </View>
            ))}
            <View style={[s.dRow, s.dRowTop]}>
              <Text style={s.dKeyStrong}>Final avg</Text>
              <Text style={s.dValStrong}>{money(costFor.costPrice)} / sq ft</Text>
            </View>
          </>
        )}
      </Sheet>

      <Sheet
        open={!!hist}
        onClose={() => setHist(null)}
        title="Stock history"
        subtitle={hist ? `${productLabel(hist)} · ${sqft(hist.stock)}` : undefined}
        footer={
          hist ? (
            <Pressable style={s.primaryBtn} onPress={() => openAdjCreate(hist)}>
              <Text style={s.primaryBtnText}>Loss / surplus</Text>
            </Pressable>
          ) : undefined
        }
      >
        {histLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : entries.length === 0 ? (
          <Text style={s.emptyText}>No purchases or adjustments yet</Text>
        ) : (
          entries.map((e) => (
            <View key={`${e.kind}-${e.id}`} style={s.histRow}>
              <View
                style={[
                  s.histIcon,
                  {
                    backgroundColor:
                      e.kind === "loss" ? "#fef2f2" : e.kind === "surplus" ? "#ecfdf5" : "#f0fdfa",
                  },
                ]}
              >
                <Ionicons
                  name={
                    e.kind === "loss" ? "remove" : e.kind === "surplus" ? "add" : "cart-outline"
                  }
                  size={16}
                  color={e.kind === "loss" ? "#b91c1c" : e.kind === "surplus" ? "#047857" : colors.primary}
                />
              </View>
              <View style={s.flex1}>
                <Text style={s.histKind}>{kindLabel[e.kind]}</Text>
                <Text style={s.histDate}>{new Date(e.date).toLocaleString()}</Text>
                {e.kind === "purchase" && e.unitCost != null && (
                  <Text style={s.histMeta}>
                    {money(e.unitCost)} / sq ft{e.tripId ? " · via trip" : ""}
                  </Text>
                )}
                {!!e.note && (
                  <Text style={s.histMeta} numberOfLines={1}>
                    {e.note}
                  </Text>
                )}
              </View>
              <View style={s.histRight}>
                <Text style={[s.histQty, { color: e.kind === "loss" ? "#b91c1c" : "#047857" }]}>
                  {e.kind === "loss" ? "−" : "+"}
                  {sqft(e.qty)}
                </Text>
                {e.kind !== "purchase" && (
                  <View style={s.rowGap}>
                    <Pressable onPress={() => openAdjEdit(e)} hitSlop={6}>
                      <Text style={s.editLink}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => onDeleteAdj(e)} hitSlop={6}>
                      <Text style={s.deleteLink}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </Sheet>

      <Sheet
        open={!!adjFor}
        onClose={() => setAdjFor(null)}
        title={adjEditId ? "Edit adjustment" : "Loss / surplus"}
        subtitle={adjFor ? productLabel(adjFor) : undefined}
        footer={
          <>
            <Pressable style={s.ghostBtn} onPress={() => setAdjFor(null)}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, adjSaving && s.disabled]}
              disabled={adjSaving}
              onPress={onAdjust}
            >
              <Text style={s.primaryBtnText}>
                {adjSaving ? "Saving…" : adjEditId ? "Save" : "Record"}
              </Text>
            </Pressable>
          </>
        }
      >
        <ChipRow
          label="Type"
          value={adjType}
          onChange={setAdjType}
          options={[
            { value: "loss", label: "Loss (− avg cost ↑)" },
            { value: "surplus", label: "Surplus (+ avg cost ↓)" },
          ]}
        />
        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Quantity (sq ft)</Text>
          <TextInput
            style={s.input}
            value={adjQty}
            onChangeText={setAdjQty}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={s.filterBlock}>
          <Text style={s.filterLabel}>Note</Text>
          <TextInput
            style={s.input}
            value={adjNote}
            onChangeText={setAdjNote}
            placeholder="Broken, short, etc."
            placeholderTextColor={colors.muted}
          />
        </View>
        {!!adjError && <Text style={s.error}>{adjError}</Text>}
      </Sheet>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Ownership"
        subtitle={edit ? productLabel(edit) : undefined}
        footer={
          <>
            <Pressable style={s.ghostBtn} onPress={() => setEdit(null)}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, saving && s.disabled]}
              disabled={saving}
              onPress={onSaveShares}
            >
              <Text style={s.primaryBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </>
        }
      >
        {edit && (
          <>
            <ChipRow
              label="Enter shares as"
              value={unit}
              onChange={setUnit}
              options={[
                { value: "percent", label: "Percent" },
                { value: "sqft", label: "Sq ft" },
                { value: "amount", label: "Amount" },
              ]}
            />

            <View style={s.myShare}>
              <Text style={s.myShareKey}>Your share</Text>
              <Text style={s.myShareVal}>
                {myPct.toFixed(1)}% · {sqft((myPct / 100) * edit.stock)}
              </Text>
            </View>

            {shop.partners.length === 0 ? (
              <Text style={s.emptyText}>Add partners first</Text>
            ) : (
              <>
                {shares.map((sh, i) => (
                  <View key={`${sh.partnerId}-${i}`} style={s.shareRow}>
                    <View style={s.shareHead}>
                      <Text style={s.shareName}>{partnerName(sh.partnerId)}</Text>
                      <Pressable
                        onPress={() => setShares(shares.filter((_, idx) => idx !== i))}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.danger} />
                      </Pressable>
                    </View>
                    <TextInput
                      style={s.input}
                      keyboardType="decimal-pad"
                      value={String(Number(fromPercent(sh.percent, unit, edit).toFixed(2)))}
                      onChangeText={(t) => {
                        const next = [...shares];
                        next[i] = { ...sh, percent: toPercent(Number(t) || 0, unit, edit) };
                        setShares(next);
                      }}
                    />
                    {unit !== "percent" && (
                      <Text style={s.shareHint}>= {sh.percent.toFixed(1)}%</Text>
                    )}
                  </View>
                ))}
                {shares.length < shop.partners.length && (
                  <Pressable onPress={addShareRow} style={s.rowGap}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={s.addLink}>Add partner share</Text>
                  </Pressable>
                )}
              </>
            )}

            {!!error && <Text style={s.error}>{error}</Text>}
          </>
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

  sortRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  cardStock: { fontSize: 17, fontWeight: "700", color: colors.text },
  lowStock: { color: "#92400e" },
  ownership: { gap: 2 },
  ownLine: { fontSize: 13, color: colors.muted },
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
  actions: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#f4f4f5", paddingTop: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: "600" },

  dRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  dRowTop: { borderTopWidth: 1, borderTopColor: "#e4e4e7", paddingTop: 12 },
  dKey: { fontSize: 14, color: colors.muted },
  dVal: { fontSize: 14, fontWeight: "500", color: colors.text },
  dKeyStrong: { fontSize: 15, fontWeight: "600", color: colors.text },
  dValStrong: { fontSize: 15, fontWeight: "700", color: colors.text },

  histRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  histIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  histKind: { fontSize: 15, fontWeight: "700", color: colors.text },
  histDate: { fontSize: 12, color: colors.muted, marginTop: 1 },
  histMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  histRight: { alignItems: "flex-end", gap: 4 },
  histQty: { fontSize: 14, fontWeight: "700" },
  editLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
  deleteLink: { fontSize: 13, fontWeight: "600", color: colors.danger },

  myShare: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f0fdfa",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  myShareKey: { fontSize: 14, fontWeight: "600", color: colors.primaryDark },
  myShareVal: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
  shareRow: { gap: 6 },
  shareHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shareName: { fontSize: 14, fontWeight: "600", color: colors.text },
  shareHint: { fontSize: 12, color: colors.muted },
  addLink: { fontSize: 14, fontWeight: "600", color: colors.primary },

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
