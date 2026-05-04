import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, shadows, radii, spacing } from "../../src/theme";
import { authApi } from "../../src/api";
import { useAuth } from "../../src/AuthContext";

export default function Login() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { signIn } = useAuth();

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSendOtp = async () => {
    if (!isValidEmail) return;
    setLoading(true);
    try {
      const res = await authApi.requestOtp(email.trim().toLowerCase());
      setDevOtp(res.data.dev_otp || null);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code || otp.join("");
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email.trim().toLowerCase(), otpCode);
      await signIn(res.data.token, res.data.user);
    } catch (e: any) {
      Alert.alert("Incorrect code", e?.response?.data?.detail || "Please try again");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, idx: number) => {
    if (val.length > 1) {
      // paste scenario
      const digits = val.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => (newOtp[i] = d));
      setOtp(newOtp);
      if (digits.length === 6) {
        Keyboard.dismiss();
        handleVerifyOtp(digits.join(""));
      } else {
        otpRefs.current[Math.min(digits.length, 5)]?.focus();
      }
      return;
    }
    const newOtp = [...otp];
    newOtp[idx] = val.replace(/\D/g, "");
    setOtp(newOtp);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (newOtp.every((d) => d !== "") && idx === 5) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <LinearGradient
        colors={[colors.primarySoft, colors.backgroundPrimary]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.logoBadge} testID="app-logo">
                <Ionicons name="bookmark" size={28} color={colors.primary} />
              </View>
              <Text style={styles.brand}>FoodieVault</Text>
            </View>

            {step === "email" ? (
              <View style={styles.card} testID="login-email-card">
                <Text style={styles.headline}>Discover.{"\n"}Save.{"\n"}Taste.</Text>
                <Text style={styles.sub}>
                  Save places, recipes & dishes from Instagram, YouTube and TikTok—all in one vault.
                </Text>

                <View style={styles.label}>
                  <Text style={styles.labelText}>EMAIL</Text>
                </View>
                <TextInput
                  testID="email-input"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="go"
                  onSubmitEditing={handleSendOtp}
                />

                <TouchableOpacity
                  testID="send-otp-btn"
                  style={[styles.primaryBtn, (!isValidEmail || loading) && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={!isValidEmail || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                <Text style={styles.terms}>
                  By continuing you agree to our Terms & Privacy Policy.
                </Text>
              </View>
            ) : (
              <View style={styles.card} testID="login-otp-card">
                <TouchableOpacity
                  onPress={() => setStep("email")}
                  style={styles.backBtn}
                  testID="back-to-email-btn"
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headline}>Enter the{"\n"}6-digit code</Text>
                <Text style={styles.sub}>
                  We sent it to <Text style={{ fontWeight: "800", color: colors.textPrimary }}>{email}</Text>
                </Text>

                <View style={styles.otpRow}>
                  {otp.map((d, idx) => (
                    <TextInput
                      key={idx}
                      ref={(r) => (otpRefs.current[idx] = r)}
                      testID={`otp-digit-${idx}`}
                      value={d}
                      onChangeText={(v) => handleOtpChange(v, idx)}
                      onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                      keyboardType="number-pad"
                      maxLength={idx === 0 ? 6 : 1}
                      style={[styles.otpBox, d ? styles.otpBoxFilled : null]}
                      selectionColor={colors.primary}
                    />
                  ))}
                </View>

                {devOtp && (
                  <View style={styles.devBanner} testID="dev-otp-banner">
                    <Ionicons name="flask" size={14} color={colors.secondary} />
                    <Text style={styles.devText}>Dev mode: OTP is <Text style={{ fontWeight: "900" }}>{devOtp}</Text></Text>
                  </View>
                )}

                <TouchableOpacity
                  testID="verify-otp-btn"
                  style={[styles.primaryBtn, (otp.join("").length !== 6 || loading) && styles.btnDisabled]}
                  onPress={() => handleVerifyOtp()}
                  disabled={otp.join("").length !== 6 || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & Continue</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={loading}
                  style={styles.resendBtn}
                  testID="resend-otp-btn"
                >
                  <Text style={styles.resendText}>Didn't receive it? Resend code</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "space-between" },
  hero: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.lg },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  brand: { ...typography.h3, color: colors.textPrimary },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginTop: spacing.md,
    ...shadows.soft,
  },
  headline: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  label: { marginBottom: spacing.sm },
  labelText: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 18,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadows.primary,
  },
  primaryBtnText: { color: "#fff", ...typography.button },
  btnDisabled: { opacity: 0.5 },
  terms: { textAlign: "center", marginTop: spacing.lg, color: colors.textTertiary, fontSize: 12 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: "transparent",
  },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backText: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: "700" },
  resendBtn: { alignItems: "center", marginTop: spacing.md, paddingVertical: spacing.sm },
  resendText: { ...typography.bodySmall, color: colors.primary, fontWeight: "700" },
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    alignSelf: "flex-start",
  },
  devText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
});
