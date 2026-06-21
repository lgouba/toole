import { Message } from '@/types';
import { api, unwrap } from './api.client';

/** Liste le fil d'une course (et marque les reçus comme lus côté serveur). */
export async function listMessages(deliveryId: string): Promise<Message[]> {
  const res = await api.get(`/deliveries/${deliveryId}/messages`);
  return unwrap<Message[]>(res);
}

/** Envoie un message ; le serveur le persiste, notifie le destinataire. */
export async function sendMessage(
  deliveryId: string,
  body: string,
): Promise<Message> {
  const res = await api.post(`/deliveries/${deliveryId}/messages`, { body });
  return unwrap<Message>(res);
}

/** Marque le fil comme lu (sans recharger les messages). */
export async function markRead(deliveryId: string): Promise<void> {
  await api.post(`/deliveries/${deliveryId}/messages/read`, {});
}
