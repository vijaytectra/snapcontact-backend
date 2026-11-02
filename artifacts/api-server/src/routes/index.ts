import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import cashfreeRouter from './cashfree';

const router: Router = Router();

router.use(healthRouter);
router.use('/auth', authRouter);
router.use('/cashfree', cashfreeRouter);

export default router;
