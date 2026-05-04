import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, typography, radii, spacing, shadows } from "./theme";
import { ItemCard, EmptyState } from "./components";
import { itemsApi, SavedItem, ContentType } from "./api";

export function ListScreen({
  title,
  subtitle,
  type,
  emptyIcon,
  emptyTitle,
  emptySub,
  testIdPrefix,
}: {
  title: string;
  subtitle: string;
  type: ContentType;
  emptyIcon: any;
  emptyTitle: string;
  emptySub: string;
  testIdPrefix: string;
}) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await itemsApi.list(type);
      setItems(res.data.items);
    } catch (e) {
      console.log("list load error", e);
    }
  }, [type]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      (it.location || "").toLowerCase().includes(q) ||
      (it.cuisine || "").toLowerCase().includes(q) ||
      it.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      {items.length > 0 && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            testID={`${testIdPrefix}-search`}
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={() => router.push(`/detail/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            subtitle={emptySub}
            actionLabel="Save your first"
            onAction={() => router.push("/share")}
            testID={`empty-${testIdPrefix}`}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  countBadge: {
    backgroundColor: colors.primary,
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    gap: 8,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
    color: colors.textPrimary,
  },
});
