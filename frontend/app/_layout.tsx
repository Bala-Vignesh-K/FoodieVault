import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../src/AuthContext";
import { View, ActivityIndicator } from "react-native";
import { colors } from "../src/theme";
import { useShareIntentListener } from "../src/useShareIntent";

function RootNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useShareIntentListener();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";

    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && !user.onboarded && segments[1] !== "name") {
      router.replace("/(auth)/name");
    } else if (user && user.onboarded && (inAuth || segments.length === 0)) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.backgroundPrimary }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.backgroundPrimary } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="detail/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="share" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="confirm" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNav />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
