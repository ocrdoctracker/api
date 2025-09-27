/**
 * @openapi
 * tags:
 *   name: Common
 *   description: API for Common
 */
import { Router } from "express";
import { asyncHandler } from "../middlewares/async.js";
import { getDocumentTypes } from "../controllers/common.controller.js";

const router = Router();

/**
 * @openapi
 * /api/common/document-types.json:
 *   get:
 *     tags: [Common]
 *     summary: Get all the document types
 *     responses:
 *       200:
 *         description: JSON list of document types
 */
router.get("/document-types.json", asyncHandler(getDocumentTypes));
export default router;
