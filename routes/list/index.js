import { Router } from 'express';

import status from './status';

const router = Router();

router.use('/status',status);

export default router;
