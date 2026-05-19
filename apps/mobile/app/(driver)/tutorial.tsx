import React from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth.store';
import {
  TutorialCarousel,
  type TutorialSlide,
} from '@/components/TutorialCarousel';
import { colors } from '@/theme';

const SLIDES: TutorialSlide[] = [
  {
    id: '1',
    icon: 'power',
    title: 'Passez en ligne',
    subtitle:
      'Activez votre disponibilité en haut de l\'accueil pour recevoir des demandes de course dans votre zone.',
    color: colors.primary,
  },
  {
    id: '2',
    icon: 'notifications',
    title: 'Acceptez une course',
    subtitle:
      'Quand une demande arrive, vous voyez le gain, la distance et le trajet. Vous avez 2 minutes pour accepter ou refuser.',
    color: colors.secondary,
  },
  {
    id: '3',
    icon: 'qr-code',
    title: 'Confirmez par code',
    subtitle:
      'À chaque étape (récupération + livraison), saisissez le code à 4 chiffres donné par le client / destinataire et prenez une photo du colis.',
    color: colors.success,
  },
  {
    id: '4',
    icon: 'stats-chart',
    title: 'Suivez vos gains',
    subtitle:
      'Consultez vos statistiques (CA, courses, classement) et gérez votre portefeuille depuis votre profil.',
    color: '#6366f1',
  },
];

export default function DriverTutorialScreen() {
  const router = useRouter();
  const completeRoleTutorial = useAuthStore((s) => s.completeRoleTutorial);

  const handleFinish = () => {
    completeRoleTutorial('driver');
    router.replace('/(driver)');
  };

  return <TutorialCarousel slides={SLIDES} onFinish={handleFinish} />;
}
