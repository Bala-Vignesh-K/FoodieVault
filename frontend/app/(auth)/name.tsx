import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, shadows, radii, spacing } from "../../src/theme";
import { authApi } from "../../src/api";
import { useAuth } from "../../src/AuthContext";

export default function NameScreen() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await authApi.updateProfile(name.trim());
      setUser(res.data.user);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.content}>
          <View style={styles.emoji} testID="welcome-emoji">
            <Ionicons name="hand-right" size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>Welcome{"\n"}to the vault</Text>
          <Text style={styles.sub}>
            What should we call you? Your name will appear on your profile.
          </Text>

          <TextInput
            testID="name-input"
            placeholder="e.g. Alex Chen"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            maxLength={60}
          />

          <TouchableOpacity
            testID="save-name-btn"
            onPress={handleSave}
            disabled={!name.trim() || loading}
            style={[styles.btn, (!name.trim() || loading) && styles.btnDisabled]}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnText}>Let's go</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  emoji: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md },
  sub: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadows.primary,
  },
  btnText: { color: "#fff", ...typography.button },
  btnDisabled: { opacity: 0.5 },
});
