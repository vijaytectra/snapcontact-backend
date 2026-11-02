import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import cashfreeRouter, { webhookRouter } from './cashfree';
import adminRouter from './admin';

const router: Router = Router();

router.use(healthRouter);
router.use('/auth', authRouter);
router.use('/cashfree', cashfreeRouter);
router.use(webhookRouter);
router.use('/admin', adminRouter);

export default router;
