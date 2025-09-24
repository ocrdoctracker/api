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
  updateDocRequest
} from "../services/doc-request.service.js";
import { generateIndentityCode } from "../utils/utils.js";
import { getUserById } from "../services/user.service.js";

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
  delete docRequest.password;
  delete docRequest.currentOtp;
  return res.json({ success: true, data: docRequest });
}

export async function create(req, res) {
  const { fromUserId, purpose, description } = req.body;
  let docRequest;
  try {
    const user = await getUserById(fromUserId);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_USER_NOT_FOUND });
    }
    const requestStatus = DOCREQUEST_STATUS.PENDING;
    docRequest = await createDocRequest(
      fromUserId,
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
    docRequest = await updateDocRequest(
      docRequestId,
      description
    );
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
  const { requestStatus, assignedUserId, reason } = req.body;

  let docRequest, assignedUser;

  try {
    if (requestStatus === DOCREQUEST_STATUS.APPROVED) {
      assignedUser = await getUserById(assignedUserId);
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
        return res
          .status(400)
          .json({
            success: false,
            message: `Document Request was already ${docRequest?.requestStatus
              .toString()
              .toLowerCase()}`,
          });
      }

      if (requestStatus === docRequest?.requestStatus) {
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
            success: false,
            message: "Document Request was not yet Porcessed",
          });
      }

      if (
        docRequest?.requestStatus === DOCREQUEST_STATUS.PROCESSING &&
        requestStatus === DOCREQUEST_STATUS.CLOSED
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Document Request was not yet Completed",
          });
      }
      docRequest = await updateDocRequestStatus(
        docRequestId,
        requestStatus,
        assignedUserId || 0,
        reason || ""
      );
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: docRequest, message: UPDATE_SUCCESS });
}
