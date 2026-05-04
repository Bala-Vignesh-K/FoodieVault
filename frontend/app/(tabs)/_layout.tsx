import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { colors, shadows } from "../../src/theme";

function ShareFab() {
  const router = useRouter();
  return (
    <TouchableOpacity
      testID="share-fab"
      onPress={() => router.push("/share")}
      style={styles.fab}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={30} color="#fff" />
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: {
            backgroundColor: colors.cardBg,
            borderTopWidth: 0,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 10,
            height: Platform.OS === "ios" ? 88 : 70,
            paddingBottom: Platform.OS === "ios" ? 28 : 10,
            paddingTop: 10,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarTestID: "tab-home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="places"
          options={{
            title: "Places",
            tabBarTestID: "tab-places",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "location" : "location-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="recipes"
          options={{
            title: "Recipes",
            tabBarTestID: "tab-recipes",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="items"
          options={{
            title: "Order",
            tabBarTestID: "tab-items",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "bag-handle" : "bag-handle-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarTestID: "tab-profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
            ),
          }}
        />
      </Tabs>
      <ShareFab />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: Platform.OS === "ios" ? 100 : 84,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primary,
  },
});
