import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

export type MoreStackParams = {
  MoreHome: undefined;
  Catalog: undefined;
  Partners: undefined;
  PartnerDetail: { id: string };
  Customers: undefined;
  Trips: undefined;
};

type Nav = NativeStackNavigationProp<MoreStackParams>;

const links: {
  name: "Catalog" | "Trips" | "Partners" | "Customers";
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    name: "Catalog",
    title: "Marbles",
    subtitle: "Names, sizes & weight",
    icon: "layers-outline",
  },
  {
    name: "Trips",
    title: "Trips",
    subtitle: "Freight per ton",
    icon: "bus-outline",
  },
  {
    name: "Partners",
    title: "Partners",
    subtitle: "Ownership & income split",
    icon: "people-outline",
  },
  {
    name: "Customers",
    title: "Customers",
    subtitle: "Credit / partial sales",
    icon: "person-outline",
  },
];

export function MoreHomeScreen() {
  const nav = useNavigation<Nav>();
  const { logout } = useAuth();

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <View style={s.container}>
        <Text style={s.title}>More</Text>
        <Text style={s.subtitle}>Catalog · Trips · Partners · Customers</Text>

        <View style={s.list}>
          {links.map((l) => (
            <Pressable key={l.name} style={s.row} onPress={() => nav.navigate(l.name)}>
              <View style={s.icon}>
                <Ionicons name={l.icon} size={20} color={colors.primary} />
              </View>
              <View style={s.flex1}>
                <Text style={s.rowTitle}>{l.title}</Text>
                <Text style={s.rowSub}>{l.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={s.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={s.logoutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  list: { gap: 10 },
  flex1: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  rowDisabled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 14,
    padding: 14,
    opacity: 0.85,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  logout: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: "600" },
});
