import {
  ERROR_DOCREQUEST_NOT_FOUND,
  CREATE_SUCCESS,
  DOCREQUEST_STATUS,
  UPDATE_SUCCESS,
} from "../constants/doc-request.constant.js";
import { ERROR_USER_NOT_FOUND } from "../constants/user.constant.js";
import {
  getDocRequestById,
  createDocRequest,
  updateDocRequestStatus,
  updateDocRequest,
  updateDocRequestFile,
  getDocRequestFromUser,
  getDocRequestAssignedToUser
} from "../services/doc-request.service.js";
import {
  readSingleFileFromMultipart,
  extractTextFromBuffer,
  sanitizePublicId,
} from "../utils/utils.js";
import { getUserById } from "../services/user.service.js";
import {
  loadLocalClassifier,
  classifyLocal,
} from "../classifiers/localBayes.js";
import { env } from "../config/env.js";
import cloudinary from "../config/cloudinaryConfig.js";
import { getDepartmentById } from "../services/department.service.js";
import { ERROR_DEPARTMENT_NOT_FOUND } from "../constants/department.constant.js";
import { loadDocumentTypes } from "../services/common.service.js";
const documentTypes = loadDocumentTypes();
const documentTypesobj = Object.assign({}, ...documentTypes);

const clfPromise = loadLocalClassifier()
  .then((clf) => {
    console.log("✅ Local Bayes model loaded.");
    return clf;
  })
  .catch((e) => {
    console.error("❌ Failed to load model:", e.message);
    process.exit(1);
  });

export async function getDocRequest(req, res) {
  const { docRequestId } = req.params;
  if (!docRequestId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing docRequestId params" });
  }
  let docRequest = await getDocRequestById(docRequestId);
  if (!docRequest) {
    return res
      .status(400)
      .json({ success: false, message: ERROR_DOCREQUEST_NOT_FOUND });
  }
  return res.json({ success: true, data: docRequest });
}

export async function getDocRequestAssigned(req, res) {
  const { userId, requestStatus, pageSize, pageIndex } = req.query;
  const user = await getUserById(userId);
  if (!user) {
    return res
      .status(400)
      .json({ success: false, message: ERROR_USER_NOT_FOUND });
  }
  let docRequest = await getDocRequestAssignedToUser(userId, requestStatus.split(","), pageSize, pageIndex);
  docRequest.results.map(x=> {
    x.purpose = documentTypesobj[x.purpose];
    return x;
  });
  return res.json({ success: true, data: docRequest });
}

export async function getDocRequestList(req, res) {
  const { fromUserId, requestStatus, pageSize, pageIndex } = req.query;
  const user = await getUserById(fromUserId);
  if (!user) {
    return res
      .status(400)
      .json({ success: false, message: ERROR_USER_NOT_FOUND });
  }
  let docRequest = await getDocRequestFromUser(fromUserId, requestStatus.split(","), pageSize, pageIndex);
  docRequest.results.map(x=> {
    x.purpose = documentTypesobj[x.purpose];
    return x;
  });
  return res.json({ success: true, data: docRequest });
}

export async function create(req, res) {
  const { fromUserId, assignedDepartmentId, purpose, description } = req.body;
  let docRequest;
  try {
    const user = await getUserById(fromUserId);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_USER_NOT_FOUND });
    }
    const department = await getDepartmentById(assignedDepartmentId);
    if (!department) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DEPARTMENT_NOT_FOUND });
    }
    const requestStatus = DOCREQUEST_STATUS.PENDING;
    docRequest = await createDocRequest(
      fromUserId,
      assignedDepartmentId,
      purpose,
      requestStatus,
      description
    );
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: docRequest, message: CREATE_SUCCESS });
}

export async function update(req, res) {
  const { docRequestId } = req.params;
  if (!docRequestId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing docRequestId params" });
  }
  const { description } = req.body;
  let docRequest;
  try {
    docRequest = await updateDocRequest(docRequestId, description);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: docRequest, message: UPDATE_SUCCESS });
}

