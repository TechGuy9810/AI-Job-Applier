import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import { fillForm, fillAnswers } from '../controllers/formFillController.js';

const router = Router();

router.use(authenticate);

router.post('/fill', fillForm);
router.post('/answer', fillAnswers);

export default router;
