/**
 * @openapi
 * tags:
 *   name: Doc Request Workflow
 *   description: API for Doc Request Workflowx
 */
import { Router } from "express";
import { asyncHandler } from "../middlewares/async.js";
import { body, param, validationResult } from "express-validator";
import { config, approveStep, upload } from "../controllers/doc-request-workflow.controller.js";
import { multipartDocRequest, parseStepsMiddleware } from "../middlewares/multipartDocRequest.js";
import { query } from "express-validator";

const router = Router();

const createDocRequestValidators = [
  body("step")
    .exists()
    .withMessage("step is required")
    .toInt()
    .isInt({ gt: 0 })
    .withMessage("step must be a positive integer"),

  // final validator (same style as /upload route)
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error(errors.array()[0].msg);
      err.status = 400;
      return next(err);
    }
    next();
  },
];

/**
 * @openapi
 * /api/doc-request-workflow/config:
 *   get:
 *     tags: [Doc Request Workflow]
 *     summary: Get Doc Request Workflow Config
 *     responses:
 *       200:
 *         description: JSON list of Doc Request Workflow Config
 */
router.get("/config", asyncHandler(config));



/**
 * @openapi
 * /api/doc-request/{docRequestId}/approval:
 *   put:
 *     tags: [Doc Request Workflow]
 *     summary: Update Doc Workflow Request status
 *     parameters:
 *       - in: path
 *         name: docRequestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the Document Request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *             properties:
 *               step:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document Request details
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
 *                     docRequestId:
 *                       type: string
 *                     fromUserId:
 *                       type: string
 *                     purpose:
 *                       type: string
 *                     dateRequested:
 *                       type: string
 *                     assignedDepartmentId:
 *                       type: string
 *                     dateAssigned:
 *                       type: string
 *                     dateProcessStarted:
 *                       type: string
 *                     dateProcessEnd:
 *                       type: string
 *                     dateCompleted:
 *                       type: string
 *                     requestStatus:
 *                       type: string
 *                     description:
 *                       type: string
 *                     requestNo:
 *                       type: string
 *                     rejectReason:
 *                       type: string
 *                     cancelReason:
 *                       type: string
 *       401:
 *         description: Invalid data
 */
router.put(
  "/:docRequestId/approval",
  [
    param("docRequestId")
      .exists()
      .withMessage("docRequestId is required in path")
      .toInt()
      .isInt({ gt: 0 })
      .withMessage("docRequestId must be a positive integer"),

    body("step")
      .exists()
      .withMessage("step is required")
      .toInt()
      .isInt({ gt: 0 })
      .withMessage("step must be a positive integer"),

    // final validator
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const err = new Error(errors.array()[0].msg);
        err.status = 400;
        return next(err);
      }
      next();
    },
  ],
  asyncHandler(approveStep)
);

/**
 * @openapi
 * /api/doc-request-workflow/{docRequestId}/upload:
 *   put:
 *     tags: [Doc Request Workflow]
 *     summary: Upload Doc Request Workflow file
 *     parameters:
 *       - in: path
 *         name: docRequestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the Document Request
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - step
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               step:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document Request details
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
 *                     docRequestId:
 *                       type: string
 *                     fromUserId:
 *                       type: string
 *                     purpose:
 *                       type: string
 *                     dateRequested:
 *                       type: string
 *                     assignedDepartmentId:
 *                       type: string
 *                     dateAssigned:
 *                       type: string
 *                     dateProcessStarted:
 *                       type: string
 *                     dateProcessEnd:
 *                       type: string
 *                     dateCompleted:
 *                       type: string
 *                     requestStatus:
 *                       type: string
 *                     description:
 *                       type: string
 *                     requestNo:
 *                       type: string
 *                     rejectReason:
 *                       type: string
 *                     cancelReason:
 *                       type: string
 *                     steps:
 *                       type: string
 *       400:
 *         description: Invalid data
 */

router.put(
  "/:docRequestId/upload",
  multipartDocRequest,   
  parseStepsMiddleware,
  createDocRequestValidators,
  asyncHandler(upload)
);

export default router;
