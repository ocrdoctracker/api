import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import docRequestRoutes from './doc-request.routes.js';
import departmentRoutes from './department.routes.js';
import commonRoutes from './common.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/doc-request', docRequestRoutes);
router.use('/department', departmentRoutes);
router.use('/common', commonRoutes);

export default router;
