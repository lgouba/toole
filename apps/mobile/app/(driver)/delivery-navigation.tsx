import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSharedValue, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useDriverStore } from '@/stores/driver.store';
import { useMessageStore } from '@/stores/message.store';
import { openPhone, openNavigation } from '@/utils/linking';
import { getDeliveryById } from '@/services/delivery.service';
import { formatEta } from '@/utils/format';
import { BC, BF } from '@/theme/bonCourse';
import { RetourBtn, Perforation, LignesControle, microStyle } from '@/components/driver/bonCourse/BonCourseParts';

// Distance en « bon de course » (§5.8) — LOCAL, ne touche pas formatDistance global.
function fmtDistBon(km: number): string {
  if (km < 0.06) return 'SUR PLACE';
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function DeliveryNavigationScreen() {
  const router = useRouter();
  const { height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { activeDelivery } = useDriverStore();
  const unread = useMessageStore((s) => s.unread[activeDelivery?.id ?? ''] ?? 0);

  const stepStartRef = useRef<{ id: string; init: number } | null>(null);
  const prevRef = useRef(0);
  const [pourcent, setPourcent] = useState<number | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (activeDelivery?.id) useMessageStore.getState().loadUnread(activeDelivery.id);
  }, [activeDelivery?.id]);

  useEffect(() => {
    if (!activeDelivery?.id) return;
    let cancelled = false;
    const check = async () => {
      const fresh = await getDeliveryById(activeDelivery.id);
      if (cancelled) return;
      if (!fresh) {
        useDriverStore.setState({ activeDelivery: null, currentRequest: null });
        router.replace('/(driver)');
        return;
      }
      if (['cancelled', 'expired', 'delivered'].includes(fresh.status)) {
        useDriverStore.setState({ activeDelivery: null, currentRequest: null });
        router.replace('/(driver)');
      } else {
        useDriverStore.setState({ activeDelivery: fresh });
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeDelivery?.id, router]);

  const restKm = activeDelivery?.eta ? activeDelivery.eta.distanceMeters / 1000 : null;

  useEffect(() => {
    const id = activeDelivery?.id;
    if (!id || restKm == null) {
      setPourcent(null);
      return;
    }
    if (!stepStartRef.current || stepStartRef.current.id !== id) {
      stepStartRef.current = { id, init: restKm };
      prevRef.current = 0;
    }
    const init = stepStartRef.current.init;
    if (init <= 0) {
      setPourcent(null);
      return;
    }
    const val = Math.max(prevRef.current, Math.min(1, Math.max(0, 1 - restKm / init)));
    prevRef.current = val;
    setPourcent(Math.round(val * 100));
    progress.value = reduceMotion ? val : withTiming(val, { duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDelivery?.id, restKm]);

  if (!activeDelivery) return null;
  const d = activeDelivery;
  const k = Math.min(1.12, Math.max(0.86, H / 844));
  const g = 0; // les marges sont gérées par le padding du papier
  const gut = H >= 900 ? 24 : 20;
  const m = microStyle(k);

  return (
    <View style={{ flex: 1, backgroundColor: BC.page }}>
      {/* LA FEUILLE (occupe tout sauf le bouton + mention) */}
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BC.papier }}>
        <View style={{ flex: 1, paddingHorizontal: gut, paddingTop: 8 * k }}>
          {/* tête */}
          <View style={{ height: 40 * k, justifyContent: 'center' }}>
            <RetourBtn k={k} g={gut} top={0} onPress={() => router.back()} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 40 * k }}>
              <Text maxFontSizeMultiplier={1.4} style={[m, { color: BC.encre, letterSpacing: 3 * k }]}>TOOLÉ</Text>
              <Text maxFontSizeMultiplier={1.4} style={m}>ÉTAPE 3 / 4</Text>
            </View>
          </View>
          <View style={{ height: 4 * k, borderTopWidth: 2 * k, borderBottomWidth: 1, borderColor: BC.encre, marginTop: 10 * k }} />

          {/* identité */}
          <View style={{ marginTop: 22 * k }}>
            <Text maxFontSizeMultiplier={1.4} style={[m, { color: BC.vert }]}>COLIS À BORD</Text>
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: BF.xbold, fontSize: 32 * k, letterSpacing: -1.1 * k, color: BC.encre, marginTop: 8 * k }}>
              {d.recipientName}
            </Text>
            <Text maxFontSizeMultiplier={1.4} numberOfLines={2} style={{ fontFamily: BF.med, fontSize: Math.max(14.5, 15 * k), color: BC.gris, marginTop: 7 * k }}>
              {d.deliveryAddress}
            </Text>
          </View>

          {/* perforation + 4 lignes + perforation (flux) */}
          <View style={{ marginTop: 20 * k }}>
            <Perforation k={k} />
            <View style={{ marginTop: 14 * k }}>
              <LignesControle
                k={k}
                lignes={[
                  { num: 1, libelle: 'RÉCUPÉRATION', etat: 'faite' },
                  { num: 2, libelle: 'PREUVE DE PRISE EN CHARGE', etat: 'faite' },
                  { num: 3, libelle: 'LIVRAISON', etat: 'encours', pourcent, progress },
                  { num: 4, libelle: 'PREUVE DE LIVRAISON', etat: 'avenir' },
                ]}
              />
            </View>
            <View style={{ marginTop: 12 * k }}>
              <Perforation k={k} />
            </View>
          </View>

          {/* pied : ARRIVÉE / DISTANCE */}
          <View style={{ marginTop: 16 * k, flexDirection: 'row' }}>
            <PiedChiffre k={k} label="ARRIVÉE" val={d.eta ? formatEta(d.eta.durationSeconds) : '—'} />
            <PiedChiffre k={k} label="DISTANCE" val={restKm != null ? fmtDistBon(restKm) : '—'} />
          </View>

          {/* actions (sous le pied, écart franc pour ne pas raser les chiffres) */}
          <View style={{ marginTop: 16 * k }}>
            <ActionsBon
              k={k}
              unread={unread}
              onMaps={() => openNavigation(d.deliveryLocation.latitude, d.deliveryLocation.longitude, d.deliveryAddress)}
              onCall={() => openPhone(d.recipientPhone)}
              onMsg={() => router.push(`/chat/${d.id}?name=${encodeURIComponent(d.senderName ?? 'Client')}&reference=${encodeURIComponent(d.reference)}` as any)}
              callLabel={`Appeler ${d.recipientName}`}
            />
          </View>
        </View>
      </SafeAreaView>

      {/* bouton + mention (sur la page, sous la feuille) */}
      <View style={{ paddingHorizontal: gut, paddingTop: 14 * k, paddingBottom: 8 * k }}>
        <Pressable
          onPress={() => router.replace('/(driver)/code-validation')}
          android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
          accessibilityRole="button"
          accessibilityLabel="Je suis arrivé"
          style={({ pressed }) => [
            { height: 56 * k, backgroundColor: BC.vert, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 * k },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="checkmark" size={19 * k} color={BC.blanc} />
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.mono, fontSize: Math.max(14, 15 * k), letterSpacing: 1.5 * k, color: BC.blanc }}>
            JE SUIS ARRIVÉ
          </Text>
        </Pressable>
        <View style={{ height: 22 * k, marginTop: 10 * k, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 * k }}>
          <Ionicons name="lock-closed" size={12 * k} color={BC.gris} />
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.semi, fontSize: Math.max(12, 12.5 * k), color: BC.gris }}>
            Colis à bord · annulation impossible
          </Text>
        </View>
      </View>
    </View>
  );
}

