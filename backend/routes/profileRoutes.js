import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfileFormData,
  extractProfileFromResume,
} from '../controllers/profileController.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// All profile routes require a valid JWT
router.use(authenticate);

/**
 * GET    /api/profile           — get current user's profile (raw document)
 * GET    /api/profile/form-data — flat alias-expanded map for the extension
 * POST   /api/profile/extract-resume - extracts resume using AI
 * POST   /api/profile           — create profile (fails if already exists)
 * PATCH  /api/profile           — partial update / upsert
 * DELETE /api/profile           — remove profile
 */
// NOTE: /form-data must be registered BEFORE the generic '/:id' style routes
// (Express matches routes top-down; plain strings beat params)
router.get('/form-data', getProfileFormData);
router.post('/extract-resume', upload.single('resume'), extractProfileFromResume);
router.get('/', getProfile);
router.post('/', createProfile);
router.patch('/', updateProfile);
router.delete('/', deleteProfile);

export default router;
