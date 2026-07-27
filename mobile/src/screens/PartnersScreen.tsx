import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
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
import { Sheet } from "../components/Sheet";
import type { Partner } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";
import type { MoreStackParams } from "./MoreScreen";

type Nav = NativeStackNavigationProp<MoreStackParams>;

export function PartnersScreen() {
  const nav = useNavigation<Nav>();
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);
  const [fSearch, setFSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [incomePercent, setIncomePercent] = useState("100");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const q = fSearch.trim().toLowerCase();
  const rows = q
    ? shop.partners.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.phone || "").toLowerCase().includes(q)
      )
    : shop.partners;

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setIncomePercent("100");
    setError("");
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setName(p.name);
    setPhone(p.phone);
    setIncomePercent(String(p.incomePercent ?? 100));
    setError("");
    setOpen(true);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    const pct = Number(incomePercent);
    if (!(pct >= 0 && pct <= 100)) {
      setError("Income % must be 0–100");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shop.savePartner({
        id: editing?.id,
        name: name.trim(),
        phone: phone.trim(),
        incomePercent: pct,
      });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (p: Partner) => {
    Alert.alert(`Remove partner “${p.name}”?`, "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await shop.deletePartner(p.id);
          } catch (err) {
            Alert.alert(err instanceof Error ? err.message : "Delete failed");
          }
        },
      },
    ]);
  };

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
          {rows.length} of {shop.partners.length} · income % cut of their goods
        </Text>

        <Pressable style={s.newBtn} onPress={openNew}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>Add partner</Text>
        </Pressable>

        <TextInput
          style={s.input}
          value={fSearch}
          onChangeText={setFSearch}
          placeholder="Search name or phone…"
          placeholderTextColor={colors.muted}
        />

        {rows.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>
              {shop.partners.length === 0 ? "No partners yet" : "No matches"}
            </Text>
          </View>
        ) : (
          rows.map((p) => {
            const his = p.incomePercent ?? 100;
            return (
              <View key={p.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.flex1}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={s.cardMeta}>{p.phone || "No phone"}</Text>
                  </View>
                  <View style={s.split}>
                    <Text style={s.splitThem}>Them {his}%</Text>
                    <Text style={s.splitYou}>you {100 - his}%</Text>
                  </View>
                </View>
                <View style={s.actions}>
                  <Pressable
                    style={s.accountBtn}
                    onPress={() => nav.navigate("PartnerDetail", { id: p.id })}
                  >
                    <Text style={s.accountText}>Account</Text>
                  </Pressable>
                  <Pressable style={s.editBtn} onPress={() => openEdit(p)}>
                    <Text style={s.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={s.deleteBtn} onPress={() => onDelete(p)}>
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
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={editing ? "Edit partner" : "Add partner"}
        footer={
          <Pressable style={[s.primaryBtn, saving && s.disabled]} disabled={saving} onPress={onSubmit}>
            <Text style={s.primaryBtnText}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Text>
          </Pressable>
        }
      >
        <View style={s.field}>
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Phone</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>
        <View style={s.field}>
          <Text style={s.label}>Their income %</Text>
          <TextInput
            style={s.input}
            value={incomePercent}
            onChangeText={setIncomePercent}
            keyboardType="decimal-pad"
          />
          <Text style={s.hint}>Their cut of profit from goods they own (0–100)</Text>
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
  cardMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  split: { alignItems: "flex-end" },
  splitThem: { fontSize: 13, fontWeight: "700", color: colors.text },
  splitYou: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#f4f4f5", paddingTop: 10 },
  accountBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 9,
    paddingVertical: 9,
  },
  accountText: { fontSize: 13, fontWeight: "600", color: "#0369a1" },
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
  hint: { fontSize: 12, color: colors.muted },
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
