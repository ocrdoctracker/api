import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import docRequestRoutes from './doc-request.routes.js';
import departmentRoutes from './department.routes.js';
import commonRoutes from './common.routes.js';
import docClassificationRoutes from './doc-classification.routes.js';
import notificationsRoutes from './notifications.routes.js';
import searchRoutes from './search.routes.js';
import docWorkflowConfigRoutes from './doc-workflow-config.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/doc-request', docRequestRoutes);
router.use('/department', departmentRoutes);
router.use('/common', commonRoutes);
router.use('/doc-classification', docClassificationRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/search', searchRoutes);
router.use('/doc-workflow-config', docWorkflowConfigRoutes);

export default router;
