import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import {
  listMessages,
  sendMessage,
  markRead,
} from '../services/message.service.js';

export async function listMessagesCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const messages = await listMessages(req.params.id, req.user!.id);
    return success(res, messages);
  } catch (err) {
    next(err);
  }
}

const sendSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function sendMessageCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { body } = sendSchema.parse(req.body);
    const message = await sendMessage(req.params.id, req.user!.id, body);
    return success(res, message, 201);
  } catch (err) {
    next(err);
  }
}

export async function markReadCtrl(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await markRead(req.params.id, req.user!.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
