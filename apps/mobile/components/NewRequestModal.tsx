import React from 'react';
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
    await acceptRequest();
    router.replace('/(driver)/pickup-navigation');
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
