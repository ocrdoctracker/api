/**
 * @openapi
 * tags:
 *   name: Department
 *   description: API for Department
 */
import { Router } from "express";
import { body, validationResult } from "express-validator";
import { asyncHandler } from "../middlewares/async.js";
import { getDepartment, create, update, remove } from "../controllers/department.controller.js";

const router = Router();

/**
 * @openapi
 * /api/department/{departmentId}:
 *   get:
 *     tags: [Department]
 *     summary: Get a Department by id
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the Department
 *     responses:
 *       200:
 *         description: Department details
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
 *                     departmentId:
 *                       type: string
 *                     name:
 *                       type: string
 */
router.get("/:departmentId", asyncHandler(getDepartment));

/**
 * @openapi
 * /api/department:
 *   post:
 *     tags: [Department]
 *     summary: Create department
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Department successfully created
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
 *                     departmentId:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Invalid data
 */
router.post("/", asyncHandler(create));


/**
 * @openapi
 * /api/department/{departmentId}:
 *   put:
 *     tags: [Department]
 *     summary: Update department
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the Department
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Department successfully updated
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
 *                     departmentId:
 *                       type: string
 *                     name:
 *                       type: string
 *       401:
 *         description: Invalid data
 */
router.put("/:departmentId", asyncHandler(update));


/**
 * @openapi
 * /api/department/{departmentId}:
 *   delete:
 *     tags: [Department]
 *     summary: Remove Department
 *     parameters:
 *       - in: path
 *         name: departmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the Department
 *     responses:
 *       200:
 *         description: Department details
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
 *                     departmentId:
 *                       type: string
 *                     name:
 *                       type: string
 */
router.delete("/:departmentId", asyncHandler(remove));
export default router;
