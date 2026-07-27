import { Ionicons } from "@expo/vector-icons";
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
import type { Customer } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

export function CustomersScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);
  const [fSearch, setFSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
    ? shop.customers.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q)
      )
    : shop.customers;

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setError("");
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setError("");
    setOpen(true);
  };

  const onSubmit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    try {
      await shop.saveCustomer({
        id: editing?.id,
        name: name.trim(),
        phone: phone.trim(),
      });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (c: Customer) => {
    Alert.alert(`Remove customer “${c.name}”?`, "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await shop.deleteCustomer(c.id);
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
          {rows.length} of {shop.customers.length} · used on credit / partial sales
        </Text>

        <Pressable style={s.newBtn} onPress={openNew}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>Add customer</Text>
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
              {shop.customers.length === 0 ? "No customers yet" : "No matches"}
            </Text>
          </View>
        ) : (
          rows.map((c) => (
            <View key={c.id} style={s.card}>
              <Text style={s.cardName} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={s.cardMeta}>{c.phone || "No phone"}</Text>
              <View style={s.actions}>
                <Pressable style={s.editBtn} onPress={() => openEdit(c)}>
                  <Text style={s.editText}>Edit</Text>
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => onDelete(c)}>
                  <Text style={s.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title={editing ? "Edit customer" : "Add customer"}
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
    gap: 4,
  },
  cardName: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
  actions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
    paddingTop: 10,
    marginTop: 8,
  },
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
