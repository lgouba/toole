import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Map } from '@/components/map/Map';
import { LatLng } from '@/types';
import { API_BASE_URL } from '@/config/api';
import { formatEta, formatDistance } from '@/utils/format';

/**
 * Écran de suivi destinataire PUBLIC (sans authentification).
 *
 * Ouvert via universal link / app link `https://admin-toole.qalitylabs.fr/track/<token>`
 * quand l'app est installée (sinon le navigateur ouvre la page web admin
 * équivalente). Affiche la position live du livreur + l'itinéraire routier
 * phase-aware, exactement comme l'app et la page web.
 */

type Status =
  | 'scheduled' | 'pending' | 'accepted' | 'picking_up'
  | 'picked_up' | 'delivering' | 'delivered' | 'cancelled' | 'expired';

interface PublicTracking {
  reference: string;
  status: Status;
  recipientName: string;
  pickupAddress: string;
  pickupLocation: LatLng;
  deliveryAddress: string;
  deliveryLocation: LatLng;
  eta: { durationSeconds: number; distanceMeters: number } | null;
  route?: { path: LatLng[] | null; phase: 'to_pickup' | 'to_delivery' | null } | null;
  driver: null | {
    fullName: string;
    avatarUrl: string | null;
    ratingAvg: number;
    vehicleType: string | null;
    currentLocation: LatLng | null;
  };
}

const POLL_MS = 5_000;

const STATUS_META: Record<Status, { label: string; color: string }> = {
  scheduled: { label: 'Programmée', color: '#6b7280' },
  pending: { label: "Recherche d'un livreur", color: '#f59e0b' },
  accepted: { label: 'Livreur en route', color: '#2563eb' },
  picking_up: { label: 'Livreur sur place', color: '#2563eb' },
  picked_up: { label: 'Colis récupéré', color: '#16a34a' },
  delivering: { label: 'En route vers vous', color: '#16a34a' },
  delivered: { label: 'Livré', color: '#15803d' },
  cancelled: { label: 'Annulé', color: '#ef4444' },
  expired: { label: 'Expiré', color: '#ef4444' },
};

const C = {
  bg: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  green: '#16A34A',
  border: '#E8EDF3',
  surface: '#F1F5F9',
};

export default function PublicTrackScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<PublicTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/track/${token}`);
        if (!res.ok) {
          if (!cancelled) {
            setError(res.status === 404 ? 'NOT_FOUND' : 'HTTP');
            setLoading(false);
          }
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json.data);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('NETWORK');
          setLoading(false);
        }
      }
    };
    fetchOnce();
    intervalRef.current = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token]);

  const isAfterPickup =
    data?.status === 'picked_up' || data?.status === 'delivering';

  const markers = useMemo(() => {
    if (!data) return [];
    const list: any[] = [
      { id: 'pickup', coordinate: data.pickupLocation, icon: 'pickup' },
      { id: 'delivery', coordinate: data.deliveryLocation, icon: 'delivery' },
    ];
    if (data.driver?.currentLocation) {
      list.push({
        id: 'driver',
        coordinate: data.driver.currentLocation,
        icon: 'driver',
        target: isAfterPickup ? data.deliveryLocation : data.pickupLocation,
      });
    }
    return list;
  }, [data, isAfterPickup]);

  // Tracé : itinéraire routier réel si dispo, sinon ligne directe phase-aware.
  const routeCoords = useMemo<[LatLng, LatLng] | undefined>(() => {
    if (!data) return undefined;
    const target = isAfterPickup ? data.deliveryLocation : data.pickupLocation;
    if (data.driver?.currentLocation) return [data.driver.currentLocation, target];
    return [data.pickupLocation, data.deliveryLocation];
  }, [data, isAfterPickup]);

  const center =
    data?.driver?.currentLocation ?? data?.pickupLocation ?? {
      latitude: 12.3714,
      longitude: -1.5197,
    };

  if (loading) {
    return (
      <View style={styles.full}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={styles.muted}>Chargement du suivi…</Text>
      </View>
    );
  }

  if (error === 'NOT_FOUND') {
    return (
      <View style={styles.full}>
        <Ionicons name="search" size={44} color={C.muted} />
        <Text style={styles.errTitle}>Suivi introuvable</Text>
        <Text style={styles.muted}>Ce lien n'existe pas ou a expiré.</Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.full}>
        <Ionicons name="cloud-offline-outline" size={44} color={C.muted} />
        <Text style={styles.errTitle}>Connexion impossible</Text>
        <Text style={styles.muted}>Vérifiez votre connexion et réessayez.</Text>
      </View>
    );
  }

  const meta = STATUS_META[data.status];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Map
        center={center}
        zoom={14}
        markers={markers}
        routeCoordinates={routeCoords}
        routePath={data.route?.path ?? undefined}
        fitToContent
        contentInsetTop={120}
        contentInsetBottom={300}
      />

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="none">
        <View style={[styles.statusPill, { borderColor: meta.color }]}>
          <View style={[styles.dot, { backgroundColor: meta.color }]} />
          <Text style={styles.statusText}>{meta.label}</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.ref}>Réf. {data.reference}</Text>

          {data.driver && (
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {data.driver.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{data.driver.fullName}</Text>
                <Text style={styles.muted}>
                  ⭐ {Number(data.driver.ratingAvg).toFixed(1)}
                </Text>
              </View>
              {data.eta && (
                <View style={styles.etaPill}>
                  <Ionicons name="time-outline" size={15} color={C.green} />
                  <Text style={styles.etaText}>
                    ~{formatEta(data.eta.durationSeconds)} ·{' '}
                    {formatDistance(data.eta.distanceMeters / 1000)}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.addr}>
            <View style={[styles.addrDot, { backgroundColor: '#C2410C' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>RÉCUPÉRATION</Text>
              <Text style={styles.addrText}>{data.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.addr}>
            <View style={[styles.addrDot, { backgroundColor: C.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>LIVRAISON</Text>
              <Text style={styles.addrText}>{data.deliveryAddress}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: C.bg,
  },
  muted: { color: C.muted, fontSize: 14, textAlign: 'center' },
  errTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 4 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: '700', color: C.text, fontSize: 14 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 280,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  ref: { color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 12 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E7FBEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 19, fontWeight: '700', color: C.green },
  driverName: { fontSize: 15, fontWeight: '700', color: C.text },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E7FBEF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  etaText: { color: C.green, fontWeight: '700', fontSize: 13 },
  addr: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  addrDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  addrLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addrText: { fontSize: 14, color: C.text, marginTop: 2 },
});
