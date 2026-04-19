import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket.client';
import { syncPushTokenToBackend } from '@/services/push.service';
import { Delivery, DriverWithProfile } from '@/types';
import { haptic } from '@/utils/haptics';

// Dans Expo Go, expo-notifications leve une erreur au simple import en SDK 53+.
// On charge le module dynamiquement uniquement si on n'est pas dans Expo Go.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/** Normalise un objet delivery venant du backend (Prisma serialise Decimal en string) */
function normalizeDelivery(raw: any): Delivery {
  return {
    id: raw.id,
    reference: raw.reference,
    senderId: raw.senderId,
    driverId: raw.driverId ?? undefined,
    packageType: raw.packageType,
    packageDescription: raw.packageDescription ?? undefined,
    packagePhotoPickupUrl: raw.packagePhotoPickupUrl ?? undefined,
    packagePhotoDeliveryUrl: raw.packagePhotoDeliveryUrl ?? undefined,
    recipientName: raw.recipientName,
    recipientPhone: raw.recipientPhone,
    pickupAddress: raw.pickupAddress,
    pickupDetails: raw.pickupDetails ?? undefined,
    pickupLocation: { latitude: Number(raw.pickupLat), longitude: Number(raw.pickupLng) },
    deliveryAddress: raw.deliveryAddress,
    deliveryDetails: raw.deliveryDetails ?? undefined,
    deliveryLocation: {
      latitude: Number(raw.deliveryLat),
      longitude: Number(raw.deliveryLng),
    },
    estimatedDistanceKm:
      raw.estimatedDistanceKm != null ? Number(raw.estimatedDistanceKm) : undefined,
    price: Number(raw.price),
    driverCommission: raw.driverCommission != null ? Number(raw.driverCommission) : undefined,
    platformFee: raw.platformFee != null ? Number(raw.platformFee) : undefined,
    tip: Number(raw.tip ?? 0),
    validationCode: raw.validationCode,
    status: raw.status,
    acceptedAt: raw.acceptedAt ?? undefined,
    pickedUpAt: raw.pickedUpAt ?? undefined,
    deliveredAt: raw.deliveredAt ?? undefined,
    cancelledAt: raw.cancelledAt ?? undefined,
    expiresAt: raw.expiresAt ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeDriverPayload(raw: any): DriverWithProfile | null {
  if (!raw) return null;
  return {
    id: raw.id ?? raw.userId,
    phone: raw.phone ?? '',
    fullName: raw.fullName,
    userType: 'driver',
    avatarUrl: raw.avatarUrl ?? undefined,
    isVerified: true,
    isActive: true,
    ratingAvg: Number(raw.ratingAvg ?? 5),
    ratingCount: Number(raw.ratingCount ?? 0),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    distance: raw.distanceKm,
    driverProfile: {
      id: raw.driverProfileId ?? '',
      userId: raw.userId ?? raw.id,
      vehicleType: raw.vehicleType ?? 'moto',
      isOnline: true,
      currentLocation:
        raw.currentLat != null && raw.currentLng != null
          ? { latitude: Number(raw.currentLat), longitude: Number(raw.currentLng) }
          : undefined,
      walletBalance: 0,
      totalDeliveries: 0,
      verificationStatus: 'pending',
    },
  };
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  // Ref stable vers router.replace pour les closures des socket handlers
  const routerRef = useRef(router);
  routerRef.current = router;

  // Dedup: on garde l'ID de la derniere demande pour laquelle on a navigue
  const lastHandledRequestIdRef = useRef<string | null>(null);

  // Enregistre le push token + handler notification tapee
  // (skip dans Expo Go: push remote non supporte en SDK 53+)
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (isExpoGo) return; // Expo Go: on ne touche pas a expo-notifications

    syncPushTokenToBackend();

    let cleanup: (() => void) | undefined;
    // Import dynamique pour que le module ne soit PAS evalue dans Expo Go
    import('expo-notifications')
      .then((Notifications) => {
        const sub = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const data = response.notification.request.content.data as any;
            if (data?.type === 'new_request' || data?.type === 'pending_batch') {
              if (user.userType === 'driver') {
                routerRef.current.push('/(driver)/new-request');
              }
            } else if (data?.type === 'status_update' && user.userType === 'client') {
              routerRef.current.push('/(client)/active-delivery');
            }
          },
        );
        cleanup = () => sub.remove();
      })
      .catch(() => {
        // Module indisponible: tant pis, tout le reste marche.
      });
    return () => {
      cleanup?.();
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const socket = await connectSocket();
        if (!mounted) return;

        console.log('[Socket] Connected, user:', user.fullName, '(', user.userType, ')');

        // Detacher d'abord tous les handlers (evite double inscription si reconnection)
        socket.off('delivery:accepted');
        socket.off('delivery:status_update');
        socket.off('delivery:driver_location');
        socket.off('delivery:cancelled');
        socket.off('delivery:new_request');
        socket.off('delivery:invalidated');
        socket.off('delivery:expired');

        // ------ Events for Client (sender) ------
        socket.on('delivery:accepted', (payload: any) => {
          console.log('[Socket] delivery:accepted');
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);
          const { activeDelivery, setActiveDelivery, selectDriver } =
            useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === delivery.id) {
            setActiveDelivery(delivery);
            const driverPayload = payload?.driver
              ? normalizeDriverPayload(payload.driver)
              : null;
            if (driverPayload) selectDriver(driverPayload);
          }
        });

        socket.on('delivery:status_update', (payload: any) => {
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);
          const { activeDelivery, setActiveDelivery } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === delivery.id) {
            setActiveDelivery(delivery);
          }
          const { activeDelivery: driverActive } = useDriverStore.getState();
          if (driverActive && driverActive.id === delivery.id) {
            useDriverStore.setState({ activeDelivery: delivery });
          }
        });

        socket.on('delivery:driver_location', (payload: any) => {
          if (payload?.latitude != null && payload?.longitude != null) {
            useDeliveryStore.getState().setDriverLocation({
              latitude: Number(payload.latitude),
              longitude: Number(payload.longitude),
            });
          }
        });

        socket.on('delivery:cancelled', (payload: any) => {
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);
          const { activeDelivery, setActiveDelivery } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === delivery.id) {
            setActiveDelivery(delivery);
          }
        });

        // Le livreur a annule: la livraison est remise en pending, on revient a l'ecran recherche
        socket.on('delivery:driver_cancelled', (payload: any) => {
          console.log('[Socket] delivery:driver_cancelled', payload);
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);
          const { activeDelivery, setActiveDelivery } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === delivery.id) {
            setActiveDelivery(delivery);
            haptic.warning();
            // Retour a l'ecran de recherche (le livreur a ete retire, on recherche un autre)
            routerRef.current.replace('/(client)/searching');
          }
        });

        // ------ Events for Driver ------
        socket.on('delivery:new_request', (payload: any) => {
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);

          // Dedup: si on a deja gere cette demande recemment, ignorer
          if (lastHandledRequestIdRef.current === delivery.id) {
            console.log('[Socket] duplicate new_request ignored', delivery.id);
            return;
          }

          // Si le livreur a deja une course active ou une demande en cours, ignorer
          const { activeDelivery, currentRequest } = useDriverStore.getState();
          if (activeDelivery) {
            console.log('[Socket] driver already has active delivery, ignoring request');
            return;
          }
          if (currentRequest && currentRequest.id === delivery.id) {
            console.log('[Socket] same request already displayed');
            return;
          }

          lastHandledRequestIdRef.current = delivery.id;
          useDriverStore.getState().receiveRequest(delivery);
          haptic.success();
          routerRef.current.push('/(driver)/new-request');
        });

        socket.on('delivery:invalidated', (payload: any) => {
          console.log('[Socket] delivery:invalidated', payload?.deliveryId);
          const { currentRequest } = useDriverStore.getState();
          if (currentRequest && currentRequest.id === payload?.deliveryId) {
            useDriverStore.setState({ currentRequest: null });
            // Retour au dashboard driver (safe, marche toujours)
            routerRef.current.replace('/(driver)');
          }
          // Reset dedup pour que cette demande puisse etre re-proposee si relance
          if (lastHandledRequestIdRef.current === payload?.deliveryId) {
            lastHandledRequestIdRef.current = null;
          }
        });

        socket.on('delivery:expired', (payload: any) => {
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);
          const { activeDelivery, setActiveDelivery } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === delivery.id) {
            setActiveDelivery(delivery);
          }
          const { currentRequest } = useDriverStore.getState();
          if (currentRequest && currentRequest.id === delivery.id) {
            useDriverStore.setState({ currentRequest: null });
            routerRef.current.replace('/(driver)');
          }
          if (lastHandledRequestIdRef.current === delivery.id) {
            lastHandledRequestIdRef.current = null;
          }
        });
      } catch (err) {
        console.warn('[Socket] connection failed', err);
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.off('delivery:accepted');
        socket.off('delivery:status_update');
        socket.off('delivery:driver_location');
        socket.off('delivery:cancelled');
        socket.off('delivery:driver_cancelled');
        socket.off('delivery:new_request');
        socket.off('delivery:invalidated');
        socket.off('delivery:expired');
      }
    };
  }, [isAuthenticated, user?.id]);

  return <>{children}</>;
}
