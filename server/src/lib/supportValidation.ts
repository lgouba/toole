import { z } from 'zod';

/**
 * Schéma de création d'un ticket support. Module PUR (zod seul, pas d'env ni de
 * Prisma) pour être importable par le test `test-support-validation.ts` sans
 * booter la config serveur.
 *
 * `photoUrl` doit pointer sur notre stockage (`/uploads/...`) : on refuse une
 * URL externe (un admin la verrait dans le back-office).
 */
export const createTicketSchema = z.object({
  category: z.enum(['app_problem', 'account_data', 'dispute', 'refund', 'other']),
  description: z.string().trim().min(1).max(2000),
  deliveryId: z.string().uuid().optional(),
  photoUrl: z.string().max(500).startsWith('/uploads/').optional(),
});

export type CreateTicketBody = z.infer<typeof createTicketSchema>;