function PiedChiffre({ k, label, val }: { k: number; label: string; val: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text maxFontSizeMultiplier={1.4} style={microStyle(k)}>{label}</Text>
      <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: BF.mono, fontSize: 28 * k, lineHeight: 32 * k, letterSpacing: -1.1 * k, color: BC.encre, marginTop: 6 * k }}>
        {val}
      </Text>
    </View>
  );
}

function ActionsBon({
  k,
  unread,
  onMaps,
  onCall,
  onMsg,
  callLabel,
}: {
  k: number;
  unread: number;
  onMaps: () => void;
  onCall: () => void;
  onMsg: () => void;
  callLabel: string;
}) {
  const rows: { icon: any; label: string; code: string; onPress: () => void; badge?: number }[] = [
    { icon: 'navigate-outline', label: "Ouvrir l'itinéraire", code: 'MAPS', onPress: onMaps },
    { icon: 'call-outline', label: callLabel, code: 'TEL', onPress: onCall },
    { icon: 'chatbubble-outline', label: 'Envoyer un message', code: 'SMS', onPress: onMsg, badge: unread },
  ];
  return (
    <View>
      {rows.map((r) => (
        <Pressable
          key={r.code}
          onPress={r.onPress}
          android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          accessibilityRole="button"
          accessibilityLabel={r.label}
          style={({ pressed }) => [
            { minHeight: 44, paddingVertical: 12 * k, borderTopWidth: 1, borderColor: BC.filetFin, flexDirection: 'row', alignItems: 'center', gap: 12 * k },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name={r.icon} size={17 * k} color={BC.encre} />
          <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={{ flex: 1, fontFamily: BF.semi, fontSize: Math.max(15, 16 * k), color: BC.encre }}>
            {r.label}
          </Text>
          {r.badge ? (
            <View style={{ minWidth: 18 * k, height: 18 * k, borderRadius: 9 * k, backgroundColor: BC.vert, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 * k }}>
              <Text style={{ fontFamily: BF.mono, fontSize: 10 * k, color: BC.blanc }}>{r.badge}</Text>
            </View>
          ) : null}
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.mono, fontSize: 11 * k, letterSpacing: 1 * k, color: BC.gris }}>{r.code}</Text>
        </Pressable>
      ))}
    </View>
  );
}
