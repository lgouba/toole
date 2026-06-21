import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';
import { emitToUser } from './notification.service.js';
import { sendPushToUser } from './push.service.js';

/**
 * Messagerie in-app entre le client (sender de la course) et le livreur
 * assigne. Le fil est rattache a une livraison ; seules ces deux personnes y
 * ont acces.
 *
 * Envoi = REST (fiable sur reseau BF, avec retour immediat). Reception live =
 * socket `message:new` emis au destinataire + push s'il est hors-ligne.
 */

interface Party {
  delivery: { id: string; senderId: string; driverId: string | null; reference: string };
  /** L'autre participant au fil (le destinataire d'un message envoye par userId). */
  recipientId: string;
}

/**
 * Verifie que `userId` est partie prenante de la course ET qu'un livreur est
 * assigne (sinon il n'y a personne avec qui discuter). Retourne la course + le
 * destinataire (l'autre participant).
 */
async function resolveParty(deliveryId: string, userId: string): Promise<Party> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, senderId: true, driverId: true, reference: true },
  });
  if (!delivery) {
    throw new HttpError(404, 'NOT_FOUND', 'Delivery not found');
  }
  if (!delivery.driverId) {
    throw new HttpError(
      409,
      'NO_DRIVER',
      "Aucun livreur n'est encore assigne a cette course.",
    );
  }
  const isSender = delivery.senderId === userId;
  const isDriver = delivery.driverId === userId;
  if (!isSender && !isDriver) {
    throw new HttpError(403, 'FORBIDDEN', 'Access denied');
  }
  const recipientId = isSender ? delivery.driverId : delivery.senderId;
  return { delivery, recipientId };
}

/** Liste le fil (ordre chronologique) et marque comme lus les messages reçus. */
export async function listMessages(deliveryId: string, userId: string) {
  await resolveParty(deliveryId, userId);

  const messages = await prisma.message.findMany({
    where: { deliveryId },
    orderBy: { createdAt: 'asc' },
  });

  // Ouvrir le fil = lire les messages dont on est le destinataire.
  await prisma.message.updateMany({
    where: { deliveryId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });

  return messages;
}

/** Nombre de messages non lus pour `userId` sur une course. */
export async function countUnread(deliveryId: string, userId: string): Promise<number> {
  return prisma.message.count({
    where: { deliveryId, recipientId: userId, readAt: null },
  });
}

/** Envoie un message ; persiste, notifie le destinataire (socket + push). */
export async function sendMessage(
  deliveryId: string,
  senderId: string,
  rawBody: string,
) {
  const body = rawBody.trim();
  if (!body) {
    throw new HttpError(400, 'EMPTY_MESSAGE', 'Le message est vide.');
  }
  if (body.length > 2000) {
    throw new HttpError(400, 'MESSAGE_TOO_LONG', 'Message trop long (max 2000).');
  }

  const { delivery, recipientId } = await resolveParty(deliveryId, senderId);

  const message = await prisma.message.create({
    data: { deliveryId, senderId, recipientId, body },
  });

  // Reception live chez le destinataire (les deux participants recoivent
  // l'event pour synchroniser leurs autres appareils).
  emitToUser(recipientId, 'message:new', message);
  emitToUser(senderId, 'message:new', message);

  // Push si le destinataire n'a pas l'app au premier plan (best-effort).
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { fullName: true },
  });
  void sendPushToUser(
    recipientId,
    sender?.fullName ?? 'Nouveau message',
    body.length > 120 ? `${body.slice(0, 117)}…` : body,
    { type: 'message', deliveryId, reference: delivery.reference },
  );

  return message;
}

/** Marque explicitement le fil comme lu (sans renvoyer les messages). */
export async function markRead(deliveryId: string, userId: string) {
  await resolveParty(deliveryId, userId);
  const { count } = await prisma.message.updateMany({
    where: { deliveryId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { marked: count };
}
