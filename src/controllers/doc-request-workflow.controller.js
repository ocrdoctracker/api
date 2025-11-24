import { env } from "../config/env.js";
import {
  getDocRequestById,
  updateDocRequestWorkflowStatus,
  updateDocRequestWorkflowFile,
  updateDocRequestStatus,
} from "../services/doc-request.service.js";
import {
  ERROR_DOCREQUEST_NOT_FOUND,
  DOCREQUEST_STATUS,
  UPDATE_SUCCESS,
  UPDATE_WORKFLOW_SUCCESS
} from "../constants/doc-request.constant.js";
import {
  getUserById,
  getAllUserByDepartment,
} from "../services/user.service.js";
import { getDepartmentById } from "../services/department.service.js";
import { ERROR_DEPARTMENT_NOT_FOUND } from "../constants/department.constant.js";
import { loadDocumentTypes } from "../services/common.service.js";
import { createNotification } from "../services/notifications.service.js";
import { REQUEST_NOTIF } from "../constants/notifications.constant.js";
import NodeCache from "node-cache";
import cloudinary from "../config/cloudinaryConfig.js";
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
// Put these in ENV in real life
const API_KEY = env?.google?.apiKey; // ← replace with your key or use env
const SPREADSHEET_ID = env?.google?.workflowConfigSheetId;
const RANGE = env?.google?.workflowConfigSheetRange; // adjust to your sheet

// ---- Transform rows -> desired JSON (GROUPED BY DocPurpose) ----
function transformWorkflow(rows) {
  if (!rows || rows.length < 2) {
    throw new Error("Sheet has no data");
  }

  const header = rows[0];

  const colIndex = (name) => {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`Column "${name}" not found in header`);
    return idx;
  };

  const docPurposeCol = colIndex("DocPurpose");
  const docPurposeFileReqCol = colIndex("DocPurposeFileRequirement");
  const stepCol = colIndex("Steps");
  const approvalCol = colIndex("Approval");
  const deptCol = colIndex("DepartmentId");
  const stepsFileRequirementCol = colIndex("StepsFileRequirements");

  const validYesNo = (v) => {
    const s = String(v || "").trim().toLowerCase();
    return s === "yes" || s === "no";
  };

  const toBool = (v) =>
    String(v || "")
      .trim()
      .toLowerCase() === "yes";

  const groups = {};

  rows.slice(1).forEach((r, index) => {
    const rowNum = index + 2; // actual sheet row number

    const docPurpose = r[docPurposeCol];
    const docPurposeFileReqRaw = r[docPurposeFileReqCol];

    // ---------- DOC PURPOSE IS REQUIRED ----------
    if (!docPurpose) {
      console.warn(`Skipping row ${rowNum}: Missing DocPurpose`);
      return;
    }

    // Ensure the group exists even if this row has NO valid steps
    if (!groups[docPurpose]) {
      groups[docPurpose] = {
        docPurpose,
        docPurposeFileRequirement: null, // will be filled from first non-empty value
        steps: [],
      };
    }

    // If this row has a non-empty DocPurposeFileRequirement and group doesn't yet have one, set it
    const trimmedReq = String(docPurposeFileReqRaw || "").trim();
    if (trimmedReq && !groups[docPurpose].docPurposeFileRequirement) {
      groups[docPurpose].docPurposeFileRequirement = trimmedReq;
    }

    // ---------- STEP FIELDS ----------
    const stepRaw = r[stepCol];
    const approvalRaw = r[approvalCol];
    const deptRaw = r[deptCol];
    const stepsFileRequirement = r[stepsFileRequirementCol];

    // Check if this row even tries to define a step
    const hasAnyStepData =
      (stepRaw && String(stepRaw).trim() !== "") ||
      (approvalRaw && String(approvalRaw).trim() !== "") ||
      (deptRaw && String(deptRaw).trim() !== "") ||
      (stepsFileRequirement && String(stepsFileRequirement).trim() !== "");

    // If there is absolutely no step data, we just keep the group and move on.
    if (!hasAnyStepData) {
      return;
    }

    // ---------- VALIDATION FOR STEP ----------
    // Steps must be a valid number
    const stepNum = Number(stepRaw);
    if (!stepRaw || Number.isNaN(stepNum)) {
      console.warn(
        `Row ${rowNum}: Invalid Step "${stepRaw}", skipping step but keeping DocPurpose group.`
      );
      return;
    }

    // Approval must be Yes/No
    if (!validYesNo(approvalRaw)) {
      console.warn(
        `Row ${rowNum}: Invalid Approval "${approvalRaw}", skipping step but keeping DocPurpose group.`
      );
      return;
    }

    // DepartmentId must be a number
    const deptNum = Number(deptRaw);
    if (!deptRaw || Number.isNaN(deptNum)) {
      console.warn(
        `Row ${rowNum}: Invalid DepartmentId "${deptRaw}", skipping step but keeping DocPurpose group.`
      );
      return;
    }

    // ---------- ADD VALIDATED STEP ----------
    groups[docPurpose].steps.push({
      step: stepNum,
      approval: toBool(approvalRaw),
      departmentId: deptNum,
      stepsFileRequirement: stepsFileRequirement ?? null,
    });
  });

  // Return an array of { docPurpose, docPurposeFileRequirement, steps }
  return Object.values(groups);
}

