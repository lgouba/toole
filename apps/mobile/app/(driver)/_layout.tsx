import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { NewRequestModal } from '@/components/NewRequestModal';

export default function DriverLayout() {
  return (
    <>
    <NewRequestModal />
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
        name="deliveries"
        options={{
          title: 'Livraisons',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Portefeuille',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
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
      {/* Hidden screens */}
      <Tabs.Screen
        name="new-request"
        options={{
          href: null,
          // Cache la tab bar quand une demande de course arrive : le livreur
          // doit accepter ou refuser explicitement, il ne peut pas s'echapper
          // de la modale par un tap accidentel sur un autre tab.
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="pickup-navigation" options={{ href: null }} />
      <Tabs.Screen name="pickup-confirm" options={{ href: null }} />
      <Tabs.Screen name="delivery-navigation" options={{ href: null }} />
      <Tabs.Screen name="code-validation" options={{ href: null }} />
      <Tabs.Screen name="delivery-confirm" options={{ href: null }} />
      <Tabs.Screen name="kyc" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
    </Tabs>
    </>
  );
}
