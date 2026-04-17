import { Tabs, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shipments"
        options={{
          title: 'Mes envois',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens (not in tab bar) */}
      <Tabs.Screen name="new-delivery" options={{ href: null }} />
      <Tabs.Screen name="driver-selection" options={{ href: null }} />
      <Tabs.Screen name="searching" options={{ href: null }} />
      <Tabs.Screen name="active-delivery" options={{ href: null }} />
      <Tabs.Screen name="delivery-complete" options={{ href: null }} />
    </Tabs>
  );
}
