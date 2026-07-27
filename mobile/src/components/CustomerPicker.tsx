import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { customerLabel, type Customer } from "../lib/types";
import { colors } from "../theme";

/** Searchable customer picker with inline create. */
export function CustomerPicker({
  customers,
  value,
  onChange,
  onCreated,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (c: Customer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = customers.find((c) => c.id === value);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(s) || c.phone.includes(s)
    );
  }, [customers, q]);

  const create = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data = await api<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify({ name, phone }),
      });
      onCreated(data);
      onChange(data.id);
      setCreating(false);
      setOpen(false);
      setName("");
      setPhone("");
      setQ("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        style={s.trigger}
        onPress={() => {
          setOpen(true);
          setQ("");
          setCreating(false);
        }}
      >
        <Text style={[s.triggerText, !selected && s.placeholder]} numberOfLines={1}>
          {selected ? customerLabel(selected) : "Select customer…"}
        </Text>
        <Text style={s.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{creating ? "New customer" : "Pick customer"}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={s.close}>Close</Text>
            </Pressable>
          </View>

          {creating ? (
            <View style={s.createBox}>
              <TextInput
                style={s.search}
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor={colors.muted}
                autoFocus
              />
              <TextInput
                style={s.search}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />
              {!!error && <Text style={s.error}>{error}</Text>}
              <View style={s.createActions}>
                <Pressable style={s.backBtn} onPress={() => setCreating(false)}>
                  <Text style={s.backText}>Back</Text>
                </Pressable>
                <Pressable
                  style={[s.createBtn, saving && s.disabled]}
                  disabled={saving}
                  onPress={create}
                >
                  <Text style={s.createBtnText}>{saving ? "Saving…" : "Create & select"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <TextInput
                style={s.search}
                value={q}
                onChangeText={setQ}
                placeholder="Search name or phone…"
                placeholderTextColor={colors.muted}
                autoFocus
              />
              <FlatList
                data={rows}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={s.empty}>No matches</Text>}
                ListFooterComponent={
                  <Pressable
                    style={s.newRow}
                    onPress={() => {
                      setCreating(true);
                      setName(q);
                      setError("");
                    }}
                  >
                    <Text style={s.newText}>+ New customer</Text>
                  </Pressable>
                }
                renderItem={({ item }) => {
                  const active = item.id === value;
                  return (
                    <Pressable
                      style={[s.row, active && s.rowActive]}
                      onPress={() => {
                        onChange(item.id);
                        setOpen(false);
                      }}
                    >
                      <View style={s.flex1}>
                        <Text style={s.name}>{item.name}</Text>
                        <Text style={s.phone}>{item.phone}</Text>
                      </View>
                      {active && <Text style={s.check}>✓</Text>}
                    </Pressable>
                  );
                }}
              />
            </>
          )}
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
  phone: { fontSize: 13, color: colors.muted, marginTop: 1 },
  check: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  empty: { textAlign: "center", color: colors.muted, padding: 28, fontSize: 14 },
  newRow: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface },
  newText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  createBox: { paddingTop: 4 },
  createActions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 4 },
  backBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  backText: { fontSize: 15, fontWeight: "600", color: colors.muted },
  createBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: colors.danger,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
  },
});
