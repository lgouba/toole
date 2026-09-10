import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '@/stores/driver.store';
import { stopAlert, alertRejection } from '@/utils/alerts';
import { PACKAGE_LABELS } from '@/types';
import { NewCourseModal, Course } from '@/components/courses/NewCourseModal';

// Durée d'expiration de la demande côté livreur (s). Identique à avant.
const TIMEOUT_SECONDS = 120;

/**
 * Modale "Nouvelle course" (concept Mission). Montée globalement dans
 * (driver)/_layout : s'affiche dès que `currentRequest` est défini.
 *
 * Ce wrapper branche la modale visuelle (NewCourseModal) sur les vraies
 * données du store + la logique d'acceptation / refus / expiration.
 */
export function NewRequestModal() {
  const router = useRouter();
  const { currentRequest, acceptRequest, rejectRequest } = useDriverStore();

  if (!currentRequest) return null;

  const r = currentRequest;
  const course: Course = {
    gain: r.driverCommission || r.price,
    distanceKm: r.estimatedDistanceKm,
    colisLabel: PACKAGE_LABELS[r.packageType] ?? 'Colis',
    pickup: r.pickupAddress,
    dropoff: r.deliveryAddress,
    isFragile: r.isFragile,
    declaredValue: r.declaredValue,
    thirdPartyName: r.senderContactName,
  };

  const handleAccept = async () => {
    stopAlert();
    // L'haptique de succès est déjà jouée par le glisser (SlideToAccept).
    // On ne navigue QUE si l'acceptation a réussi côté serveur : sinon (course
    // déjà prise par un autre livreur / réseau) le livreur atterrissait sur
    // l'écran de récupération SANS course active (écran mort).
    const ok = await acceptRequest();
    if (ok) {
      router.replace('/(driver)/pickup-navigation');
    } else {
      Alert.alert(
        'Course indisponible',
        "Cette course vient d'être prise par un autre livreur ou n'est plus disponible.",
      );
    }
  };

  const handleRefuse = () => {
    stopAlert();
    alertRejection();
    rejectRequest();
  };

  const handleTimeout = () => {
    stopAlert();
    rejectRequest();
  };

  return (
    <NewCourseModal
      // remonte la modale à chaque nouvelle demande (reset des animations)
      key={r.id}
      course={course}
      durationSec={TIMEOUT_SECONDS}
      onAccept={handleAccept}
      onRefuse={handleRefuse}
      onTimeout={handleTimeout}
    />
  );
}
