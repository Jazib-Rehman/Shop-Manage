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
import type { Marble } from "../lib/types";
import { useShop } from "../shop/ShopContext";
import { colors } from "../theme";

const PRESETS = ['4"x12"', '6"x12"', '12"x12"', '12"x24"', '12"x48"', '2"', '3"'];

export function CatalogScreen() {
  const shop = useShop();
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Marble | null>(null);
  const [name, setName] = useState("");
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [dimInput, setDimInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shop.ready) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const reset = () => {
    setEditing(null);
    setName("");
    setDimensions([]);
    setWeights({});
    setDimInput("");
    setError("");
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (m: Marble) => {
    setEditing(m);
    setName(m.name);
    setDimensions([...m.dimensions]);
    setWeights(
      Object.fromEntries(
        m.dimensions.map((d) => [
          d,
          String((m.dimensionWeights ?? []).find((w) => w.dimension === d)?.sqFtPerTon || ""),
        ])
      )
    );
    setDimInput("");
    setError("");
    setOpen(true);
  };

  const addDim = (raw: string) => {
    const d = raw.trim();
    if (!d || dimensions.includes(d)) return;
    setDimensions((prev) => [...prev, d]);
    setDimInput("");
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await shop.saveMarble({
        id: editing?.id,
        name: name.trim(),
        dimensions,
        dimensionWeights: dimensions.map((dimension) => ({
          dimension,
          sqFtPerTon: Number(weights[dimension]) || 0,
        })),
      });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (m: Marble) => {
    Alert.alert(`Delete “${m.name}”?`, "Removes empty size SKUs too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await shop.deleteMarble(m.id);
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
        <Pressable style={s.newBtn} onPress={openNew}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>Add marble</Text>
        </Pressable>

        {shop.marbles.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No marbles yet</Text>
          </View>
        ) : (
          shop.marbles.map((m) => (
            <View key={m.id} style={s.card}>
              <Text style={s.cardName}>{m.name}</Text>
              <Text style={s.cardMeta}>
                {m.dimensions.length} size{m.dimensions.length === 1 ? "" : "s"}
              </Text>
              <View style={s.chips}>
                {m.dimensions.length === 0 && <Text style={s.emptyText}>No dimensions</Text>}
                {m.dimensions.map((d) => {
                  const w = (m.dimensionWeights ?? []).find((x) => x.dimension === d)?.sqFtPerTon;
                  return (
                    <View key={d} style={s.dimChip}>
                      <Text style={s.dimText}>{d}</Text>
                      <Text style={s.dimWeight}>{w || "—"} ft/ton</Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.actions}>
                <Pressable style={s.editBtn} onPress={() => openEdit(m)}>
                  <Text style={s.editText}>Edit</Text>
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => onDelete(m)}>
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
        title={editing ? "Edit marble" : "Add marble"}
        footer={
          <Pressable style={[s.primaryBtn, saving && s.disabled]} disabled={saving} onPress={onSubmit}>
            <Text style={s.primaryBtnText}>
              {saving ? "Saving…" : editing ? "Update marble" : "Create marble"}
            </Text>
          </Pressable>
        }
      >
        <View style={s.field}>
          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder='e.g. Sunny White'
            placeholderTextColor={colors.muted}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Sizes</Text>
          <View style={s.presetRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                disabled={dimensions.includes(p)}
                onPress={() => addDim(p)}
                style={[s.preset, dimensions.includes(p) && s.presetOff]}
              >
                <Text style={s.presetText}>+ {p}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.addRow}>
            <TextInput
              style={[s.input, s.flex1]}
              value={dimInput}
              onChangeText={setDimInput}
              placeholder='Custom e.g. 12"x36"'
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => addDim(dimInput)}
            />
            <Pressable style={s.addBtn} onPress={() => addDim(dimInput)}>
              <Text style={s.addBtnText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {dimensions.length > 0 && (
          <View style={s.weightBox}>
            <Text style={s.label}>Weight — sq ft per ton</Text>
            {dimensions.map((d) => (
              <View key={d} style={s.weightRow}>
                <Text style={s.weightDim}>{d}</Text>
                <TextInput
                  style={[s.input, s.flex1]}
                  keyboardType="decimal-pad"
                  value={weights[d] ?? ""}
                  onChangeText={(t) => setWeights((prev) => ({ ...prev, [d]: t }))}
                  placeholder="e.g. 1000"
                  placeholderTextColor={colors.muted}
                />
                <Pressable
                  onPress={() => setDimensions((prev) => prev.filter((x) => x !== d))}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

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
    gap: 8,
  },
  cardName: { fontSize: 17, fontWeight: "700", color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dimChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dimText: { fontSize: 13, fontWeight: "700", color: colors.text },
  dimWeight: { fontSize: 12, color: colors.muted },
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  presetOff: { opacity: 0.35 },
  presetText: { fontSize: 13, fontWeight: "600", color: colors.text },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  weightBox: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  weightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weightDim: { width: 64, fontSize: 13, fontWeight: "700", color: colors.text },
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
