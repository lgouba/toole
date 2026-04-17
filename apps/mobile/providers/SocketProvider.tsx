import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket.client';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

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

        // ------ Events for Client (sender) ------
        socket.on('delivery:accepted', (payload: any) => {
          const { activeDelivery, setActiveDelivery, selectDriver } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === payload.delivery.id) {
            setActiveDelivery(payload.delivery);
            if (payload.driver) selectDriver(payload.driver);
          }
        });

        socket.on('delivery:status_update', (payload: any) => {
          const { activeDelivery, setActiveDelivery } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === payload.delivery.id) {
            setActiveDelivery(payload.delivery);
          }
          // For driver side too
          const { activeDelivery: driverActive } = useDriverStore.getState();
          if (driverActive && driverActive.id === payload.delivery.id) {
            useDriverStore.setState({ activeDelivery: payload.delivery });
          }
        });

        socket.on('delivery:driver_location', (payload: any) => {
          useDeliveryStore.getState().setDriverLocation({
            latitude: payload.latitude,
            longitude: payload.longitude,
          });
        });

        socket.on('delivery:cancelled', (payload: any) => {
          const { activeDelivery, setActiveDelivery } = useDeliveryStore.getState();
          if (activeDelivery && activeDelivery.id === payload.delivery.id) {
            setActiveDelivery(payload.delivery);
          }
        });

        // ------ Events for Driver ------
        socket.on('delivery:new_request', (payload: any) => {
          // Show the request to the driver
          useDriverStore.getState().receiveRequest(payload.delivery);
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
