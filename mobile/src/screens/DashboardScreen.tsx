import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { calcStats, dayKey, lastNDays, money, sqft } from "../lib/calc";
import { productLabel } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

function Section({
  icon,
  tint,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  tint: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={[s.cardIcon, { backgroundColor: tint }]}>
          <Ionicons name={icon} size={18} color={colors.primaryDark} />
        </View>
        <View style={s.flex1}>
          <Text style={s.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={s.cardSub}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function Bars({ labels, a, b }: { labels: string[]; a: number[]; b: number[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(1, ...a, ...b);
  const sel = picked != null ? picked : null;

  return (
    <View>
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: colors.primary }]} />
          <Text style={s.legendText}>Sales</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: "#a1a1aa" }]} />
          <Text style={s.legendText}>Purchases</Text>
        </View>
      </View>

      <View style={s.tipBox}>
        {sel == null ? (
          <Text style={s.tipHint}>Tap a bar for details</Text>
        ) : (
          <>
            <Text style={s.tipDate}>
              {new Date(labels[sel] + "T12:00:00").toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text style={s.tipSales}>Sales {money(a[sel])}</Text>
            <Text style={s.tipBuys}>Purchases {money(b[sel])}</Text>
          </>
        )}
      </View>

      <View style={s.chart}>
        {labels.map((lab, i) => (
          <Pressable
            key={lab}
            style={s.barCol}
            onPress={() => setPicked((p) => (p === i ? null : i))}
          >
            <View style={s.barArea}>
              <View
                style={[
                  s.bar,
                  {
                    backgroundColor: colors.primary,
                    height: `${(a[i] / max) * 100}%`,
                    minHeight: a[i] ? 3 : 0,
                  },
                ]}
              />
              <View
                style={[
                  s.bar,
                  {
                    backgroundColor: "#a1a1aa",
                    height: `${(b[i] / max) * 100}%`,
                    minHeight: b[i] ? 3 : 0,
                  },
                ]}
              />
            </View>
            <Text style={[s.barLabel, sel === i && s.barLabelActive]}>{lab.slice(8)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function DashboardScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await shop.refresh();
    setRefreshing(false);
  };

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const st = calcStats(shop.products, shop.sales, shop.purchases);
  const days = lastNDays(14);
  const salesByDay = days.map((d) =>
    shop.sales.filter((x) => dayKey(x.date) === d).reduce((sum, x) => sum + x.total, 0)
  );
  const buysByDay = days.map((d) =>
    shop.purchases.filter((x) => dayKey(x.date) === d).reduce((sum, x) => sum + x.total, 0)
  );

  const paidN = shop.sales.filter((x) => x.paymentStatus === "paid").length;
  const partialN = shop.sales.filter((x) => x.paymentStatus === "partial").length;
  const unpaidN = shop.sales.filter((x) => x.paymentStatus === "unpaid").length;
  const payTotal = Math.max(1, paidN + partialN + unpaidN);

  const topStock = [...shop.products].sort((x, y) => y.stock - x.stock).slice(0, 5);
  const maxStock = Math.max(1, ...topStock.map((p) => p.stock));

  const truckTotal = shop.trips.reduce((sum, t) => sum + t.truckFare * t.tons, 0);
  const loadTotal = shop.trips.reduce(
    (sum, t) => sum + (t.loadingCost + t.unloadingCost) * t.tons,
    0
  );

  const hero: { label: string; value: string; hint: string; icon: IconName }[] = [
    { label: "Stock value", value: money(st.stockValue), hint: "At average cost", icon: "cube-outline" },
    { label: "Receivables", value: money(st.receivables), hint: "Still owed to you", icon: "wallet-outline" },
    { label: "Gross profit", value: money(st.profit), hint: "From all sales", icon: "bar-chart-outline" },
    { label: "In stock", value: sqft(st.unitsInStock), hint: `${shop.products.length} sizes`, icon: "grid-outline" },
  ];

  const quick: { k: string; v: string; icon: IconName }[] = [
    { k: "Retail stock", v: money(st.retailValue), icon: "cube-outline" },
    { k: "All revenue", v: money(st.revenue), icon: "bar-chart-outline" },
    { k: "Purchase spend", v: money(st.purchaseSpend), icon: "cart-outline" },
    { k: "Truck fares", v: money(truckTotal), icon: "bus-outline" },
    { k: "Loading / unloading", v: money(loadTotal), icon: "swap-vertical-outline" },
    { k: "Partners", v: String(shop.partners.length), icon: "people-outline" },
    { k: "Customers", v: String(shop.customers.length), icon: "person-outline" },
    { k: "Low stock SKUs", v: String(st.lowStock.length), icon: "warning-outline" },
  ];

  const customerOf = (id: string | null) =>
    (id && shop.customers.find((c) => c.id === id)?.name) || "Customer";

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <LinearGradient
          colors={["#134e4a", "#115e59", "#18181b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroKicker}>Shop Manager</Text>
          <Text style={s.heroTitle}>Overview</Text>
          <Text style={s.heroSub}>Stock, cash collected, and credit at a glance.</Text>
          <View style={s.heroGrid}>
            {hero.map((c) => (
              <View key={c.label} style={s.heroCard}>
                <View style={s.heroCardHead}>
                  <View style={s.heroIcon}>
                    <Ionicons name={c.icon} size={16} color="#ccfbf1" />
                  </View>
                  <Text style={s.heroLabel}>{c.label}</Text>
                </View>
                <Text style={s.heroValue}>{c.value}</Text>
                <Text style={s.heroHint}>{c.hint}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {!!shop.error && <Text style={s.error}>{shop.error}</Text>}

        <Section
          icon="bar-chart-outline"
          tint="#f0fdfa"
          title="Sales vs purchases"
          subtitle="Last 14 days (Rs)"
        >
          <Bars labels={days} a={salesByDay} b={buysByDay} />
        </Section>

        <Section
          icon="checkmark-circle-outline"
          tint="#ecfdf5"
          title="Payment mix"
          subtitle={`${shop.sales.length} sales total`}
        >
          <View style={s.mixBar}>
            <View style={{ flex: paidN / payTotal, backgroundColor: "#059669" }} />
            <View style={{ flex: partialN / payTotal, backgroundColor: "#0284c7" }} />
            <View style={{ flex: unpaidN / payTotal, backgroundColor: "#f59e0b" }} />
          </View>
          {[
            { label: "Paid", n: paidN, color: "#059669" },
            { label: "Partial", n: partialN, color: "#0284c7" },
            { label: "Unpaid", n: unpaidN, color: "#f59e0b" },
          ].map((row) => (
            <View key={row.label} style={s.row}>
              <View style={s.legendItem}>
                <View style={[s.swatch, { backgroundColor: row.color }]} />
                <Text style={s.rowLabel}>{row.label}</Text>
              </View>
              <Text style={s.rowValue}>{row.n}</Text>
            </View>
          ))}
          <View style={[s.row, s.rowTop]}>
            <Text style={s.rowLabel}>Collected</Text>
            <Text style={s.rowValueLg}>{money(st.collected)}</Text>
          </View>
        </Section>

        <Section icon="grid-outline" tint="#f0fdfa" title="Top stock (sq ft)">
          {topStock.length === 0 ? (
            <Text style={s.empty}>No products yet</Text>
          ) : (
            topStock.map((p) => (
              <View key={p.id} style={s.stockRow}>
                <View style={s.row}>
                  <Text style={s.stockName} numberOfLines={1}>
                    {productLabel(p)}
                  </Text>
                  <Text style={s.rowValue}>{sqft(p.stock)}</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.trackFill, { width: `${(p.stock / maxStock) * 100}%` }]} />
                </View>
              </View>
            ))
          )}
        </Section>

        <Section icon="cube-outline" tint="#f4f4f5" title="Quick stats">
          <View style={s.quickGrid}>
            {quick.map((q) => (
              <View key={q.k} style={s.quickCell}>
                <View style={s.legendItem}>
                  <Ionicons name={q.icon} size={14} color={colors.muted} />
                  <Text style={s.quickKey} numberOfLines={1}>
                    {q.k}
                  </Text>
                </View>
                <Text style={s.quickValue}>{q.v}</Text>
              </View>
            ))}
          </View>
        </Section>

        {st.unpaid.length > 0 && (
          <View style={s.alertCard}>
            <View style={s.alertHead}>
              <Ionicons name="wallet-outline" size={18} color="#92400e" />
              <Text style={s.alertTitle}>Receivables</Text>
            </View>
            {st.unpaid.slice(0, 6).map((sale) => {
              const p = shop.products.find((x) => x.id === sale.productId);
              return (
                <View key={sale.id} style={s.alertRow}>
                  <View style={s.flex1}>
                    <Text style={s.alertName} numberOfLines={1}>
                      {customerOf(sale.customerId)} · {p ? productLabel(p) : "—"}
                    </Text>
                    <Text style={s.alertMeta}>
                      {sale.dueDate
                        ? `Due ${new Date(sale.dueDate).toLocaleDateString()}`
                        : "No due date"}
                    </Text>
                  </View>
                  <Text style={s.alertValue}>
                    {money(Math.max(0, sale.total - (sale.amountPaid || 0)))}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {st.lowStock.length > 0 && (
          <View style={s.alertCard}>
            <View style={s.alertHead}>
              <Ionicons name="warning-outline" size={18} color="#92400e" />
              <Text style={s.alertTitle}>Low stock</Text>
            </View>
            {st.lowStock.map((p) => (
              <View key={p.id} style={s.alertRow}>
                <Text style={[s.alertName, s.flex1]} numberOfLines={1}>
                  {productLabel(p)}
                </Text>
                <Text style={s.alertValue}>{sqft(p.stock)} left</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  scroll: { padding: 14, gap: 14, paddingBottom: 28 },
  flex1: { flex: 1 },

  hero: { borderRadius: 18, padding: 18 },
  heroKicker: { color: "#99f6e4", fontSize: 13, fontWeight: "600" },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: 2 },
  heroSub: { color: "#ccfbf1", fontSize: 13, marginTop: 6 },
  heroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  heroCard: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    padding: 12,
  },
  heroCardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: { color: "#ccfbf1", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  heroValue: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 8 },
  heroHint: { color: "#99f6e4", fontSize: 11, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 13, color: colors.text, fontWeight: "500" },

  tipBox: {
    backgroundColor: "#18181b",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tipHint: { color: "#a1a1aa", fontSize: 12 },
  tipDate: { color: "#e4e4e7", fontSize: 12, fontWeight: "700" },
  tipSales: { color: "#5eead4", fontSize: 12, marginTop: 2 },
  tipBuys: { color: "#d4d4d8", fontSize: 12 },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 150 },
  barCol: { flex: 1, alignItems: "center", gap: 5 },
  barArea: { height: 120, width: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 2 },
  bar: { width: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLabel: { fontSize: 10, color: colors.muted },
  barLabelActive: { color: colors.text, fontWeight: "700" },

  mixBar: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", backgroundColor: "#e4e4e7" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowTop: { borderTopWidth: 1, borderTopColor: "#e4e4e7", paddingTop: 10 },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: "500" },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: "700" },
  rowValueLg: { fontSize: 17, color: colors.text, fontWeight: "700" },

  empty: { textAlign: "center", color: colors.muted, paddingVertical: 20, fontSize: 14 },
  stockRow: { gap: 6 },
  stockName: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.text },
  track: { height: 9, borderRadius: 5, backgroundColor: "#e4e4e7", overflow: "hidden" },
  trackFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 5 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCell: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickKey: { fontSize: 12, color: colors.muted, fontWeight: "500", flexShrink: 1 },
  quickValue: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 },

  alertCard: {
    borderWidth: 2,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  alertHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertTitle: { fontSize: 16, fontWeight: "700", color: "#451a03" },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#fde68a",
    paddingTop: 10,
  },
  alertName: { fontSize: 14, fontWeight: "600", color: colors.text },
  alertMeta: { fontSize: 12, color: "#92400e", marginTop: 2 },
  alertValue: { fontSize: 15, fontWeight: "700", color: "#451a03" },

  error: {
    color: colors.danger,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
  },
});
