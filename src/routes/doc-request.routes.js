/**
 * @openapi
 * tags:
 *   name: Document Request
 *   description: API for Document Request
 */
import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import { asyncHandler } from "../middlewares/async.js";
import {
  getDocRequest,
  create,
  update,
  updateStatus,
  upload
} from "../controllers/doc-request.controller.js";

const router = Router();

/**
 * @openapi
 * /api/doc-request/{docRequestId}:
 *   get:
 *     tags: [Document Request]
 *     summary: Get Document Request by docRequestId
 *     parameters:
 *       - in: path
 *         name: docRequestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the document request
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
 */
router.get("/:docRequestId", asyncHandler(getDocRequest));

/**
 * @openapi
 * /api/doc-request/:
 *   post:
 *     tags: [Document Request]
 *     summary: Create Document Request
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromUserId
 *               - assignedDepartmentId
 *               - purpose
 *               - description
 *             properties:
 *               fromUserId:
 *                 type: string
 *               assignedDepartmentId:
 *                 type: string
 *               purpose:
 *                 type: string
 *               description:
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
router.post("/", asyncHandler(create));

/**
 * @openapi
 * /api/doc-request/{docRequestId}:
 *   put:
 *     tags: [Document Request]
 *     summary: Update Document Request details
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
 *               - requestStatus
 *             properties:
 *               description:
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
  "/:docRequestId",
  [
    param("docRequestId")
      .exists()
      .withMessage("docRequestId is required in path")
      .toInt()
      .isInt({ gt: 0 })
      .withMessage("docRequestId must be a positive integer"),

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
  asyncHandler(update)
);

/**
 * @openapi
 * /api/doc-request/{docRequestId}/status:
 *   put:
 *     tags: [Document Request]
 *     summary: Update Document Request status
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
 *               - requestStatus
 *             properties:
 *               requestStatus:
 *                 type: string
 *               assignedDepartmentId:
 *                 type: string
 *               reason:
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
  "/:docRequestId/status",
  [
    param("docRequestId")
      .exists()
      .withMessage("docRequestId is required in path")
      .toInt()
      .isInt({ gt: 0 })
      .withMessage("docRequestId must be a positive integer"),

    body("requestStatus")
      .exists()
      .withMessage("requestStatus is required")
      .isString()
      .withMessage("requestStatus must be a string")
      .isIn(["CANCELLED","REJECTED","APPROVED","PROCESSING","COMPLETED","CLOSED"])
      .withMessage(`requestStatus must be one of: ${["CANCELLED","REJECTED","APPROVED","PROCESSING","COMPLETED","CLOSED"].join(", ")}`),

    // assignedDepartmentId is required only when status = APPROVED
    body("assignedDepartmentId")
      .if(body("requestStatus").equals("APPROVED"))
      .exists()
      .withMessage("assignedDepartmentId is required when requestStatus = APPROVED")
      .bail()
      .toInt()
      .isInt({ gt: 0 })
      .withMessage("assignedDepartmentId must be a positive integer"),

    // reason is required only when status = CANCELLED or REJECTED
    body("reason")
      .if(body("requestStatus").isIn(["CANCELLED", "REJECTED"]))
      .exists()
      .withMessage(
        "reason is required when requestStatus is CANCELLED or REJECTED"
      )
      .bail()
      .isString()
      .withMessage("reason must be a string")
      .notEmpty()
      .withMessage("reason must not be empty"),

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
  asyncHandler(updateStatus)
);

/**
 * @openapi
 * /api/doc-request/{docRequestId}/upload:
 *   post:
 *     tags: [Document Request]
 *     summary: Upload a file for a Document Request
 *     description: |
 *       Accepts a single file (max 10 MB). Returns extracted text (if supported) and file metadata.
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
 *                   properties:
 *                     docRequestId:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     mimeType:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     extractedText:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid data
 */

router.post(
  "/:docRequestId/upload",
  [
    param("docRequestId")
      .exists().withMessage("docRequestId is required in path")
      .toInt()
      .isInt({ gt: 0 }).withMessage("docRequestId must be a positive integer"),

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
  asyncHandler(upload)
);

export default router;
