import path from "node:path";
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
  getDocRequestAssignedToUser,
  deleteDocRequest
} from "../services/doc-request.service.js";
import {
  readSingleFileFromMultipart,
  extractTextFromBuffer,
  sanitizePublicId,
  getExtension,
} from "../utils/utils.js";
import {
  getUserById,
  getAllUserByDepartment,
} from "../services/user.service.js";
import {
  loadLocalClassifier,
  classifyLocal,
} from "../classifiers/localBayes.js";
import { env } from "../config/env.js";
import cloudinary from "../config/cloudinaryConfig.js";
import { getDepartmentById } from "../services/department.service.js";
import { ERROR_DEPARTMENT_NOT_FOUND } from "../constants/department.constant.js";
import { loadDocumentTypes } from "../services/common.service.js";
import { detectStampOnBuffer, initStamps } from "../services/stamp.service.js";
import { createNotification } from "../services/notifications.service.js";
import { REQUEST_NOTIF } from "../constants/notifications.constant.js";
import NodeCache from "node-cache";
// Cache (TTL = 60s)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Key helpers
export const KEY_NOTIF_LIST = (userId, pageIndex, pageSize) =>
  `notif:list:${userId}:p${pageIndex}:s${pageSize}`;
export const KEY_NOTIF_COUNT = (userId) => `notif:count:${userId}`;
export const KEY_NOTIF_INDEX = (userId) => `notif:index:${userId}`;

// Helper to invalidate ALL notification-related cache for a user
function clearUserNotificationsCache(userId) {
  const uid = String(userId);
  const idxKey = KEY_NOTIF_INDEX(uid);
  const arr = cache.get(idxKey) || [];

  // Delete all cached pages for that user
  if (arr.length) cache.del(arr);

  // Delete the page index itself
  cache.del(idxKey);

  // Delete count (totalUnread)
  cache.del(KEY_NOTIF_COUNT(uid));

  console.log(`[Cache] Cleared all notification cache for user ${uid}`);
}

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

// (Optional) warm up stamp samples at boot (non-fatal if stamps folder missing)
const stampsReady = initStamps().catch((e) =>
  console.warn("⚠️ initStamps failed (continuing):", e.message)
);

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
  docRequest.purpose = documentTypesobj[docRequest.purpose];
  return res.json({ success: true, data: docRequest });
}

export async function getDocRequestAssigned(req, res) {
  const { userId, requestStatus, pageSize, pageIndex } = req.query;
  let docRequests;
  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing userId params" });
  }
  try {
    const user = await getUserById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_USER_NOT_FOUND });
    }
    docRequests = await getDocRequestAssignedToUser(
      userId,
      requestStatus,
      pageSize,
      pageIndex
    );
    docRequests.results.map((x) => {
      x.purpose = documentTypesobj[x.purpose];
      return x;
    });
  } catch (ex) {
    return res.status(400).json({ success: false, message: ex?.message });
  }
  return res.json({ success: true, data: docRequests });
}

export async function getDocRequestList(req, res) {
  const { fromUserId, requestStatus, pageSize, pageIndex } = req.query;
  if (!fromUserId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing fromUserId params" });
  }
  let docRequests;
  try {
    const user = await getUserById(fromUserId);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_USER_NOT_FOUND });
    }
    docRequests = await getDocRequestFromUser(
      fromUserId,
      requestStatus,
      pageSize,
      pageIndex
    );
    docRequests.results.map((x) => {
      x.purpose = documentTypesobj[x.purpose];
      return x;
    });
  } catch (ex) {
    return res.status(400).json({ success: false, message: ex?.message });
  }
  return res.json({ success: true, data: docRequests });
}

