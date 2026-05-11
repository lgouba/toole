import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

const slides = [
  {
    id: '1',
    icon: 'cube-outline' as const,
    title: 'Envoyez en un clic',
    subtitle:
      "Faites livrer un colis partout en ville, à toute heure. C'est rapide et fiable.",
    color: colors.primary,
  },
  {
    id: '2',
    icon: 'navigate' as const,
    title: 'Suivez en direct',
    subtitle:
      'Visualisez votre livreur sur la carte en temps réel, du retrait à la livraison.',
    color: colors.secondary,
  },
  {
    id: '3',
    icon: 'shield-checkmark-outline' as const,
    title: 'Livraison sécurisée',
    subtitle:
      'Un code à 4 chiffres confirme chaque étape. Photo, contact et preuve à chaque livraison.',
    color: colors.success,
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const appName = useSettingsStore((s) => s.settings.appName);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      completeOnboarding();
      router.replace('/(auth)/login');
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    router.replace('/(auth)/login');
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header : logo + skip */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>{appName}</Text>
        {!isLastSlide ? (
          <TouchableOpacity onPress={handleSkip} hitSlop={10}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconBg, { backgroundColor: item.color + '14' }]}>
              <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={56} color={colors.white} />
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
      />

      {/* Dots animés */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Footer button */}
      <View style={styles.footer}>
        <Button
          title={isLastSlide ? 'Commencer' : 'Suivant'}
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  logo: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '800',
  },
  skipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconBg: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
