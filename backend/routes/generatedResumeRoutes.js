import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as generatedResumeController from '../controllers/generatedResumeController.js';

const router = Router();

router.use(authenticate);

router.get('/', generatedResumeController.getAllGeneratedResumes);
router.post('/', generatedResumeController.createGeneratedResume);
router.get('/:id', generatedResumeController.getGeneratedResumeById);
router.patch('/:id', generatedResumeController.updateGeneratedResume);
router.delete('/:id', generatedResumeController.deleteGeneratedResume);

export default router;
