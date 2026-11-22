import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import {
  listSupportTickets,
  getSupportTicketAdmin,
  updateSupportTicket,
} from '../services/admin.support.service.js';

const statusEnum = z.enum(['open', 'in_progress', 'resolved']);
const categoryEnum = z.enum(['app_problem', 'account_data', 'dispute', 'refund', 'other']);

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  category: categoryEnum.optional(),
  search: z.string().max(100).optional(),
});

const updateSchema = z.object({
  status: statusEnum.optional(),
  adminNote: z.string().max(5000).optional(),
});

export async function listSupportTicketsCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const filters = listQuerySchema.parse(req.query);
    return success(res, await listSupportTickets(filters));
  } catch (err) {
    next(err);
  }
}

export async function getSupportTicketCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await getSupportTicketAdmin(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function updateSupportTicketCtrl(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body);
    return success(res, await updateSupportTicket(req.params.id, req.user!.id, data));
  } catch (err) {
    next(err);
  }
}
