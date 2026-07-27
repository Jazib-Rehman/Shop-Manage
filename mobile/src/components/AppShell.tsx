import { Ionicons } from "@expo/vector-icons";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

type Link = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tab: string;
  screen?: string;
};

const groups: { id: string; label: string; links: Link[] }[] = [
  {
    id: "stock",
    label: "Inventory",
    links: [
      { label: "Stock & costs", icon: "cube-outline", tab: "Inventory" },
      { label: "Marble catalog", icon: "layers-outline", tab: "More", screen: "Catalog" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    links: [
      { label: "Purchases", icon: "cart-outline", tab: "Purchases" },
      { label: "Trips & freight", icon: "bus-outline", tab: "More", screen: "Trips" },
      { label: "Sales", icon: "cash-outline", tab: "Sales" },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    links: [
      { label: "Partners", icon: "people-outline", tab: "More", screen: "Partners" },
      { label: "Customers", icon: "person-outline", tab: "More", screen: "Customers" },
    ],
  },
];

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <SafeAreaView edges={["top"]} style={h.safe}>
      <View style={h.bar}>
        <Pressable onPress={onMenu} hitSlop={10} style={h.btn} accessibilityLabel="Open menu">
          <Ionicons name="menu" size={24} color={colors.text} />
        </Pressable>
        <View style={h.brand}>
          <View style={h.logo}>
            <Text style={h.logoText}>SM</Text>
          </View>
          <Text style={h.title}>Shop Manager</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function AppSidebar({
  open,
  onClose,
  navRef,
}: {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navRef: NavigationContainerRefWithCurrent<any>;
}) {
  const { logout } = useAuth();
  const [expanded, setExpanded] = useState(() => new Set(groups.map((g) => g.id)));

  const go = (link: Link) => {
    onClose();
    if (link.screen) navRef.navigate(link.tab, { screen: link.screen });
    else navRef.navigate(link.tab);
  };

  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={d.root}>
        <SafeAreaView style={d.drawer} edges={["top", "bottom"]}>
          <Pressable
            style={d.brand}
            onPress={() => {
              onClose();
              navRef.navigate("Dashboard");
            }}
          >
            <View style={d.logo}>
              <Text style={d.logoText}>SM</Text>
            </View>
            <View>
              <Text style={d.brandTitle}>Shop Manager</Text>
              <Text style={d.brandSub}>Marble inventory</Text>
            </View>
          </Pressable>

          <ScrollView contentContainerStyle={d.nav} showsVerticalScrollIndicator={false}>
            <Pressable
              style={d.dash}
              onPress={() => {
                onClose();
                navRef.navigate("Dashboard");
              }}
            >
              <Ionicons name="grid-outline" size={18} color="#ccfbf1" />
              <Text style={d.dashText}>Dashboard</Text>
            </Pressable>

            {groups.map((g) => {
              const on = expanded.has(g.id);
              return (
                <View key={g.id} style={d.group}>
                  <Pressable style={d.groupBtn} onPress={() => toggle(g.id)}>
                    <Text style={d.groupLabel}>{g.label}</Text>
                    <Ionicons
                      name={on ? "chevron-down" : "chevron-forward"}
                      size={14}
                      color="#a1a1aa"
                    />
                  </Pressable>
                  {on &&
                    g.links.map((link) => (
                      <Pressable key={link.label} style={d.link} onPress={() => go(link)}>
                        <Ionicons name={link.icon} size={17} color="#d4d4d8" />
                        <Text style={d.linkText}>{link.label}</Text>
                      </Pressable>
                    ))}
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            style={d.logout}
            onPress={() => {
              onClose();
              logout();
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fca5a5" />
            <Text style={d.logoutText}>Sign out</Text>
          </Pressable>
        </SafeAreaView>
        <Pressable style={d.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const h = StyleSheet.create({
  safe: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  btn: { padding: 4 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
});

const d = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  backdrop: { flex: 1, backgroundColor: "rgba(24,24,27,0.5)" },
  drawer: { width: 288, maxWidth: "82%", backgroundColor: "#18181b", height: "100%" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#14b8a6",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  brandTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  brandSub: { color: "#a1a1aa", fontSize: 12, marginTop: 1 },
  nav: { padding: 12, gap: 4, paddingBottom: 24 },
  dash: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(20,184,166,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dashText: { color: "#ccfbf1", fontSize: 15, fontWeight: "600" },
  group: { marginBottom: 8 },
  groupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  groupLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  linkText: { color: "#e4e4e7", fontSize: 15, fontWeight: "500" },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  logoutText: { color: "#fca5a5", fontSize: 15, fontWeight: "600" },
});
