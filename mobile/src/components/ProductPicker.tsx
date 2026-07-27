import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { productLabel, type Product } from "../lib/types";
import { colors } from "../theme";

/** Searchable marble · size picker. */
export function ProductPicker({
  products,
  value,
  onChange,
  placeholder = "Select marble · size…",
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = products.find((p) => p.id === value);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) => productLabel(p).toLowerCase().includes(needle));
  }, [products, q]);

  return (
    <>
      <Pressable style={s.trigger} onPress={() => setOpen(true)}>
        <Text style={[s.triggerText, !selected && s.placeholder]} numberOfLines={1}>
          {selected ? productLabel(selected) : placeholder}
        </Text>
        <Text style={s.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Pick marble · size</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={s.close}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            style={s.search}
            value={q}
            onChangeText={setQ}
            placeholder="Search…"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <FlatList
            data={rows}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.empty}>No matches</Text>}
            renderItem={({ item }) => {
              const active = item.id === value;
              return (
                <Pressable
                  style={[s.row, active && s.rowActive]}
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <View style={s.flex1}>
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.dim}>{item.dimension}</Text>
                  </View>
                  {active && <Text style={s.check}>✓</Text>}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  triggerText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: "500" },
  placeholder: { color: colors.muted, fontWeight: "400" },
  chevron: { color: colors.muted, fontSize: 14 },
  modal: { flex: 1, backgroundColor: colors.background, paddingTop: 54 },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  close: { fontSize: 15, fontWeight: "600", color: colors.primary },
  search: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    backgroundColor: colors.surface,
  },
  rowActive: { backgroundColor: "#f0fdfa" },
  flex1: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  dim: { fontSize: 13, color: colors.muted, marginTop: 1 },
  check: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  empty: { textAlign: "center", color: colors.muted, padding: 28, fontSize: 14 },
});
