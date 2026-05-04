import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { colors, typography, radii, spacing, shadows } from "../../src/theme";
import { useAuth } from "../../src/AuthContext";
import { itemsApi, Stats } from "../../src/api";

export default function Profile() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ place: 0, recipe: 0, item: 0, total: 0, favorites: 0 });

  const load = useCallback(async () => {
    try {
      const s = await itemsApi.stats();
      setStats(s.data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need to verify your email again to return.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <Text style={styles.header}>Profile</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name?.[0] || user?.email?.[0] || "?").toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name || "Unnamed"}</Text>
          <Text style={styles.email} testID="profile-email">{user?.email}</Text>
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>YOUR JOURNEY</Text>
        <View style={styles.statsCard}>
          <StatRow label="Total Saved" value={stats.total} icon="bookmark" />
          <View style={styles.divider} />
          <StatRow label="Places" value={stats.place} icon="location" />
          <View style={styles.divider} />
          <StatRow label="Recipes" value={stats.recipe} icon="restaurant" />
          <View style={styles.divider} />
          <StatRow label="To Order" value={stats.item} icon="bag-handle" />
          <View style={styles.divider} />
          <StatRow label="Favorites" value={stats.favorites} icon="heart" />
        </View>

        {/* Settings */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="share-social"
            label="How to share from Instagram/YouTube"
            onPress={() =>
              Alert.alert(
                "Share from social apps",
                "1. Open Instagram/YouTube/TikTok\n2. Find a post or video\n3. Tap the Share icon\n4. Choose 'FoodieVault' from the share sheet\n\nNote: Share extension only works in production build, not in Expo Go preview. Use the + button in Expo Go to paste URLs manually.",
                [{ text: "Got it" }]
              )
            }
            testID="settings-share-guide"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="mail"
            label="Support"
            onPress={() => Linking.openURL("mailto:support@foodievault.app")}
            testID="settings-support"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="information-circle"
            label="About"
            onPress={() =>
              Alert.alert(
                "FoodieVault",
                "v1.0.0\n\nYour personal vault for food discoveries from social media. Save places, recipes and dishes, then order or navigate with one tap."
              )
            }
            testID="settings-about"
          />
        </View>

        <TouchableOpacity
          testID="sign-out-btn"
          onPress={handleSignOut}
          style={styles.signOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value, icon }: { label: string; value: number; icon: any }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statRowLeft}>
        <View style={styles.statRowIcon}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <Text style={styles.statRowLabel}>{label}</Text>
      </View>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

function SettingRow({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.settingRow} testID={testID} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={colors.textPrimary} />
      <Text style={styles.settingLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  header: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg },
  profileCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
    ...shadows.soft,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.primary,
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 30 },
  name: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
  email: { ...typography.bodySmall, color: colors.textSecondary },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.md },
  statsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.soft,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: spacing.sm },
  statRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statRowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  statRowLabel: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  statRowValue: { ...typography.h3, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginHorizontal: spacing.sm },
  settingsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.soft,
  },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: spacing.sm, gap: 12 },
  settingLabel: { ...typography.body, color: colors.textPrimary, flex: 1, fontWeight: "600" },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: spacing.md,
  },
  signOutText: { color: colors.error, fontWeight: "700", fontSize: 15 },
});
