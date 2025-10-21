/**
 * @openapi
 * tags:
 *   name: Search
 *   description: API for Search
 */
import { Router } from "express";
import { body, validationResult } from "express-validator";
import { asyncHandler } from "../middlewares/async.js";
import { search } from "../controllers/search.controller.js";
import { query } from "express-validator";

const router = Router();

/**
 * @openapi
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Search
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Keyword
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: The Id of the user
 *       - in: query
 *         name: filter
 *         description: >
 *           Filter by one or more type. Accepts comma-separated values
 *           (e.g., `docRequest,file`) or repeated keys
 *           (e.g., `?filter=docRequest&filter=file`).
 *         required: false
 *         style: form
 *         explode: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [docRequest, file]
 *         examples:
 *           single:
 *             summary: Single filter
 *             value: [docRequest]
 *           multipleComma:
 *             summary: Multiple (comma-separated)
 *             value: [docRequest, file]
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get(
  "/",
  [
    query("userId").optional().isInt().withMessage("userId must be a number"),
    query("filter")
      .optional()
      .customSanitizer((value) => {
        // Always return an array
        if (Array.isArray(value)) return value;
        else if (value && value.split(",").length > 0) return value.split(",");
        return [value];
      })
      .custom((values) => {
        values.forEach((v) => {
          if (
            ![
              "docRequest",
              "file",
            ].includes(v)
          ) {
            throw new Error(
              `Invalid filter: ${v}. Must be one of: ${[
              "docRequest",
              "file",
              ].join(", ")}`
            );
          }
        });
        return true;
      }),
  ],
  asyncHandler(search)
);

export default router;
