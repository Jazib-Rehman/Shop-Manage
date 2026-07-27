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
import { api } from "../api/client";
import { Sheet } from "../components/Sheet";
import { money, sqft } from "../lib/calc";
import { freightPerSqFt, lineTons, ratePerTon } from "../lib/freight";
import { productLabel, type Purchase, type Trip } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

export function TripsScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [truckFare, setTruckFare] = useState("");
  const [loadingCost, setLoadingCost] = useState("");
  const [unloadingCost, setUnloadingCost] = useState("");
  const [purchaseIds, setPurchaseIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const freePurchases = useMemo(
    () => shop.purchases.filter((p) => !p.tripId),
    [shop.purchases]
  );

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const weightOf = (productId: string) =>
    shop.products.find((p) => p.id === productId)?.sqFtPerTon || 0;

  const reset = () => {
    setEditId(null);
    setNote("");
    setTruckFare("");
    setLoadingCost("");
    setUnloadingCost("");
    setPurchaseIds([]);
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

  const openEdit = (t: Trip) => {
    reset();
    setEditId(t.id);
    setNote(t.note);
    setTruckFare(t.truckFare ? String(t.truckFare) : "");
    setLoadingCost(t.loadingCost ? String(t.loadingCost) : "");
    setUnloadingCost(t.unloadingCost ? String(t.unloadingCost) : "");
    setOpen(true);
  };

  const selectedPurchases = purchaseIds
    .map((id) => freePurchases.find((p) => p.id === id))
    .filter(Boolean) as Purchase[];
  const perTon = ratePerTon(Number(truckFare), Number(loadingCost), Number(unloadingCost));
  const editLines = editId ? shop.trips.find((t) => t.id === editId)?.lines ?? [] : [];
  const previewLines = editId ? editLines : selectedPurchases;
  const totalTons = previewLines.reduce((sum, p) => sum + lineTons(p.qty, weightOf(p.productId)), 0);
  const expensesTotal = perTon * totalTons;
  const marbleTotal = previewLines.reduce((sum, p) => sum + p.total, 0);

  const onSubmit = async () => {
    setError("");
    if (editId) {
      setSaving(true);
      try {
        await api(`/api/trips/${editId}`, {
          method: "PATCH",
          body: JSON.stringify({ note, truckFare, loadingCost, unloadingCost }),
        });
        await shop.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!purchaseIds.length) {
      setError("Add at least one purchase");
      return;
    }
    setSaving(true);
    try {
      await api("/api/trips", {
        method: "POST",
        body: JSON.stringify({ note, truckFare, loadingCost, unloadingCost, purchaseIds }),
      });
      await shop.refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (t: Trip) => {
    Alert.alert("Delete this trip?", "Purchases stay — only freight is removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/trips/${t.id}`, { method: "DELETE" });
            await shop.refresh();
          } catch (err) {
            Alert.alert(err instanceof Error ? err.message : "Delete failed");
          }
        },
      },
    ]);
  };

  const togglePurchase = (id: string) =>
    setPurchaseIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const totalExp = shop.trips.reduce((sum, t) => sum + t.expensesTotal, 0);

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await shop.refresh();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={s.hSub}>
          {shop.trips.length} trips · exp {money(totalExp)}
        </Text>

        <Pressable
          style={[s.newBtn, !freePurchases.length && s.disabled]}
          disabled={!freePurchases.length}
          onPress={openCreate}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>New trip</Text>
        </Pressable>

        {shop.trips.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No trips yet — attach freestanding purchases</Text>
          </View>
        ) : (
          shop.trips.map((t) => {
            const openCard = expanded === t.id;
            const qty = t.lines.reduce((sum, l) => sum + l.qty, 0);
            const marble = t.lines.reduce((sum, l) => sum + l.total, 0);
            return (
              <View key={t.id} style={s.card}>
                <Pressable
                  onPress={() => setExpanded(openCard ? null : t.id)}
                  style={s.cardTop}
                >
                  <View style={s.flex1}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {t.note || "Trip"}
                    </Text>
                    <Text style={s.cardMeta}>
                      {new Date(t.date).toLocaleDateString()} · {t.lines.length} lines ·{" "}
                      {sqft(qty)}
                    </Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.cardTotal}>{money(marble + t.expensesTotal)}</Text>
                    <Text style={s.cardExp}>frt {money(t.expensesTotal)}</Text>
                  </View>
                </Pressable>

                {openCard && (
                  <View style={s.lines}>
                    {t.lines.map((l) => {
                      const p = shop.products.find((x) => x.id === l.productId);
                      const frt = freightPerSqFt(
                        ratePerTon(t.truckFare, t.loadingCost, t.unloadingCost),
                        weightOf(l.productId)
                      );
                      return (
                        <View key={l.id} style={s.line}>
                          <Text style={s.lineName} numberOfLines={1}>
                            {p ? productLabel(p) : "—"}
                          </Text>
                          <Text style={s.lineMeta}>
                            {sqft(l.qty)} · {money(l.unitCost)}/ft · frt {money(frt)}/ft
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={s.actions}>
                  <Pressable style={s.editBtn} onPress={() => openEdit(t)}>
                    <Text style={s.editText}>Edit costs</Text>
                  </Pressable>
                  <Pressable style={s.deleteBtn} onPress={() => onDelete(t)}>
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
        title={editId ? "Edit trip costs" : "New trip"}
        subtitle="Truck / loading / unloading are per ton"
        footer={
          <Pressable
            style={[s.primaryBtn, saving && s.disabled]}
            disabled={saving}
            onPress={onSubmit}
          >
            <Text style={s.primaryBtnText}>
              {saving ? "Saving…" : editId ? "Save costs" : "Create trip"}
            </Text>
          </Pressable>
        }
      >
        <View style={s.field}>
          <Text style={s.label}>Note</Text>
          <TextInput
            style={s.input}
            value={note}
            onChangeText={setNote}
            placeholder="Supplier run, truck #…"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={s.row3}>
          {(
            [
              ["Truck / ton", truckFare, setTruckFare],
              ["Load / ton", loadingCost, setLoadingCost],
              ["Unload / ton", unloadingCost, setUnloadingCost],
            ] as const
          ).map(([lab, val, set]) => (
            <View key={lab} style={[s.field, s.flex1]}>
              <Text style={s.label}>{lab}</Text>
              <TextInput
                style={s.input}
                value={val}
                onChangeText={set}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>

        {!editId && (
          <View style={s.field}>
            <Text style={s.label}>Purchases (no trip yet)</Text>
            {freePurchases.length === 0 ? (
              <Text style={s.emptyText}>No freestanding purchases</Text>
            ) : (
              freePurchases.map((p) => {
                const prod = shop.products.find((x) => x.id === p.productId);
                const on = purchaseIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={[s.pick, on && s.pickOn]}
                    onPress={() => togglePurchase(p.id)}
                  >
                    <Ionicons
                      name={on ? "checkbox" : "square-outline"}
                      size={18}
                      color={on ? colors.primary : colors.muted}
                    />
                    <View style={s.flex1}>
                      <Text style={s.pickName} numberOfLines={1}>
                        {prod ? productLabel(prod) : "—"}
                      </Text>
                      <Text style={s.pickMeta}>
                        {sqft(p.qty)} · {money(p.unitCost)}/ft
                      </Text>
                    </View>
                    <Text style={s.pickTotal}>{money(p.total)}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <View style={s.summary}>
          <View style={s.dRow}>
            <Text style={s.dKey}>Rate / ton</Text>
            <Text style={s.dVal}>{money(perTon)}</Text>
          </View>
          <View style={s.dRow}>
            <Text style={s.dKey}>Tons</Text>
            <Text style={s.dVal}>{totalTons.toFixed(3)}</Text>
          </View>
          <View style={s.dRow}>
            <Text style={s.dKey}>Freight</Text>
            <Text style={s.dVal}>{money(expensesTotal)}</Text>
          </View>
          <View style={[s.dRow, s.dTop]}>
            <Text style={s.dStrong}>Landed</Text>
            <Text style={s.dStrong}>{money(marbleTotal + expensesTotal)}</Text>
          </View>
        </View>

        {!!error && <Text style={s.error}>{error}</Text>}
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  flex1: { flex: 1 },
  hSub: { fontSize: 13, color: colors.muted },
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
  cardTop: { flexDirection: "row", gap: 10 },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardRight: { alignItems: "flex-end" },
  cardTotal: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardExp: { fontSize: 12, color: colors.muted, marginTop: 2 },
  lines: { gap: 8, borderTopWidth: 1, borderTopColor: "#f4f4f5", paddingTop: 10 },
  line: { gap: 2 },
  lineName: { fontSize: 14, fontWeight: "600", color: colors.text },
  lineMeta: { fontSize: 12, color: colors.muted },
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
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
  },
  row3: { flexDirection: "row", gap: 8 },
  pick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surface,
  },
  pickOn: { borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  pickName: { fontSize: 14, fontWeight: "600", color: colors.text },
  pickMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  pickTotal: { fontSize: 13, fontWeight: "700", color: colors.text },
  summary: {
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 12,
    gap: 8,
  },
  dRow: { flexDirection: "row", justifyContent: "space-between" },
  dTop: { borderTopWidth: 1, borderTopColor: "#99f6e4", paddingTop: 8 },
  dKey: { fontSize: 14, color: colors.muted },
  dVal: { fontSize: 14, fontWeight: "600", color: colors.text },
  dStrong: { fontSize: 15, fontWeight: "700", color: colors.text },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: {
    color: colors.danger,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
  },
});
