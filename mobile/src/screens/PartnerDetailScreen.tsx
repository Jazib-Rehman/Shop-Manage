import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { lastNDays, money, sqft } from "../lib/calc";
import type { Partner, PartnerLedgerEntry } from "../lib/types";
import type { MoreStackParams } from "./MoreScreen";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

type Book = {
  partner: Partner;
  credit: number;
  debit: number;
  balance: number;
  breakdown: {
    sale_share: number;
    investment: number;
    purchase_share: number;
    payout: number;
    adjustment: number;
  };
  entries: PartnerLedgerEntry[];
};

const DEBIT = new Set(["payout", "purchase_share"]);
const typeLabel: Record<string, string> = {
  sale_share: "Sale profit",
  purchase_share: "Purchase",
  investment: "Investment",
  payout: "Payout",
  adjustment: "Adjustment",
};

type Props = NativeStackScreenProps<MoreStackParams, "PartnerDetail">;

export function PartnerDetailScreen({ route }: Props) {
  const { id } = route.params;
  const shop = useShop();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  const [entryOpen, setEntryOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<"investment" | "payout">("investment");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setBook(await api<Book>(`/api/partners/${id}/ledger`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const days = lastNDays(14);
  const chart = useMemo(() => {
    if (!book) return { inn: days.map(() => 0), out: days.map(() => 0) };
    const by = (pred: (t: string) => boolean) =>
      days.map((d) =>
        book.entries
          .filter((e) => e.date.slice(0, 10) === d && pred(e.type))
          .reduce((s, e) => s + e.amount, 0)
      );
    return { inn: by((t) => !DEBIT.has(t)), out: by((t) => DEBIT.has(t)) };
  }, [book, days]);

  const shared = shop.products.filter((p) =>
    p.shares?.some((x) => x.partnerId === id && x.percent > 0)
  );

  const closeEntry = () => {
    setEntryOpen(false);
    setEditId(null);
    setEntryType("investment");
    setAmount("");
    setNote("");
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await api(editId ? `/api/partners/${id}/ledger/${editId}` : `/api/partners/${id}/ledger`, {
        method: editId ? "PATCH" : "POST",
        body: JSON.stringify({ type: entryType, amount: Number(amount), note }),
      });
      closeEntry();
      await load();
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (e: PartnerLedgerEntry) => {
    if (e.type !== "investment" && e.type !== "payout" && e.type !== "adjustment") return;
    Alert.alert(`Delete this ${e.type}?`, "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/partners/${id}/ledger/${e.id}`, { method: "DELETE" });
            await load();
          } catch (err) {
            Alert.alert(err instanceof Error ? err.message : "Failed");
          }
        },
      },
    ]);
  };

  if (error) {
    return (
      <View style={s.loading}>
        <Text style={s.error}>{error}</Text>
      </View>
    );
  }
  if (!book) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const his = book.partner.incomePercent ?? 100;
  const b = book.breakdown;
  const flowTotal = Math.max(1, book.credit + book.debit);
  const maxBar = Math.max(1, ...chart.inn, ...chart.out);

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={s.hero}>
          <Text style={s.heroName}>{book.partner.name}</Text>
          <Text style={s.heroMeta}>
            Account book
            {book.partner.phone ? ` · ${book.partner.phone}` : ""}
            {` · them ${his}% / you ${100 - his}%`}
          </Text>
          <View style={s.balBox}>
            <Text style={s.balLabel}>Balance</Text>
            <Text style={s.balVal}>{money(book.balance)}</Text>
          </View>
        </View>

        <View style={s.stats}>
          {[
            ["Sale profit", b.sale_share, "#047857"],
            ["Investments", b.investment, colors.primary],
            ["Purchase cost", b.purchase_share, colors.text],
            ["Payouts", b.payout, colors.text],
          ].map(([lab, val, col]) => (
            <View key={String(lab)} style={s.stat}>
              <Text style={s.statLab}>{lab}</Text>
              <Text style={[s.statVal, { color: String(col) }]}>{money(Number(val))}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Cash flow · 14 days</Text>
          <View style={s.tip}>
            {picked == null ? (
              <Text style={s.tipHint}>Tap a bar</Text>
            ) : (
              <>
                <Text style={s.tipDate}>
                  {new Date(days[picked] + "T12:00:00").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text style={s.tipIn}>In {money(chart.inn[picked])}</Text>
                <Text style={s.tipOut}>Out {money(chart.out[picked])}</Text>
              </>
            )}
          </View>
          <View style={s.chart}>
            {days.map((d, i) => (
              <Pressable
                key={d}
                style={s.barCol}
                onPress={() => setPicked((p) => (p === i ? null : i))}
              >
                <View style={s.barArea}>
                  <View
                    style={[
                      s.bar,
                      {
                        backgroundColor: colors.primary,
                        height: `${(chart.inn[i] / maxBar) * 100}%`,
                        minHeight: chart.inn[i] ? 2 : 0,
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.bar,
                      {
                        backgroundColor: "#a1a1aa",
                        height: `${(chart.out[i] / maxBar) * 100}%`,
                        minHeight: chart.out[i] ? 2 : 0,
                      },
                    ]}
                  />
                </View>
                <Text style={s.barLab}>{d.slice(8)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Activity mix</Text>
          <View style={s.mix}>
            <View style={{ flex: book.credit / flowTotal, backgroundColor: "#10b981" }} />
            <View style={{ flex: book.debit / flowTotal, backgroundColor: "#a1a1aa" }} />
          </View>
          {[
            ["Total in", money(book.credit), "#047857"],
            ["Total out", money(book.debit), colors.text],
            ["Entries", String(book.entries.length), colors.text],
            ["Shared SKUs", String(shared.length), colors.text],
          ].map(([k, v, c]) => (
            <View key={String(k)} style={s.dRow}>
              <Text style={s.dKey}>{k}</Text>
              <Text style={[s.dVal, { color: String(c) }]}>{v}</Text>
            </View>
          ))}
        </View>

        {shared.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Shared stock</Text>
            {shared.map((p) => {
              const pct = p.shares.find((x) => x.partnerId === id)?.percent || 0;
              return (
                <View key={p.id} style={s.dRow}>
                  <Text style={[s.dKey, s.flex1]} numberOfLines={1}>
                    {p.name} · {p.dimension}
                  </Text>
                  <Text style={s.dVal}>
                    {pct}% · {sqft((pct / 100) * p.stock)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.card}>
          <View style={s.ledgerHead}>
            <Text style={s.cardTitle}>Ledger</Text>
            <Pressable
              style={s.addBtn}
              onPress={() => {
                setEditId(null);
                setEntryType("investment");
                setAmount("");
                setNote("");
                setEntryOpen(true);
              }}
            >
              <Text style={s.addText}>Add entry</Text>
            </Pressable>
          </View>
          {book.entries.length === 0 ? (
            <Text style={s.empty}>No entries yet</Text>
          ) : (
            book.entries.map((e) => {
              const out = DEBIT.has(e.type);
              const manual =
                e.type === "investment" || e.type === "payout" || e.type === "adjustment";
              return (
                <View key={e.id} style={s.entry}>
                  <View style={s.flex1}>
                    <Text style={s.entryType}>{typeLabel[e.type] || e.type}</Text>
                    <Text style={s.entryMeta}>
                      {new Date(e.date).toLocaleDateString()}
                      {e.qty ? ` · ${sqft(e.qty)}` : ""}
                    </Text>
                    {!!e.note && (
                      <Text style={s.entryNote} numberOfLines={1}>
                        {e.note}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.entryAmt, !out && { color: "#047857" }]}>
                    {out ? "−" : "+"}
                    {money(e.amount)}
                  </Text>
                  {manual && (
                    <View style={s.entryActs}>
                      {(e.type === "investment" || e.type === "payout") && (
                        <Pressable
                          onPress={() => {
                            setEditId(e.id);
                            setEntryType(e.type as "investment" | "payout");
                            setAmount(String(e.amount));
                            setNote(e.note || "");
                            setEntryOpen(true);
                          }}
                        >
                          <Text style={s.editLink}>Edit</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => onDelete(e)}>
                        <Text style={s.delLink}>Del</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Sheet
        open={entryOpen}
        onClose={closeEntry}
        title={editId ? "Edit entry" : "Add entry"}
        footer={
          <Pressable style={[s.primaryBtn, saving && s.disabled]} disabled={saving} onPress={onSave}>
            <Text style={s.primaryBtnText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        }
      >
        <View style={s.unitRow}>
          {(
            [
              ["investment", "Investment"],
              ["payout", "Payout"],
            ] as const
          ).map(([k, lab]) => (
            <Pressable
              key={k}
              style={[s.unitChip, entryType === k && s.unitOn]}
              onPress={() => setEntryType(k)}
            >
              <Text style={[s.unitText, entryType === k && s.unitTextOn]}>{lab}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.field}>
          <Text style={s.label}>Amount (Rs)</Text>
          <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Note</Text>
          <TextInput style={s.input} value={note} onChangeText={setNote} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  flex1: { flex: 1 },
  hero: {
    backgroundColor: "#134e4a",
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  heroName: { color: "#fff", fontSize: 22, fontWeight: "700" },
  heroMeta: { color: "#99f6e4", fontSize: 13 },
  balBox: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
  },
  balLabel: { color: "#ccfbf1", fontSize: 12, fontWeight: "600" },
  balVal: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 2 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  statLab: { fontSize: 12, fontWeight: "600", color: colors.muted },
  statVal: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  tip: { backgroundColor: "#18181b", borderRadius: 10, padding: 10 },
  tipHint: { color: "#a1a1aa", fontSize: 12 },
  tipDate: { color: "#e4e4e7", fontSize: 12, fontWeight: "700" },
  tipIn: { color: "#5eead4", fontSize: 12, marginTop: 2 },
  tipOut: { color: "#d4d4d8", fontSize: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 3 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barArea: {
    height: 96,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 2,
  },
  bar: { width: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLab: { fontSize: 9, color: colors.muted },
  mix: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "#e4e4e7" },
  dRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  dKey: { fontSize: 14, color: colors.muted },
  dVal: { fontSize: 14, fontWeight: "700", color: colors.text },
  ledgerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.muted, paddingVertical: 16 },
  entry: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
    paddingTop: 10,
  },
  entryType: { fontSize: 14, fontWeight: "700", color: colors.text },
  entryMeta: { fontSize: 12, color: colors.muted, marginTop: 1 },
  entryNote: { fontSize: 12, color: colors.muted, marginTop: 1 },
  entryAmt: { fontSize: 15, fontWeight: "700", color: colors.text },
  entryActs: { flexDirection: "row", gap: 10, width: "100%", justifyContent: "flex-end" },
  editLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
  delLink: { fontSize: 13, fontWeight: "600", color: colors.danger },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  unitRow: { flexDirection: "row", gap: 8 },
  unitChip: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 9,
  },
  unitOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontSize: 13, fontWeight: "600", color: colors.text },
  unitTextOn: { color: "#fff" },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, textAlign: "center" },
});
