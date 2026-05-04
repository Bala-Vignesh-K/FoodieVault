import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, typography, radii, spacing, shadows } from "../src/theme";
import { extractApi } from "../src/api";

export default function Share() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(params.url || "");
  const [loading, setLoading] = useState(false);

  const isValidUrl = /^https?:\/\//.test(url.trim());

  const handleExtract = async () => {
    if (!isValidUrl) return;
    setLoading(true);
    try {
      const res = await extractApi.fromUrl(url.trim());
      router.replace({
        pathname: "/confirm",
        params: { data: JSON.stringify(res.data) },
      });
    } catch (e: any) {
      Alert.alert(
        "Couldn't analyze that link",
        e?.response?.data?.detail || "Please try another URL from Instagram, YouTube or TikTok."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            testID="share-close-btn"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Save a find</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles" size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>Paste the link</Text>
          <Text style={styles.sub}>
            From Instagram, YouTube or TikTok. Our AI will extract the place, recipe or dish.
          </Text>

          <View style={styles.inputCard}>
            <Ionicons name="link" size={18} color={colors.textSecondary} />
            <TextInput
              testID="share-url-input"
              placeholder="https://..."
              placeholderTextColor={colors.textTertiary}
              value={url}
              onChangeText={setUrl}
              style={styles.input}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleExtract}
              autoFocus={!params.url}
            />
            {url !== "" && (
              <TouchableOpacity onPress={() => setUrl("")} testID="share-clear-btn">
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            testID="share-analyze-btn"
            onPress={handleExtract}
            disabled={!isValidUrl || loading}
            style={[styles.cta, (!isValidUrl || loading) && styles.ctaDisabled]}
            activeOpacity={0.85}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.ctaText}>Analyzing with AI...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.ctaText}>Analyze with AI</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Supported platforms */}
          <View style={styles.platforms}>
            <Text style={styles.platformLabel}>SUPPORTED PLATFORMS</Text>
            <View style={styles.platformRow}>
              <View style={styles.platformItem}>
                <Ionicons name="logo-instagram" size={22} color={colors.instagram} />
                <Text style={styles.platformText}>Instagram</Text>
              </View>
              <View style={styles.platformItem}>
                <Ionicons name="logo-youtube" size={22} color={colors.youtube} />
                <Text style={styles.platformText}>YouTube</Text>
              </View>
              <View style={styles.platformItem}>
                <Ionicons name="logo-tiktok" size={22} color={colors.tiktok} />
                <Text style={styles.platformText}>TikTok</Text>
              </View>
            </View>
          </View>

          {/* Tip */}
          <View style={styles.tip}>
            <Ionicons name="bulb" size={16} color={colors.secondary} />
            <Text style={styles.tipText}>
              <Text style={{ fontWeight: "800" }}>Tip:</Text> In production builds, tap Share from any app and pick FoodieVault—it opens right here with the URL ready.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...typography.h4, color: colors.textPrimary },
  scroll: { padding: spacing.lg, alignItems: "stretch" },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
  inputCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  input: { flex: 1, paddingVertical: 18, fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.primary,
  },
  ctaText: { color: "#fff", ...typography.button },
  ctaDisabled: { opacity: 0.5 },
  platforms: { marginTop: spacing.xxl },
  platformLabel: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.md },
  platformRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xl },
  platformItem: { alignItems: "center", gap: 6 },
  platformText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
  tip: {
    flexDirection: "row",
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginTop: spacing.xl,
    gap: 10,
  },
  tipText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
});
