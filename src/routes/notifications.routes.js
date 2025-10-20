/**
 * @openapi
 * tags:
 *   name: Notifications
 *   description: API for Notifications
 */
import { Router } from "express";
import { body, validationResult } from "express-validator";
import { asyncHandler } from "../middlewares/async.js";
import { getNotifications, markAsRead, getTotalUnreadNotif } from "../controllers/notifications.controller.js";

const router = Router();

/**
 * @openapi
 * /api/notifications/user:
 *   get:
 *     tags: [Notifications]
 *     summary: Get by user
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page (default 10)
 *       - in: query
 *         name: pageIndex
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Page index starting from 0 (default 0)
 *     responses:
 *       200:
 *         description: Get by user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       notificationId:
 *                         type: string
 *                       userId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       referenceId:
 *                         type: string
 *                       date:
 *                         type: date
 */
router.get("/user", asyncHandler(getNotifications));

/**
 * @openapi
 * /api/notifications/{userId}/count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get total unread notification count by user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the user
 *     responses:
 *       200:
 *         description: Count of unread notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: string
 */
router.get("/:userId/count", asyncHandler(getTotalUnreadNotif));

/**
 * @openapi
 * /api/notifications/{notificationId}/read:
 *   delete:
 *     tags: [Notifications]
 *     summary: Read Notification
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the Notification
 *     responses:
 *       200:
 *         description: Notification details
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
 *                     notificationId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     type:
 *                       type: string
 *                     referenceId:
 *                       type: string
 *                     date:
 *                       type: date
 */
router.put("/:notificationId/read", asyncHandler(markAsRead));
export default router;
