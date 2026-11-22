import { api, unwrap } from './api.client';

export type SupportCategory =
  | 'app_problem'
  | 'account_data'
  | 'dispute'
  | 'refund'
  | 'other';

export type SupportStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  reference: string;
  category: SupportCategory;
  description: string;
  photoUrl?: string | null;
  status: SupportStatus;
  adminNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  delivery?: { id: string; reference: string } | null;
}

export interface CreateTicketInput {
  category: SupportCategory;
  description: string;
  deliveryId?: string;
  photoUrl?: string;
}

/** Crée une demande de support. */
export async function createSupportTicket(
  input: CreateTicketInput,
): Promise<SupportTicket> {
  const res = await api.post('/support/tickets', input);
  return unwrap<SupportTicket>(res);
}

/** Liste mes demandes, plus récentes d'abord. */
export async function listSupportTickets(): Promise<SupportTicket[]> {
  const res = await api.get('/support/tickets');
  return unwrap<SupportTicket[]>(res);
}

/** Détail d'une de mes demandes. */
export async function getSupportTicket(id: string): Promise<SupportTicket> {
  const res = await api.get(`/support/tickets/${id}`);
  return unwrap<SupportTicket>(res);
}

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  app_problem: "Problème dans l'application",
  account_data: 'Modifier mes informations',
  dispute: 'Litige',
  refund: 'Remboursement',
  other: 'Autres',
};

export const STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
};
