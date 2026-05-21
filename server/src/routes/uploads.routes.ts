import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { authRequired, AuthedRequest } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import { HttpError } from '../utils/response.js';

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? '/app/uploads';

// S'assurer que le dossier existe
for (const sub of ['avatars', 'packages', 'kyc']) {
  fs.mkdirSync(path.join(UPLOAD_ROOT, sub), { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // La sous-categorie est passee dans le path: /uploads/:category
    const category = (req.params as { category?: string }).category ?? 'misc';
    const allowed = ['avatars', 'packages', 'kyc'];
    const dest = allowed.includes(category) ? category : 'misc';
    cb(null, path.join(UPLOAD_ROOT, dest));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.mimetype);
    if (!ok) {
      cb(new HttpError(400, 'INVALID_FILE_TYPE', 'Format non supporte (jpg/png/webp/heic)'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

/**
 * Middleware d'auth conditionnel :
 * - `kyc` : accessible SANS authentification (utilise pendant l'inscription
 *   du livreur, avant la creation du compte). Les photos sont stockees dans
 *   /uploads/kyc/ et associees a un driver via PUT /drivers/me/kyc apres login.
 * - Autres categories (`avatars`, `packages`) : authentification requise.
 */
function conditionalAuth(
  req: AuthedRequest,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  const category = req.params.category;
  if (category === 'kyc') return next();
  return authRequired(req, res, next);
}

// POST /api/uploads/:category (avatars | packages | kyc)
router.post('/:category', conditionalAuth, upload.single('file'), (req: AuthedRequest, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'NO_FILE', 'Aucun fichier recu (champ "file")');
    }
    const category = req.params.category;
    const filename = req.file.filename;
    // URL publique servie par Nginx / Express static
    const publicUrl = `/uploads/${category}/${filename}`;
    return success(res, {
      url: publicUrl,
      filename,
      size: req.file.size,
      category,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
