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
  upload,
  getDocRequestList,
  getDocRequestAssigned
} from "../controllers/doc-request.controller.js";
import { query } from "express-validator";

const router = Router();

/**
 * @openapi
 * /api/doc-request/assigned:
 *   get:
 *     tags: [Document Request]
 *     summary: Get Document Request assigned to user
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user assigned to the request
 *       - in: query
 *         name: requestStatus
 *         description: >
 *           Filter by one or more statuses. Accepts comma-separated values
 *           (e.g., `PENDING,APPROVED`) or repeated keys
 *           (e.g., `?requestStatus=PENDING&requestStatus=APPROVED`).
 *         required: false
 *         style: form
 *         explode: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [PENDING, CANCELLED, REJECTED, APPROVED, PROCESSING, COMPLETED, CLOSED]
 *         examples:
 *           single:
 *             summary: Single status
 *             value: [PENDING]
 *           multipleComma:
 *             summary: Multiple (comma-separated)
 *             value: [PENDING, APPROVED]
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
 *         description: Document Request assigned to user
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
 *                       docRequestId:
 *                         type: string
 *                       fromUserId:
 *                         type: string
 *                       purpose:
 *                         type: string
 *                       dateRequested:
 *                         type: string
 *                       assignedDepartment:
 *                         type: object
 *                       dateAssigned:
 *                         type: string
 *                       dateProcessStarted:
 *                         type: string
 *                       dateProcessEnd:
 *                         type: string
 *                       dateCompleted:
 *                         type: string
 *                       requestStatus:
 *                         type: string
 *                       description:
 *                         type: string
 *                       requestNo:
 *                         type: string
 *                       rejectReason:
 *                         type: string
 *                       cancelReason:
 *                         type: string
 */
router.get(
  "/assigned",
  [
    query("userId")
      .optional()
      .isInt().withMessage("userId must be a number"),

    query("requestStatus")
      .optional()
      .customSanitizer((value) => {
        // Always return an array
        if (Array.isArray(value)) return value;
        return [value];
      })
      .custom((values) => {
        values.forEach((v) => {
          if (!["PENDING","CANCELLED","REJECTED","APPROVED","PROCESSING","COMPLETED","CLOSED"].includes(v)) {
            throw new Error(
              `Invalid requestStatus: ${v}. Must be one of: ${["PENDING","CANCELLED","REJECTED","APPROVED","PROCESSING","COMPLETED","CLOSED"].join(", ")}`
            );
          }
        });
        return true;
      }),

    query("pageSize")
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage("pageSize must be between 1 and 100")
      .toInt(),
    query("pageIndex")
      .optional()
      .isInt({ min: 0 }).withMessage("pageIndex must be 0 or greater")
      .toInt(),
  ],
  asyncHandler(getDocRequestAssigned)
);

/**
 * @openapi
 * /api/doc-request/list:
 *   get:
 *     tags: [Document Request]
 *     summary: Get Document Request from user
 *     parameters:
 *       - in: query
 *         name: fromUserId
 *         schema:
 *           type: string
 *         description: Filter by user who created the request
 *       - in: query
 *         name: requestStatus
 *         description: >
 *           Filter by one or more statuses. Accepts comma-separated values
 *           (e.g., `PENDING,APPROVED`) or repeated keys
 *           (e.g., `?requestStatus=PENDING&requestStatus=APPROVED`).
 *         required: false
 *         style: form
 *         explode: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [PENDING, CANCELLED, REJECTED, APPROVED, PROCESSING, COMPLETED, CLOSED]
 *         examples:
 *           single:
 *             summary: Single status
 *             value: [PENDING]
 *           multipleComma:
 *             summary: Multiple (comma-separated)
 *             value: [PENDING, APPROVED]
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
 *         description: Document Request list
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
 *                       docRequestId:
 *                         type: string
 *                       fromUserId:
 *                         type: string
 *                       purpose:
 *                         type: string
 *                       dateRequested:
 *                         type: string
 *                       assignedDepartmentId:
 *                         type: string
 *                       dateAssigned:
 *                         type: string
 *                       dateProcessStarted:
 *                         type: string
 *                       dateProcessEnd:
 *                         type: string
 *                       dateCompleted:
 *                         type: string
 *                       requestStatus:
 *                         type: string
 *                       description:
 *                         type: string
 *                       requestNo:
 *                         type: string
 *                       rejectReason:
 *                         type: string
 *                       cancelReason:
 *                         type: string
 */

router.get(
  "/list",
  [
    query("fromUserId")
      .optional()
      .isInt().withMessage("fromUserId must be a number"),

      
    query("requestStatus")
      .optional()
      .customSanitizer((value) => {
        // Always return an array
        if (Array.isArray(value)) return value;
        return [value];
      })
      .custom((values) => {
        values.forEach((v) => {
          if (!["PENDING","CANCELLED","REJECTED","APPROVED","PROCESSING","COMPLETED","CLOSED"].includes(v)) {
            throw new Error(
              `Invalid requestStatus: ${v}. Must be one of: ${["PENDING","CANCELLED","REJECTED","APPROVED","PROCESSING","COMPLETED","CLOSED"].join(", ")}`
            );
          }
        });
        return true;
      }),
      
    query("pageSize")
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage("pageSize must be between 1 and 100")
      .toInt(),
    query("pageIndex")
      .optional()
      .isInt({ min: 0 }).withMessage("pageIndex must be 0 or greater")
      .toInt(),
  ],
  asyncHandler(getDocRequestList)
);

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
 *               - description
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
 *   put:
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

router.put(
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
