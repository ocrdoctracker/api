/**
 * @openapi
 * tags:
 *   name: User
 *   description: API for user
 */
import { Router } from "express";
import { body, validationResult } from "express-validator";
import { asyncHandler } from "../middlewares/async.js";
import { getUser, create } from "../controllers/user.controller.js";

const router = Router();

/**
 * @openapi
 * /api/user/{userId}:
 *   get:
 *     tags: [User]
 *     summary: Get a user by userId
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the user
 *     responses:
 *       200:
 *         description: User details
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
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     birthDate:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 */
router.get("/:userId", asyncHandler(getUser));
/**
 * @openapi
 * /api/user:
 *   post:
 *     tags: [User]
 *     summary: Create user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *               - email
 *               - departmentId
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               departmentId:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User successfully saved
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
 *                     departmentId:
 *                       type: string
 *       401:
 *         description: Invalid data
 */
router.post(
  "/",
  [
    body("departmentId")
      .exists()
      .withMessage("departmentId is required")
      .isString()
      .withMessage("departmentId must be a string"),

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
  asyncHandler(create)
);

export default router;
