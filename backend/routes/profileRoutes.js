import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from '../controllers/profileController.js';

const router = Router();

// All profile routes require a valid JWT
router.use(authenticate);

/**
 * GET    /api/profile        — get current user's profile
 * POST   /api/profile        — create profile (fails if already exists)
 * PATCH  /api/profile        — partial update / upsert
 * DELETE /api/profile        — remove profile
 */
router.get('/', getProfile);
router.post('/', createProfile);
router.patch('/', updateProfile);
router.delete('/', deleteProfile);

export default router;