// ---- Fetch sheet using API key (no OAuth) ----
async function fetchWorkflow() {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
      RANGE
    )}`
  );
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const rows = data.values || [];
  return transformWorkflow(rows);
}

export async function config(req, res) {
  try {
    const wf = await fetchWorkflow(); // ← returns an ARRAY now
    return res.json({
      success: true,
      data: wf,
      message: "Workflow config",
    });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error?.message || "Error" });
  }
}

export async function approveStep(req, res) {
  const { docRequestId } = req.params;
  if (!docRequestId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing docRequestId params" });
  }
  const { step } = req.body;

  if(isNaN(Number(step))) {
    return res
      .status(400)
      .json({ success: false, message: "Step should be a number" });
  }

  let docRequest;

  try {
    docRequest = await getDocRequestById(docRequestId);
    if (!docRequest) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DOCREQUEST_NOT_FOUND });
    } else {
      const maxStep = Math.max(...docRequest?.steps.map(s => Number(s.step)));  // highest step number
      const isLastStep = Number(step) === maxStep;
      if (
        docRequest?.requestStatus === DOCREQUEST_STATUS.CANCELLED ||
        docRequest?.requestStatus === DOCREQUEST_STATUS.REJECTED ||
        docRequest?.requestStatus === DOCREQUEST_STATUS.CLOSED || 
        docRequest?.requestStatus === DOCREQUEST_STATUS.PROCESSING || 
        docRequest?.requestStatus === DOCREQUEST_STATUS.COMPLETED) {
        return res.status(400).json({
          success: false,
          message: `Document Request was already ${docRequest?.requestStatus
            .toString()
            .toLowerCase()}`,
        });
      }

      if(isLastStep) {
        docRequest.requestStatus = DOCREQUEST_STATUS.APPROVED;
      }

      docRequest?.steps?.forEach(x=> {
        if(Number(x.step) === Number(step)) {
          x.isApproved = true;
          return;
        }
      });


      docRequest = await updateDocRequestWorkflowStatus(
        docRequestId,
        docRequest.requestStatus,
        docRequest?.steps
      );
      docRequest = await getDocRequestById(docRequestId);
      docRequest.purposeName = documentTypesobj[docRequest.purpose];

      let title, description;
      let users = [];

      title = REQUEST_NOTIF[docRequest?.requestStatus?.toUpperCase()].title;
      description = REQUEST_NOTIF[
        docRequest?.requestStatus?.toUpperCase()
      ].description
        ?.replace("{requestId}", docRequest?.requestNo)
        ?.replace("{departmentName}", docRequest?.assignedDepartment?.name);

      if (
        docRequest?.requestStatus === DOCREQUEST_STATUS.CANCELLED ||
        docRequest?.requestStatus === DOCREQUEST_STATUS.CLOSED
      ) {
        const getAllUsers = await getAllUserByDepartment(
          docRequest?.steps?.map(x=>x.departmentId)
        );
        users = [...getAllUsers];
      } else {
        users = [docRequest?.fromUser];
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
  let { step } = req.body;
  if(isNaN(Number(step))) {
    return res
      .status(400)
      .json({ success: false, message: "Step should be a number" });
  }
  const { filename, mimeType, size, buffer } = req.file; // { filename, mimeType, size, buffer } | null

  let docRequest;
  try {
    // ensure the doc request exists
    docRequest = await getDocRequestById(docRequestId);
    if (!docRequest) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DOCREQUEST_NOT_FOUND });
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

    docRequest?.steps?.forEach(x=> {
      if(Number(x.step) === Number(step)) {
        x.attachmentFile = {
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
        };
        return;
      }
    });

    docRequest = await updateDocRequestWorkflowFile(
      docRequestId,
      docRequest?.steps
    );
    docRequest = await getDocRequestById(docRequestId);
    docRequest.purposeName = documentTypesobj[docRequest.purpose];
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: docRequest, message: UPDATE_WORKFLOW_SUCCESS });
}