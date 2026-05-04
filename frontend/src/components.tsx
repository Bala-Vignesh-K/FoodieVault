import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, shadows, radii, spacing } from "./theme";
import { SavedItem, SourcePlatform } from "./api";

export function ItemCard({ item, onPress }: { item: SavedItem; onPress: () => void }) {
  const iconMap = {
    place: "location" as const,
    recipe: "restaurant" as const,
    item: "bag-handle" as const,
  };
  return (
    <TouchableOpacity
      testID={`item-card-${item.id}`}
      onPress={onPress}
      style={styles.card}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrap}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name={iconMap[item.type]} size={44} color={colors.secondary} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(26,23,20,0.55)"]}
          style={styles.imageGradient}
          pointerEvents="none"
        />
        {item.source_platform && <PlatformBadge platform={item.source_platform} />}
        {item.favorite && (
          <View style={styles.favBadge}>
            <Ionicons name="heart" size={14} color="#fff" />
          </View>
        )}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        {item.location && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.meta} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        )}
        {item.cuisine && !item.location && (
          <View style={styles.metaRow}>
            <Ionicons name="restaurant-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.meta} numberOfLines={1}>
              {item.cuisine}
            </Text>
          </View>
        )}
        {item.description && (
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function PlatformBadge({ platform }: { platform: SourcePlatform }) {
  const config: Record<SourcePlatform, { icon: any; color: string }> = {
    instagram: { icon: "logo-instagram", color: colors.instagram },
    youtube: { icon: "logo-youtube", color: colors.youtube },
    tiktok: { icon: "logo-tiktok", color: colors.tiktok },
    other: { icon: "link", color: colors.textSecondary },
  };
  const { icon, color } = config[platform] || config.other;
  return (
    <View style={[styles.platformBadge, { backgroundColor: color }]}>
      <Ionicons name={icon} size={12} color="#fff" />
    </View>
  );
}

export function Tag({ children }: { children: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  icon: any;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.empty} testID={testID || "empty-state"}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={44} color={colors.secondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={styles.emptyBtn}
          activeOpacity={0.85}
          testID="empty-state-action"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.emptyBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  imageWrap: { height: 200, position: "relative", backgroundColor: colors.backgroundSecondary },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  imageGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 100 },
  platformBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  favBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  cardBody: { padding: spacing.md },
  cardTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  meta: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  desc: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 4 },
  tag: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  tagText: { fontSize: 11, fontWeight: "700", color: colors.textPrimary },
  empty: {
    alignItems: "center",
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptySub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    ...shadows.primary,
  },
  emptyBtnText: { color: "#fff", ...typography.button },
});