export async function create(req, res) {
  const { fromUserId, assignedDepartmentId, purpose, description } = req.body;
  if (!fromUserId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing fromUserId params" });
  }
  if (!assignedDepartmentId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing assignedDepartmentId params" });
  }
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
    docRequest = await getDocRequestById(docRequest?.docRequestId);
    docRequest.purpose = documentTypesobj[docRequest.purpose];
    const getAllUsers = await getAllUserByDepartment(
      docRequest?.assignedDepartment?.departmentId
    );
    const notifications = [];
    for (const user of getAllUsers) {
      notifications.push({
        userId: user?.userId,
        title: REQUEST_NOTIF.PENDING.title,
        description: REQUEST_NOTIF.PENDING.description?.replace(
          "{requestId}",
          docRequest?.requestNo
        ),
        type: "DOC_REQUEST",
        referenceId: docRequest?.docRequestId,
      });
      clearUserNotificationsCache(user?.userId);
    }
    if (notifications.length > 0) {
      const notifSent = await createNotification(notifications);
      console.log(notifSent);
    }
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
  const { description, documentFile } = req.body;
  let docRequest;
  try {
    docRequest = await updateDocRequest(
      docRequestId,
      description,
      documentFile || {}
    );
    docRequest = await getDocRequestById(docRequestId);
    docRequest.purpose = documentTypesobj[docRequest.purpose];
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
  const { requestStatus, reason } = req.body;

  let docRequest;

  try {
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

      if (
        !docRequest?.documentFile?.publicId &&
        requestStatus === DOCREQUEST_STATUS.COMLPETED
      ) {
        return res.status(400).json({
          success: false,
          message: "Document Request document file is required",
        });
      }

      docRequest = await updateDocRequestStatus(
        docRequestId,
        requestStatus,
        reason || ""
      );
      docRequest = await getDocRequestById(docRequestId);
      docRequest.purpose = documentTypesobj[docRequest.purpose];

      let title, description;
      let users = [];

      title = REQUEST_NOTIF[docRequest?.requestStatus?.toUpperCase()].title;
      description = REQUEST_NOTIF[
        docRequest?.requestStatus?.toUpperCase()
      ].description
        ?.replace("{requestId}", docRequest?.requestNo)
        ?.replace("{departmentName}", docRequest?.assignedDepartment?.name);

        if(docRequest?.requestStatus === DOCREQUEST_STATUS.CANCELLED || docRequest?.requestStatus === DOCREQUEST_STATUS.CLOSED) {
          const getAllUsers = await getAllUserByDepartment(
            docRequest?.assignedDepartment?.departmentId
          );
          users = [...getAllUsers,]
        } else {
          users = [docRequest?.fromUser]
        }
      const notifications = [];
      for (const user of users) {
        notifications.push({
          userId: user?.userId,
          title,
          description,
          type: "DOC_REQUEST",
          referenceId: docRequest?.docRequestId,
        });
      clearUserNotificationsCache(user?.userId);
      }
      if (notifications.length > 0) {
        const notifSent = await createNotification(notifications);
        console.log(notifSent);
      }
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

    // Ensure stamps are loaded (non-blocking if already done)
    await stampsReady;
    // Stamp detection works directly on the binary buffer (PDF/DOCX/Image)
    const stampPromise = detectStampOnBuffer(buffer, mimeType);

    // const clf = await clfPromise;
    const [clf, stamp] = await Promise.all([clfPromise, stampPromise]);
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
      return res.status(400).json({
        success: false,
        message:
          "The uploaded document does not match the requested purpose. Please review the file.",
        data: {
          label: cnnResults?.best?.label,
          score: cnnResults?.best?.score,
          name: documentTypesobj[cnnResults?.best?.label || ""],
        },
      });
    }
    if (!stamp.match && stamp.score < 0.9) {
      return res.status(400).json({
        success: false,
        message: "The uploaded document does not have a documentary stamp.",
        data: {
          label: cnnResults?.best?.label,
          score: cnnResults?.best?.score,
          stampScore: stamp.score,
          stampFound: stamp.match,
          name: documentTypesobj[cnnResults?.best?.label || ""],
        },
      });
    }
    const public_id = `documents/${filename}`;
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
        filename,
        mimeType,
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
    docRequest = await getDocRequestById(docRequestId);
    docRequest.purpose = documentTypesobj[docRequest.purpose];

    const users = [docRequest?.fromUser];

    const notifications = [];
    for (const user of users) {
      notifications.push({
        userId: user?.userId,
        title: REQUEST_NOTIF.UPLOADED.title,
        description: REQUEST_NOTIF.UPLOADED.description?.replace(
          "{requestId}",
          docRequest?.requestNo
        ),
        type: "DOC_REQUEST",
        referenceId: docRequest?.docRequestId,
      });
      clearUserNotificationsCache(user?.userId);
    }
    if (notifications.length > 0) {
      await createNotification(notifications);
    }
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error.message || "Upload failed" });
  }
  return res.json({
    success: true,
    data: docRequest,
    message: "Document uploaded successfully!",
  });
}

export async function remove(req, res) {
  const { docRequestId } = req.params;
  let docRequest;
  try {
    // ensure the doc request exists
    docRequest = await getDocRequestById(docRequestId);
    if (!docRequest) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DOCREQUEST_NOT_FOUND });
    }

    await deleteDocRequest(docRequestId);
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error.message || "Upload failed" });
  }
  return res.json({
    success: true,
    data: docRequest,
    message: "Document uploaded successfully!",
  });
}
