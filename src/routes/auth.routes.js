/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: API for authentication
 */
import { Router } from 'express';
import { body, validationResult } from "express-validator";
import { asyncHandler } from '../middlewares/async.js';
import { login} from '../controllers/auth.controller.js';

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in using username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     notifications:
 *                       type: string
 *                     department:
 *                       type: object
 *                       properties:
 *                         departmentId:
 *                           type: string
 *                         name:
 *                           type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login',  asyncHandler(login));

export default router;
