import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, typography, radii, spacing, shadows } from "../src/theme";
import { itemsApi, ContentType, ExtractedContent } from "../src/api";
import { PlatformBadge } from "../src/components";

type CT = ContentType;

export default function Confirm() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const initial = useMemo<ExtractedContent>(() => {
    try {
      return JSON.parse(data || "{}");
    } catch {
      return {} as ExtractedContent;
    }
  }, [data]);

  const [type, setType] = useState<CT>(initial.suggested_type || "place");
  const [name, setName] = useState(initial.name || "");
  const [description, setDescription] = useState(initial.description || "");
  const [location, setLocation] = useState(initial.location || "");
  const [cuisine, setCuisine] = useState(initial.cuisine || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert("Name required", "Give your save a name");
    setSaving(true);
    try {
      await itemsApi.create({
        type,
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        cuisine: cuisine.trim() || null,
        ingredients: initial.ingredients || [],
        dishes: initial.dishes || [],
        source_platform: initial.source_platform,
        source_url: initial.source_url,
        thumbnail_url: initial.thumbnail_url || null,
        tags: initial.tags || [],
        notes: notes.trim() || null,
      });
      router.replace("/(tabs)");
      setTimeout(() => {
        Alert.alert("Saved!", `${name} has been added to your vault.`);
      }, 300);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const typeOptions: { key: CT; label: string; icon: any }[] = [
    { key: "place", label: "Place", icon: "location" },
    { key: "recipe", label: "Recipe", icon: "restaurant" },
    { key: "item", label: "To Order", icon: "bag-handle" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            testID="confirm-close"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerMiddle}>
            <View style={styles.aiChip}>
              <Ionicons name="sparkles" size={12} color={colors.primary} />
              <Text style={styles.aiChipText}>AI EXTRACTED</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {initial.thumbnail_url ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: initial.thumbnail_url }} style={styles.image} />
              {initial.source_platform && <PlatformBadge platform={initial.source_platform} />}
            </View>
          ) : null}

          <Text style={styles.label}>TYPE</Text>
          <View style={styles.typeRow}>
            {typeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                testID={`type-${opt.key}`}
                onPress={() => setType(opt.key)}
                style={[styles.typeBtn, type === opt.key && styles.typeBtnActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={type === opt.key ? "#fff" : colors.textPrimary}
                />
                <Text style={[styles.typeBtnText, type === opt.key && styles.typeBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="NAME" value={name} onChange={setName} testID="confirm-name" />
          <Field
            label="DESCRIPTION"
            value={description}
            onChange={setDescription}
            multiline
            testID="confirm-description"
          />
          {type === "place" && (
            <Field label="LOCATION" value={location} onChange={setLocation} testID="confirm-location" />
          )}
          <Field label="CUISINE" value={cuisine} onChange={setCuisine} testID="confirm-cuisine" />

          {initial.dishes && initial.dishes.length > 0 && (
            <>
              <Text style={styles.label}>DISHES FOUND</Text>
              <View style={styles.chipsRow}>
                {initial.dishes.map((d, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{d}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {initial.ingredients && initial.ingredients.length > 0 && (
            <>
              <Text style={styles.label}>INGREDIENTS</Text>
              <View style={styles.chipsRow}>
                {initial.ingredients.map((d, i) => (
                  <View key={i} style={styles.chipGreen}>
                    <Text style={styles.chipText}>{d}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Field
            label="YOUR NOTES (OPTIONAL)"
            value={notes}
            onChange={setNotes}
            multiline
            placeholder="Anything you want to remember..."
            testID="confirm-notes"
          />

          <View style={{ height: 80 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            testID="confirm-save-btn"
            onPress={handleSave}
            disabled={!name.trim() || saving}
            style={[styles.saveBtn, (!name.trim() || saving) && styles.ctaDisabled]}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bookmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save to Vault</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  testID: string;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
        multiline={multiline}
      />
    </>
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
  headerMiddle: { flex: 1, alignItems: "center" },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  aiChipText: { ...typography.label, color: colors.primary, fontSize: 10 },
  scroll: { padding: spacing.lg },
  imageWrap: {
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.lg,
    aspectRatio: 16 / 9,
    backgroundColor: colors.backgroundSecondary,
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.pill,
  },
  typeBtnActive: { backgroundColor: colors.primary },
  typeBtnText: { ...typography.bodySmall, fontWeight: "800", color: colors.textPrimary },
  typeBtnTextActive: { color: "#fff" },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
  },
  chipGreen: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#E8EDE6",
    borderRadius: radii.pill,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.cardBg,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.primary,
  },
  saveBtnText: { color: "#fff", ...typography.button },
  ctaDisabled: { opacity: 0.5 },
});
