import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';
import { generateSupportReference } from '../lib/supportReference.js';
import type { SupportCategory } from '@prisma/client';

export interface CreateTicketInput {
  category: SupportCategory;
  description: string;
  deliveryId?: string;
  photoUrl?: string;
}

const ticketInclude = {
  delivery: { select: { id: true, reference: true } },
} as const;

/**
 * Crée un ticket de support pour `userId`. Si `deliveryId` est fourni, on vérifie
 * que l'utilisateur est partie à cette course (expéditeur OU livreur) — sinon
 * rejet (anti-IDOR : on ne rattache pas la course d'autrui).
 */
export async function createSupportTicket(userId: string, input: CreateTicketInput) {
  if (input.deliveryId) {
    const d = await prisma.delivery.findUnique({
      where: { id: input.deliveryId },
      select: { senderId: true, driverId: true },
    });
    if (!d || (d.senderId !== userId && d.driverId !== userId)) {
      throw new HttpError(400, 'INVALID_DELIVERY', 'Course introuvable ou non liée à votre compte.');
    }
  }
  // Retry léger en cas de collision improbable sur la référence (@unique).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.supportTicket.create({
        data: {
          reference: generateSupportReference(),
          userId,
          category: input.category,
          deliveryId: input.deliveryId ?? null,
          description: input.description,
          photoUrl: input.photoUrl ?? null,
        },
        include: ticketInclude,
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002' && attempt < 2) continue;
      throw e;
    }
  }
  throw new HttpError(500, 'SUPPORT_CREATE_FAILED', 'Impossible de créer la demande.');
}

export async function listMySupportTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: ticketInclude,
  });
}

export async function getMySupportTicket(userId: string, id: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId },
    include: ticketInclude,
  });
  if (!ticket) throw new HttpError(404, 'NOT_FOUND', 'Demande introuvable.');
  return ticket;
}
