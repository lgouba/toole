/** Message de chat in-app entre le client et le livreur, rattaché à une course. */
export interface Message {
  id: string;
  deliveryId: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}
