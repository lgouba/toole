import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R, step2 as T } from '@/theme/recapTokens';
import { LatLng } from '@/types';
import { RouteTargets } from './RouteTargets';
import { AddressSource } from './AddressSource';
import { TripSummary } from './TripSummary';
import { Step2Place, Which } from './tripTypes';
import { useRecentPlacesStore } from '@/stores/recentPlaces.store';

interface Props {
  pickup: { label: string; location: LatLng } | null;
  dropoff: { label: string; location: LatLng } | null;
  onPickup: (p: Step2Place) => void;
  onDropoff: (p: Step2Place) => void;
  /** Estimation cohérente avec le récap (distanceKm + prix). null si incomplet. */
  estimate: { distanceKm: number; price: number } | null;
}

// Vitesse moyenne urbaine (moto, Ouaga) pour estimer la durée à partir de la distance.
const AVG_SPEED_KMH = 20;

export function TripStep2({ pickup, dropoff, onPickup, onDropoff, estimate }: Props) {
  const [active, setActive] = useState<Which>(pickup ? (dropoff ? 'pickup' : 'dropoff') : 'pickup');
  const [flash, setFlash] = useState<Which | null>(null);
  const addRecent = useRecentPlacesStore((s) => s.addRecent);

  const pick = (place: Step2Place) => {
    if (active === 'pickup') {
      onPickup(place);
      if (!dropoff) setActive('dropoff');
    } else {
      onDropoff(place);
      if (!pickup) setActive('pickup');
    }
    addRecent({ label: place.label, address: place.address, location: place.location });
    setFlash(active);
    setTimeout(() => setFlash(null), 700);
  };

  const bothSet = !!pickup && !!dropoff;
  const sameSpot =
    bothSet &&
    Math.abs(pickup!.location.latitude - dropoff!.location.latitude) < 4e-4 &&
    Math.abs(pickup!.location.longitude - dropoff!.location.longitude) < 4e-4;

  const durationMin = estimate ? Math.max(2, Math.round((estimate.distanceKm / AVG_SPEED_KMH) * 60)) : 0;

  return (
    <View style={styles.wrap}>
      <RouteTargets
        pickupLabel={pickup?.label}
        dropoffLabel={dropoff?.label}
        active={active}
        onSelect={setActive}
        flash={flash}
      />

      {sameSpot && (
        <Text style={styles.warn}>⚠️ Départ et arrivée sont quasi identiques.</Text>
      )}

      {bothSet && estimate && (
        <TripSummary
          distanceKm={estimate.distanceKm}
          durationMin={durationMin}
          priceXOF={estimate.price}
          visible
        />
      )}

      <AddressSource active={active} onPick={pick} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.md, paddingTop: 2 },
  warn: { fontFamily: R.font.body, fontSize: 12.5, color: '#B45309', textAlign: 'center' },
});
