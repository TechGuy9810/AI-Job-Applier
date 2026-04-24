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
router.use(authenticate);

router.get('/form-data', getProfileFormData);
router.post('/extract-resume', upload.single('resume'), extractProfileFromResume);
router.get('/', getProfile);
router.post('/', createProfile);
router.patch('/', updateProfile);
router.delete('/', deleteProfile);

export default router;
