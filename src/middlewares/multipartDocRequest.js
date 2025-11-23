// src/middleware/multipartDocRequest.js
import { readSingleFileFromMultipart } from "../utils/utils.js";

export async function multipartDocRequest(req, res, next) {
  try {
    const { filename, mimeType, size, buffer, fields } =
      await readSingleFileFromMultipart(req);

    // Expose file like in your upload handler
    if (size && buffer) {
      req.file = { filename, mimeType, size, buffer };
    } else {
      req.file = null;
    }

    // Attach fields to req.body so your existing controller sees them
    req.body = fields || {};

    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid multipart data",
    });
  }
}

export async function parseStepsMiddleware(req, res, next) {
  const rawSteps = req.body.steps;

  if (typeof rawSteps === "string" && rawSteps.trim() !== "") {
    try {
      const parsed = JSON.parse(rawSteps);
      req.body.steps = parsed;
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON in 'steps' field",
      });
    }
  }

  next();
}
