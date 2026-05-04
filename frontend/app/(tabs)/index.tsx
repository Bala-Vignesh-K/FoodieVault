import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, typography, shadows, radii, spacing } from "../../src/theme";
import { useAuth } from "../../src/AuthContext";
import { itemsApi, SavedItem, Stats } from "../../src/api";
import { PlatformBadge } from "../../src/components";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ place: 0, recipe: 0, item: 0, total: 0, favorites: 0 });
  const [recent, setRecent] = useState<SavedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([itemsApi.stats(), itemsApi.list()]);
      setStats(s.data);
      setRecent(r.data.items.slice(0, 5));
    } catch (e) {
      console.log("home load error", e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstName = (user?.name || "friend").split(" ")[0];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hey {firstName}</Text>
            <Text style={styles.greetingSub}>What are we saving today?</Text>
          </View>
          <TouchableOpacity
            testID="profile-avatar"
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {(user?.name?.[0] || user?.email?.[0] || "?").toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero CTA */}
        <TouchableOpacity
          testID="share-hero-cta"
          onPress={() => router.push("/share")}
          style={styles.heroCta}
          activeOpacity={0.92}
        >
          <View style={styles.heroIconWrap}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Paste a link to save</Text>
            <Text style={styles.heroSub}>Instagram, YouTube or TikTok</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={30} color={colors.primary} />
        </TouchableOpacity>

        {/* Stats bento */}
        <Text style={styles.sectionLabel}>YOUR VAULT</Text>
        <View style={styles.bento}>
          <StatCard
            testID="stat-places"
            icon="location"
            label="Places"
            count={stats.place}
            tint={colors.primary}
            onPress={() => router.push("/(tabs)/places")}
          />
          <StatCard
            testID="stat-recipes"
            icon="restaurant"
            label="Recipes"
            count={stats.recipe}
            tint={colors.secondary}
            onPress={() => router.push("/(tabs)/recipes")}
          />
          <StatCard
            testID="stat-items"
            icon="bag-handle"
            label="To Order"
            count={stats.item}
            tint={"#8B6F47"}
            onPress={() => router.push("/(tabs)/items")}
          />
          <StatCard
            testID="stat-favorites"
            icon="heart"
            label="Favorites"
            count={stats.favorites}
            tint={colors.error}
            onPress={() => router.push("/(tabs)/places")}
          />
        </View>

        {/* Recent */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionLabel}>RECENTLY ADDED</Text>
          {recent.length > 0 && (
            <TouchableOpacity onPress={() => router.push("/(tabs)/places")} testID="see-all-btn">
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyRecent} testID="empty-home">
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmark" size={36} color={colors.secondary} />
            </View>
            <Text style={styles.emptyTitle}>Your vault is empty</Text>
            <Text style={styles.emptySub}>Share your first food find to get started</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {recent.map((item) => (
              <TouchableOpacity
                key={item.id}
                testID={`recent-item-${item.id}`}
                onPress={() => router.push(`/detail/${item.id}`)}
                style={styles.recentCard}
                activeOpacity={0.9}
              >
                {item.thumbnail_url ? (
                  <Image source={{ uri: item.thumbnail_url }} style={styles.recentImage} />
                ) : (
                  <View style={[styles.recentImage, { alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="image" size={30} color={colors.secondary} />
                  </View>
                )}
                {item.source_platform && <PlatformBadge platform={item.source_platform} />}
                <View style={styles.recentBody}>
                  <Text style={styles.recentTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.recentType}>{item.type.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  count,
  tint,
  onPress,
  testID,
}: {
  icon: any;
  label: string;
  count: number;
  tint: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.statCard}
    >
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greeting: { ...typography.h2, color: colors.textPrimary },
  greetingSub: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.primary + "30",
    ...shadows.soft,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { ...typography.h4, color: colors.textPrimary },
  heroSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.soft,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  statCount: { ...typography.h1, color: colors.textPrimary, fontSize: 36, marginBottom: 2 },
  statLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "700" },
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seeAll: { ...typography.bodySmall, color: colors.primary, fontWeight: "800" },
  recentCard: {
    width: 180,
    marginRight: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadows.soft,
  },
  recentImage: { width: "100%", height: 140, backgroundColor: colors.backgroundSecondary },
  recentBody: { padding: spacing.md },
  recentTitle: { ...typography.bodySmall, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
  recentType: { fontSize: 9, fontWeight: "900", color: colors.textSecondary, letterSpacing: 1.2 },
  emptyRecent: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: 4 },
  emptySub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center" },
});
