import { Ionicons } from "@expo/vector-icons";
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AppHeader, AppSidebar } from "./src/components/AppShell";
import {
  ForgotScreen,
  LoginScreen,
  SignupScreen,
  type AuthStackParams,
} from "./src/screens/auth/AuthScreens";
import { CatalogScreen } from "./src/screens/CatalogScreen";
import { CustomersScreen } from "./src/screens/CustomersScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { InventoryScreen } from "./src/screens/InventoryScreen";
import { MoreHomeScreen, type MoreStackParams } from "./src/screens/MoreScreen";
import { PartnerDetailScreen } from "./src/screens/PartnerDetailScreen";
import { PartnersScreen } from "./src/screens/PartnersScreen";
import { PurchasesScreen } from "./src/screens/PurchasesScreen";
import { SalesScreen } from "./src/screens/SalesScreen";
import { TripsScreen } from "./src/screens/TripsScreen";
import { ShopProvider } from "./src/shop/ShopContext";
import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator<AuthStackParams>();
const MoreStack = createNativeStackNavigator<MoreStackParams>();

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 4, marginRight: 4 }}>
      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
    </Pressable>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? <BackBtn onPress={() => navigation.goBack()} /> : null,
      })}
    >
      <MoreStack.Screen name="MoreHome" component={MoreHomeScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="Catalog" component={CatalogScreen} options={{ title: "Marbles" }} />
      <MoreStack.Screen name="Trips" component={TripsScreen} options={{ title: "Trips" }} />
      <MoreStack.Screen name="Partners" component={PartnersScreen} options={{ title: "Partners" }} />
      <MoreStack.Screen
        name="PartnerDetail"
        component={PartnerDetailScreen}
        options={{ title: "Partner account" }}
      />
      <MoreStack.Screen name="Customers" component={CustomersScreen} options={{ title: "Customers" }} />
    </MoreStack.Navigator>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={
              {
                Dashboard: "grid-outline",
                Inventory: "cube-outline",
                Purchases: "cart-outline",
                Sales: "cash-outline",
                More: "menu-outline",
              }[route.name] as keyof typeof Ionicons.glyphMap
            }
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen name="Purchases" component={PurchasesScreen} />
      <Tab.Screen name="Sales" component={SalesScreen} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

function Root({
  navRef,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navRef: ReturnType<typeof useNavigationContainerRef>;
}) {
  const { ready, authed } = useAuth();
  const [menu, setMenu] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!authed) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Signup" component={SignupScreen} />
        <AuthStack.Screen name="Forgot" component={ForgotScreen} />
      </AuthStack.Navigator>
    );
  }
  return (
    <ShopProvider>
      <View style={{ flex: 1 }}>
        <AppHeader onMenu={() => setMenu(true)} />
        <Tabs />
        <AppSidebar open={menu} onClose={() => setMenu(false)} navRef={navRef} />
      </View>
    </ShopProvider>
  );
}

export default function App() {
  const navRef = useNavigationContainerRef();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer
          ref={navRef}
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: colors.background,
              primary: colors.primary,
              card: colors.surface,
              text: colors.text,
              border: colors.border,
            },
          }}
        >
          <StatusBar style="dark" />
          <Root navRef={navRef} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
