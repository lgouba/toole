import { NextFunction, Response } from 'express';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import { createTicketSchema } from '../lib/supportValidation.js';
import {
  createSupportTicket,
  listMySupportTickets,
  getMySupportTicket,
} from '../services/support.service.js';

export async function createTicket(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const data = createTicketSchema.parse(req.body);
    const ticket = await createSupportTicket(req.user!.id, data);
    return success(res, ticket);
  } catch (err) {
    next(err);
  }
}

export async function listMyTickets(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await listMySupportTickets(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function getMyTicket(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    return success(res, await getMySupportTicket(req.user!.id, req.params.id));
  } catch (err) {
    next(err);
  }
}
