/**
 * @openapi
 * tags:
 *   name: Doc Workflow Config
 *   description: API for Doc Workflow Config
 */
import { Router } from "express";
import { asyncHandler } from "../middlewares/async.js";
import { config } from "../controllers/doc-workflow-config.controller.js";

const router = Router();

/**
 * @openapi
 * /api/doc-workflow-config:
 *   get:
 *     tags: [Doc Workflow Config]
 *     summary: Get Document Workflow Config
 *     responses:
 *       200:
 *         description: JSON list of Document Workflow Config
 */
router.get("/", asyncHandler(config));
export default router;
