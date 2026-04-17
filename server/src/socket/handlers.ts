import { z } from 'zod';
import type { AuthedSocket } from './index.js';
import { updateLocation } from '../services/driver.service.js';
import { emitToUser } from '../services/notification.service.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export function registerSocketHandlers(socket: AuthedSocket) {
  socket.on('driver:update_location', async (raw, ack?: (res: unknown) => void) => {
    try {
      if (socket.data.userType !== 'driver') {
        throw new Error('Only drivers can send location updates');
      }
      const { lat, lng } = locationSchema.parse(raw);
      await updateLocation(socket.data.userId, lat, lng);

      // If the driver has an active delivery, forward to the sender
      const activeDelivery = await prisma.delivery.findFirst({
        where: {
          driverId: socket.data.userId,
          status: {
            in: ['accepted', 'picking_up', 'picked_up', 'delivering'],
          },
        },
        select: { id: true, senderId: true },
      });
      if (activeDelivery) {
        emitToUser(activeDelivery.senderId, 'delivery:driver_location', {
          deliveryId: activeDelivery.id,
          driverId: socket.data.userId,
          latitude: lat,
          longitude: lng,
          updatedAt: new Date().toISOString(),
        });
      }

      ack?.({ ok: true });
    } catch (err) {
      logger.warn({ err }, 'driver:update_location failed');
      ack?.({ ok: false, error: (err as Error).message });
    }
  });
}
