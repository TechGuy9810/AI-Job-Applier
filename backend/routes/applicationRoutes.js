import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as applicationController from '../controllers/applicationController.js';

const router = Router();

router.use(authenticate);

router.get('/', applicationController.getAllApplications);
router.post('/', applicationController.createApplication);
router.get('/:id', applicationController.getApplicationById);
// Specific status update endpoint for logical separation, could also be a standard PATCH if wanted.
router.patch('/:id/status', applicationController.updateApplicationStatus);
router.delete('/:id', applicationController.deleteApplication);

export default router;
