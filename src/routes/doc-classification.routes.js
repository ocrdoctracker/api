/**
 * @openapi
 * tags:
 *   name: Classification
 *   description: API for Document Classification testing
 */
import { Router } from "express";
import { asyncHandler } from "../middlewares/async.js";
import {
  classify,
} from "../controllers/doc-classification.controller.js";

const router = Router();

/**
 * @openapi
 * /api/doc-classification:
 *   post:
 *     tags: [Classification]
 *     summary: Upload a file for a Document Request
 *     description: |
 *       Accepts a single file (max 10 MB). Returns extracted text (if supported) and file metadata.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid data
 */

router.post("/", asyncHandler(classify)
);

export default router;
