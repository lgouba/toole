import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/response.js';
import { sendPushToUser } from '../services/push.service.js';
import type { Prisma, SupportCategory, SupportStatus } from '@prisma/client';

const adminInclude = {
  user: { select: { id: true, fullName: true, phone: true, userType: true } },
  delivery: { select: { id: true, reference: true } },
  handledBy: { select: { id: true, fullName: true } },
} as const;

export interface ListFilters {
  status?: SupportStatus;
  category?: SupportCategory;
  search?: string;
}

export async function listSupportTickets(filters: ListFilters) {
  const where: Prisma.SupportTicketWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { reference: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { user: { fullName: { contains: q, mode: 'insensitive' } } },
      { user: { phone: { contains: q } } },
    ];
  }
  return prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: adminInclude,
    take: 500,
  });
}

export async function getSupportTicketAdmin(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: adminInclude,
  });
  if (!ticket) throw new HttpError(404, 'NOT_FOUND', 'Demande introuvable.');
  return ticket;
}

export interface UpdateInput {
  status?: SupportStatus;
  adminNote?: string;
}

/**
 * Met à jour le statut et/ou la note interne. Au PREMIER passage à `resolved`
 * (et seulement là, pour rester idempotent), on fixe `resolvedAt`/`handledById`
 * et on pousse une notification à l'utilisateur. Un second PATCH `resolved`
 * ne re-pushe pas.
 */
export async function updateSupportTicket(
  id: string,
  adminId: string,
  input: UpdateInput,
) {
  const current = await prisma.supportTicket.findUnique({
    where: { id },
    select: { status: true, userId: true, reference: true },
  });
  if (!current) throw new HttpError(404, 'NOT_FOUND', 'Demande introuvable.');

  const data: Prisma.SupportTicketUpdateInput = {};
  if (input.adminNote !== undefined) data.adminNote = input.adminNote;

  const becomesResolved = input.status === 'resolved' && current.status !== 'resolved';

  if (input.status !== undefined) {
    data.status = input.status;
    data.handledBy = { connect: { id: adminId } };
    if (becomesResolved) data.resolvedAt = new Date();
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data,
    include: adminInclude,
  });

  if (becomesResolved) {
    void sendPushToUser(
      current.userId,
      'Demande traitée · Toolé',
      `Votre demande ${current.reference} a été traitée.`,
      { type: 'support_resolved', ticketId: id },
    ).catch(() => {});
  }

  return ticket;
}
