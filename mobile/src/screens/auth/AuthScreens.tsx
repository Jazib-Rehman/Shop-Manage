import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { colors } from "../../theme";

export type AuthStackParams = {
  Login: undefined;
  Signup: undefined;
  Forgot: undefined;
};

type Nav = NativeStackNavigationProp<AuthStackParams>;

function AuthCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.center}
      >
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.iconWrap}>
              <Ionicons name={icon} size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={s.title}>{title}</Text>
              <Text style={s.subtitle}>{subtitle}</Text>
            </View>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        {...props}
        style={s.input}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
      />
    </View>
  );
}

function SubmitButton({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.btn, busy && s.btnDisabled]} disabled={busy} onPress={onPress}>
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={s.btnText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function LoginScreen() {
  const nav = useNavigation<Nav>();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setBusy(false);
    }
  };

  return (
    <AuthCard icon="lock-closed-outline" title="Shop Manager" subtitle="Sign in to continue">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {!!error && <Text style={s.error}>{error}</Text>}
      <SubmitButton label="Sign in" busy={busy} onPress={submit} />
      <Pressable onPress={() => nav.navigate("Forgot")}>
        <Text style={s.link}>Forgot password?</Text>
      </Pressable>
      <Pressable onPress={() => nav.navigate("Signup")}>
        <Text style={s.linkMuted}>
          No account? <Text style={s.link}>Sign up</Text>
        </Text>
      </Pressable>
    </AuthCard>
  );
}

export function SignupScreen() {
  const nav = useNavigation<Nav>();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await signup(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
      setBusy(false);
    }
  };

  return (
    <AuthCard icon="person-add-outline" title="Create shop" subtitle="Your own empty inventory">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password (6+ chars)" value={password} onChangeText={setPassword} secureTextEntry />
      {!!error && <Text style={s.error}>{error}</Text>}
      <SubmitButton label="Sign up" busy={busy} onPress={submit} />
      <Pressable onPress={() => nav.navigate("Login")}>
        <Text style={s.linkMuted}>
          Have an account? <Text style={s.link}>Sign in</Text>
        </Text>
      </Pressable>
    </AuthCard>
  );
}

export function ForgotScreen() {
  const nav = useNavigation<Nav>();
  const { forgot } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    setDone("");
    try {
      setDone(await forgot(email.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard icon="mail-outline" title="Forgot password" subtitle="We’ll email you a reset link">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      {!!error && <Text style={s.error}>{error}</Text>}
      {!!done && <Text style={s.success}>{done}</Text>}
      <SubmitButton label="Send reset link" busy={busy} onPress={submit} />
      <Pressable onPress={() => nav.navigate("Login")}>
        <Text style={s.link}>Back to sign in</Text>
      </Pressable>
    </AuthCard>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  center: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 22,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: colors.primary, fontWeight: "600", textAlign: "center", fontSize: 14 },
  linkMuted: { color: colors.muted, textAlign: "center", fontSize: 14 },
  error: {
    color: colors.danger,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
  },
  success: {
    color: "#047857",
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
  },
});
