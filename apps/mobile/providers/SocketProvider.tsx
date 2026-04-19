import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket.client';
import { syncPushTokenToBackend } from '@/services/push.service';
import { Delivery, DriverWithProfile } from '@/types';
import { haptic } from '@/utils/haptics';

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

  // Enregistre le push token a chaque login et gere les notifications tappees
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    syncPushTokenToBackend();

    // Quand l'utilisateur tape sur une notification, naviguer vers l'ecran approprie
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'new_request' || data?.type === 'pending_batch') {
        if (user.userType === 'driver') {
          router.push('/(driver)/new-request');
        }
      } else if (data?.type === 'status_update' && user.userType === 'client') {
        router.push('/(client)/active-delivery');
      }
    });
    return () => sub.remove();
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

        // ------ Events for Client (sender) ------
        socket.on('delivery:accepted', (payload: any) => {
          console.log('[Socket] delivery:accepted', payload);
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
          console.log('[Socket] delivery:status_update', payload);
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

        // ------ Events for Driver ------
        socket.on('delivery:new_request', (payload: any) => {
          console.log('[Socket] delivery:new_request received', payload);
          const raw = payload?.delivery ?? payload;
          const delivery = normalizeDelivery(raw);
          useDriverStore.getState().receiveRequest(delivery);
          // Navigation automatique vers l'ecran de la demande (marche peu importe l'onglet actuel)
          haptic.success();
          router.push('/(driver)/new-request');
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
        socket.off('delivery:new_request');
      }
    };
  }, [isAuthenticated, user?.id]);

  return <>{children}</>;
}
