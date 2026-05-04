import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, typography, radii, spacing, shadows } from "../../src/theme";
import { itemsApi, swiggyApi, SavedItem } from "../../src/api";
import { PlatformBadge } from "../../src/components";

export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<SavedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await itemsApi.get(id as string);
      setItem(res.data);
    } catch (e) {
      Alert.alert("Error", "Item not found");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavorite = async () => {
    if (!item) return;
    const updated = { ...item, favorite: !item.favorite };
    setItem(updated);
    try {
      await itemsApi.update(item.id, { favorite: updated.favorite });
    } catch {
      setItem(item);
    }
  };

  const handleNavigate = () => {
    if (!item?.location) {
      return Alert.alert("No location", "This save doesn't have a location set.");
    }
    const q = encodeURIComponent(item.location);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    Linking.openURL(url);
  };

  const handleOpenSource = () => {
    if (item?.source_url) Linking.openURL(item.source_url);
  };

  const handleSwiggyOrder = async (kind: "food" | "ingredients") => {
    if (!item) return;
    setOrdering(true);
    try {
      const res = await swiggyApi.order(item.id, kind);
      setOrderResult(res.data);
    } catch (e: any) {
      Alert.alert("Couldn't place order", e?.response?.data?.detail || "Try again");
    } finally {
      setOrdering(false);
    }
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert("Delete this save?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await itemsApi.delete(item.id);
            router.back();
          } catch {
            Alert.alert("Error", "Couldn't delete");
          }
        },
      },
    ]);
  };

  if (loading || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasLocation = !!item.location;
  const isRecipe = item.type === "recipe";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.heroImg} />
          ) : (
            <View style={[styles.heroImg, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="image" size={48} color={colors.secondary} />
            </View>
          )}
          <LinearGradient colors={["rgba(26,23,20,0.5)", "transparent", "rgba(26,23,20,0.6)"]} style={StyleSheet.absoluteFillObject} />

          <SafeAreaView edges={["top"]} style={styles.heroOverlay}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.iconBtn}
                testID="detail-back-btn"
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={toggleFavorite}
                  style={styles.iconBtn}
                  testID="detail-favorite-btn"
                >
                  <Ionicons
                    name={item.favorite ? "heart" : "heart-outline"}
                    size={22}
                    color={item.favorite ? colors.primary : "#fff"}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} testID="detail-delete-btn">
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {item.source_platform && (
              <View style={{ alignSelf: "flex-start", marginTop: "auto", marginLeft: spacing.lg }}>
                <View style={styles.sourcePill}>
                  <PlatformBadge platform={item.source_platform} />
                  <Text style={styles.sourceText}>Via {item.source_platform}</Text>
                </View>
              </View>
            )}
          </SafeAreaView>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{item.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.title} testID="detail-title">{item.name}</Text>

          <View style={styles.metaCol}>
            {item.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={styles.metaText}>{item.location}</Text>
              </View>
            )}
            {item.cuisine && (
              <View style={styles.metaItem}>
                <Ionicons name="restaurant" size={16} color={colors.primary} />
                <Text style={styles.metaText}>{item.cuisine}</Text>
              </View>
            )}
          </View>

          {item.description && (
            <>
              <Text style={styles.sectionLabel}>ABOUT</Text>
              <Text style={styles.body}>{item.description}</Text>
            </>
          )}

          {item.dishes && item.dishes.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>WHAT TO GET</Text>
              <View style={styles.chipsRow}>
                {item.dishes.map((d, i) => (
                  <View key={i} style={styles.chip}>
                    <Ionicons name="restaurant-outline" size={12} color={colors.primary} />
                    <Text style={styles.chipText}>{d}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {item.ingredients && item.ingredients.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>INGREDIENTS</Text>
              <View style={styles.ingredientsCard}>
                {item.ingredients.map((d, i) => (
                  <View key={i} style={styles.ingredientRow}>
                    <View style={styles.ingredientBullet} />
                    <Text style={styles.ingredientText}>{d}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {item.tags && item.tags.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>TAGS</Text>
              <View style={styles.chipsRow}>
                {item.tags.map((t, i) => (
                  <View key={i} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>#{t}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {item.notes && (
            <>
              <Text style={styles.sectionLabel}>YOUR NOTES</Text>
              <View style={styles.notesCard}>
                <Text style={styles.body}>{item.notes}</Text>
              </View>
            </>
          )}

          {item.source_url && (
            <TouchableOpacity
              onPress={handleOpenSource}
              style={styles.sourceLink}
              testID="detail-open-source"
            >
              <Ionicons name="open-outline" size={16} color={colors.primary} />
              <Text style={styles.sourceLinkText}>Open original post</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Floating action bar */}
      <View style={styles.actionBar}>
        {hasLocation && (
          <TouchableOpacity
            onPress={handleNavigate}
            style={[styles.actionBtn, styles.secondaryAction]}
            testID="detail-navigate-btn"
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={18} color={colors.textPrimary} />
            <Text style={styles.secondaryActionText}>Navigate</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => handleSwiggyOrder(isRecipe ? "ingredients" : "food")}
          style={[styles.actionBtn, styles.primaryAction]}
          testID="detail-order-btn"
          disabled={ordering}
          activeOpacity={0.85}
        >
          {ordering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="bag-handle" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>
                {isRecipe ? "Order Ingredients" : "Order on Swiggy"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Swiggy order modal */}
      <Modal
        visible={!!orderResult}
        transparent
        animationType="slide"
        onRequestClose={() => setOrderResult(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet} testID="order-modal">
            <View style={styles.modalHandle} />
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>Order placed!</Text>
            <Text style={styles.modalSub}>
              {orderResult?.order_type === "ingredients" ? "Ingredients from Instamart" : "Food from Swiggy"}
            </Text>

            <View style={styles.modalCard}>
              <ModalRow label="Order ID" value={orderResult?.order_id || ""} />
              <View style={styles.modalDivider} />
              <ModalRow label="Item" value={orderResult?.item_name || ""} />
              <View style={styles.modalDivider} />
              <ModalRow label="ETA" value={`~${orderResult?.eta_minutes} min`} />
              <View style={styles.modalDivider} />
              <ModalRow label="Est. amount" value={`₹${orderResult?.estimated_amount}`} />
            </View>

            <View style={styles.mockedBanner}>
              <Ionicons name="flask" size={14} color={colors.secondary} />
              <Text style={styles.mockedText}>
                <Text style={{ fontWeight: "900" }}>DEMO MODE:</Text> Real Swiggy integration unlocks once you're approved at mcp.swiggy.com/builders.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setOrderResult(null)}
              style={styles.modalClose}
              testID="order-modal-close"
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.modalRow}>
      <Text style={styles.modalRowLabel}>{label}</Text>
      <Text style={styles.modalRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  hero: { height: 380, backgroundColor: colors.backgroundSecondary, position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(26,23,20,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
  },
  sourceText: { fontSize: 12, fontWeight: "700", color: colors.textPrimary, textTransform: "capitalize" },
  content: {
    padding: spacing.lg,
    backgroundColor: colors.backgroundPrimary,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    marginTop: -24,
  },
  typeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  typeChipText: { ...typography.label, color: colors.primary, fontSize: 10 },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md },
  metaCol: { gap: 6, marginBottom: spacing.lg },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardBg,
    borderRadius: radii.pill,
    ...shadows.soft,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  ingredientsCard: {
    backgroundColor: colors.cardBg,
    padding: spacing.md,
    borderRadius: radii.lg,
    ...shadows.soft,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  ingredientText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.pill,
  },
  tagChipText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  notesCard: {
    backgroundColor: "#FFF8EF",
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#F0E4D2",
  },
  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: 10,
  },
  sourceLinkText: { color: colors.primary, fontWeight: "700" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 34,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryAction: { backgroundColor: colors.backgroundSecondary },
  secondaryActionText: { ...typography.button, color: colors.textPrimary },
  primaryAction: { backgroundColor: colors.primary, ...shadows.primary, flex: 1.3 },
  primaryActionText: { ...typography.button, color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.xl,
    paddingBottom: 40,
    alignItems: "center",
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 4 },
  modalSub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  modalCard: {
    width: "100%",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  modalRowLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "600" },
  modalRowValue: { ...typography.body, color: colors.textPrimary, fontWeight: "800" },
  modalDivider: { height: 1, backgroundColor: colors.border },
  mockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    backgroundColor: "#FFF8EF",
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#F0E4D2",
  },
  mockedText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  modalClose: {
    width: "100%",
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radii.pill,
    alignItems: "center",
    ...shadows.primary,
  },
  modalCloseText: { color: "#fff", ...typography.button },
});