export async function updateStatus(req, res) {
  const { docRequestId } = req.params;
  if (!docRequestId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing docRequestId params" });
  }
  const { requestStatus, assignedDepartmentId, reason } = req.body;

  let docRequest, assignedUser;

  try {
    if (requestStatus === DOCREQUEST_STATUS.APPROVED) {
      assignedUser = await getUserById(assignedDepartmentId);
      if (!assignedUser) {
        return res
          .status(400)
          .json({ success: false, message: "Assigned user not found" });
      }
    }

    docRequest = await getDocRequestById(docRequestId);
    if (!docRequest) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DOCREQUEST_NOT_FOUND });
    } else {
      if (
        docRequest?.requestStatus === DOCREQUEST_STATUS.CANCELLED ||
        docRequest?.requestStatus === DOCREQUEST_STATUS.REJECTED ||
        docRequest?.requestStatus === DOCREQUEST_STATUS.CLOSED ||
        ((docRequest?.requestStatus === DOCREQUEST_STATUS.APPROVED ||
          docRequest?.requestStatus === DOCREQUEST_STATUS.PROCESSING ||
          docRequest?.requestStatus === DOCREQUEST_STATUS.COMPLETED) &&
          (requestStatus === DOCREQUEST_STATUS.CANCELLED ||
            requestStatus === DOCREQUEST_STATUS.REJECTED)) ||
        ((docRequest?.requestStatus === DOCREQUEST_STATUS.PROCESSING ||
          docRequest?.requestStatus === DOCREQUEST_STATUS.COMPLETED) &&
          requestStatus === DOCREQUEST_STATUS.APPROVED) ||
        (docRequest?.requestStatus === DOCREQUEST_STATUS.COMPLETED &&
          requestStatus === DOCREQUEST_STATUS.PROCESSING)
      ) {
        return res.status(400).json({
          success: false,
          message: `Document Request was already ${docRequest?.requestStatus
            .toString()
            .toLowerCase()}`,
        });
      }

      if (requestStatus === docRequest?.requestStatus) {
        return res.status(400).json({
          success: false,
          message: `Document Request was already ${requestStatus
            .toString()
            .toLowerCase()}`,
        });
      }

      if (
        docRequest?.requestStatus === DOCREQUEST_STATUS.PENDING &&
        (requestStatus === DOCREQUEST_STATUS.PROCESSING ||
          requestStatus === DOCREQUEST_STATUS.CLOSED ||
          requestStatus === DOCREQUEST_STATUS.COMPLETED)
      ) {
        return res.status(400).json({
          success: false,
          message: "Document Request was not yet Approved",
        });
      }

      if (
        (docRequest?.requestStatus === DOCREQUEST_STATUS.PENDING ||
          docRequest?.requestStatus === DOCREQUEST_STATUS.APPROVED) &&
        (requestStatus === DOCREQUEST_STATUS.COMPLETED ||
          requestStatus === DOCREQUEST_STATUS.CLOSED)
      ) {
        return res.status(400).json({
          success: false,
          message: "Document Request was not yet Porcessed",
        });
      }

      if (
        docRequest?.requestStatus === DOCREQUEST_STATUS.PROCESSING &&
        requestStatus === DOCREQUEST_STATUS.CLOSED
      ) {
        return res.status(400).json({
          success: false,
          message: "Document Request was not yet Completed",
        });
      }
      docRequest = await updateDocRequestStatus(
        docRequestId,
        requestStatus,
        assignedDepartmentId || 0,
        reason || ""
      );
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: docRequest, message: UPDATE_SUCCESS });
}

export async function upload(req, res) {
  const { docRequestId } = req.params;
  let docRequest;
  try {
    // read single file (10MB cap)
    const { filename, mimeType, size, buffer } =
      await readSingleFileFromMultipart(req);

    if (!size) {
      return res
        .status(400)
        .json({ success: false, message: "No file received" });
    }

    // ensure the doc request exists
    docRequest = await getDocRequestById(docRequestId);
    if (!docRequest) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DOCREQUEST_NOT_FOUND });
    }
    // Extract text (best-effort). If not needed, remove this block.
    let extractedText = "";
    try {
      extractedText = await extractTextFromBuffer(filename, buffer);
      if (!extractedText)
        return res.status(400).json({ error: "No text extracted" });
    } catch (e) {
      // non-fatal: continue without extracted text
      extractedText = "";
      if (!extractedText)
        return res.status(400).json({ error: "No text extracted" });
    }

    const clf = await clfPromise;
    const cnnResults = classifyLocal(clf, extractedText, {
      threshold: Number(env?.cnn?.threshold),
      otherLabel: env?.cnn?.otherLabel,
      topK: 5,
    });
    if (
      !cnnResults?.best?.label ||
      cnnResults?.best?.label === "" ||
      !documentTypesobj[cnnResults?.best?.label || ""] ||
      (docRequest?.purpose.toLowerCase().trim() !== "others" &&
        cnnResults?.best?.label !== docRequest?.purpose) ||
      (docRequest?.purpose.toLowerCase().trim() !== "others" &&
        Number(cnnResults?.best?.score || 0) <= 0.5)
    ) {
      throw new Error(
        "The uploaded document does not match the requested purpose. Please review the file."
      );
    }
    const public_id = `documents/${sanitizePublicId(filename)}`;
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id, // stable name (folder + clean base)
          overwrite: true, // replace if same public_id
          use_filename: false, // we control public_id ourselves
          unique_filename: false,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });
    // TODO: Persist file (DB / S3 / Cloudinary) and link to docRequestId.
    // Example:
    // const stored = await saveDocRequestFile({ docRequestId, filename, mimeType, buffer, extractedText });

    if (!uploadResult?.public_id) {
      throw new Error("Unable to upload to cloud storage");
    }

    docRequest = await updateDocRequestFile(
      docRequestId,
      {
        filename, mimeType,
        publicId: uploadResult.public_id,
        createdAt: uploadResult.created_at,
        bytes: uploadResult.bytes,
        signature: uploadResult.signature,
        resourceType: uploadResult.resource_type,
        displayName: uploadResult.display_name,
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url,
      },
      {
        label: cnnResults?.best?.label,
        score: cnnResults?.best?.score,
        name: documentTypesobj[cnnResults?.best?.label || ""],
      }
    );
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error.message || "Upload failed" });
  }
  return res.json({
    success: true,
    data: docRequest,
    message: "UPLOAD_SUCCESS",
  });
}
