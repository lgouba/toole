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
    icon: 'cube-outline',
    title: 'Envoyez vos colis facilement',
    subtitle:
      "Choisissez la taille, la catégorie et donnez l'adresse de récupération et de livraison. Tout se fait en quelques secondes.",
    color: colors.primary,
  },
  {
    id: '2',
    icon: 'navigate',
    title: 'Suivez en temps réel',
    subtitle:
      'Une fois un livreur trouvé, suivez sa position sur la carte jusqu\'à la remise du colis.',
    color: colors.secondary,
  },
  {
    id: '3',
    icon: 'shield-checkmark',
    title: 'Sécurisé par un code',
    subtitle:
      'À la création, vous recevez un code à 4 chiffres pour le destinataire. À donner au livreur pour valider la remise.',
    color: colors.success,
  },
  {
    id: '4',
    icon: 'bookmark',
    title: 'Vos adresses favorites',
    subtitle:
      'Enregistrez Maison, Bureau et autres adresses fréquentes pour gagner du temps sur les prochaines commandes.',
    color: '#6366f1',
  },
];

export default function ClientTutorialScreen() {
  const router = useRouter();
  const completeRoleTutorial = useAuthStore((s) => s.completeRoleTutorial);

  const handleFinish = () => {
    completeRoleTutorial('client');
    router.replace('/(client)');
  };

  return <TutorialCarousel slides={SLIDES} onFinish={handleFinish} />;
}
