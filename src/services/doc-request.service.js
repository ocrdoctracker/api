import pool from "../db/db.js";
import camelcaseKeys from "camelcase-keys";

export async function getDocRequestById(docRequestId) {
  const sql = `
    SELECT *
    FROM dbo."DocRequest"
    WHERE "DocRequestId" = $1
    LIMIT 1;
  `;
  const result = await pool.query(sql, [docRequestId]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]);
}

export async function createDocRequest(
  fromUserId,
  purpose,
  requestStatus,
  description
) {
  const sql = `
    INSERT INTO dbo."DocRequest"(
    "FromUserId", "Purpose", "DateRequested", "RequestStatus", "Description")
	VALUES ($1, $2, NOW(), $3, $4)
    RETURNING "DocRequestId", "FromUserId", "Purpose", "DateRequested", "AssignedUserId", "DateAssigned", "DateProcessStarted", "DateProcessEnd", "DateCompleted", "DateClosed", "DateLastUpdated", "RequestStatus", "Description", "RequestNo", "RejectReason", "CancelReason";
  `;
  const params = [fromUserId, purpose, requestStatus, description]; // Default OTP for now
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateDocRequest(
  docRequestId,
  description
) {
  const sql = `
    UPDATE dbo."DocRequest" set 
    "Description" = $2
    WHERE "DocRequestId" = $1
    RETURNING "DocRequestId", "FromUserId", "Purpose", "DateRequested", "AssignedUserId", "DateAssigned", "DateProcessStarted", "DateProcessEnd", "DateCompleted", "DateClosed", "DateLastUpdated", "RequestStatus", "Description", "RequestNo", "RejectReason", "CancelReason";
  `;
  const params = [docRequestId, description]; // Default OTP for now
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateDocRequestStatus(
  docRequestId,
  requestStatus,          // send strings like "APPROVED"
  assignedUserId,  // can be string "1", we cast to int in SQL
  reason
) {
  const sql = `
    UPDATE dbo."DocRequest" d
    SET
      -- Make $2 consistently TEXT; Postgres will cast text -> enum for the column
      "RequestStatus" = $2::text,

      "AssignedUserId" = CASE
        WHEN $2::text = 'APPROVED' THEN $3::int
        ELSE d."AssignedUserId"
      END,
      "DateAssigned" = CASE
        WHEN $2::text = 'APPROVED' THEN NOW()
        ELSE d."DateAssigned"
      END,

      "DateProcessStarted" = CASE
        WHEN $2::text = 'PROCESSING' THEN NOW()
        ELSE d."DateProcessStarted"
      END,

      "DateProcessEnd" = CASE
        WHEN $2::text = 'COMPLETED' THEN NOW()
        ELSE d."DateProcessEnd"
      END,
      "DateCompleted" = CASE
        WHEN $2::text = 'COMPLETED' THEN NOW()
        ELSE d."DateCompleted"
      END,

      "DateClosed" = CASE
        WHEN $2::text IN ('CLOSED','REJECTED','CANCELLED') THEN NOW()
        ELSE d."DateClosed"
      END,

      "RejectReason" = CASE
        WHEN $2::text = 'REJECTED' THEN $4
        WHEN $2::text IN ('APPROVED','PROCESSING','COMPLETED','CLOSED','CANCELLED') THEN NULL
        ELSE d."RejectReason"
      END,

      "CancelReason" = CASE
        WHEN $2::text = 'CANCELLED' THEN $4
        WHEN $2::text IN ('APPROVED','PROCESSING','COMPLETED','CLOSED','REJECTED') THEN NULL
        ELSE d."CancelReason"
      END,

      "DateLastUpdated" = NOW()
    WHERE d."DocRequestId" = $1
    RETURNING
      d."DocRequestId", d."FromUserId", d."Purpose", d."DateRequested",
      d."AssignedUserId", d."DateAssigned", d."DateProcessStarted", d."DateProcessEnd",
      d."DateCompleted", d."DateClosed", d."DateLastUpdated", d."RequestStatus",
      d."Description", d."RequestNo", d."RejectReason", d."CancelReason";
  `;
  const params = [docRequestId, requestStatus, assignedUserId, reason];
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

