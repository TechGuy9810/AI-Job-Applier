import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as resumeController from '../controllers/resumeController.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(authenticate);

router.get('/', resumeController.getAllResumes);
router.post('/', upload.single('resume'), resumeController.createResume);
router.get('/:id', resumeController.getResumeById);
router.patch('/:id', resumeController.updateResume);
router.delete('/:id', resumeController.deleteResume);

// Convenience endpoint
router.post('/:id/primary', resumeController.setPrimaryResume);

export default router;
