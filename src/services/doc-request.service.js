import pool from "../db/db.js";
import camelcaseKeys from "camelcase-keys";

export async function getDocRequestById(docRequestId) {
  const sql = `
    SELECT 
    dc."DocRequestId", 
    dc."FromUserId", 
    dc."Purpose", 
    dc."DateRequested", 
    dc."DateProcessStarted", 
    dc."DateProcessEnd", 
    dc."DateCompleted", 
    dc."DateClosed", 
    dc."DateLastUpdated", 
    dc."RequestStatus", 
    dc."Description", 
    dc."RejectReason", 
    dc."CancelReason", 
    dc."RequestNo", 
    dc."DocumentFile", 
    dc."Classification",
    dc."Steps",
      json_build_object(
        'userId', fu."UserId",
        'name', fu."Name",
        'username', fu."Username",
        'email', fu."Email",
        'department', json_build_object(
                        'departmentId', fud."DepartmentId",
                        'name', fud."Name",
                        'active', fud."Active"
                      ),
        'active', fu."Active"
      ) AS "fromUser",
      json_build_object(
        'departmentId', d."DepartmentId",
        'name', d."Name",
        'active', d."Active"
      ) AS "assignedDepartment",
           COUNT(dc.*) OVER() AS total_rows
    FROM dbo."DocRequest" dc
    LEFT JOIN dbo."User" fu ON dc."FromUserId" = fu."UserId"
    LEFT JOIN dbo."Department" fud ON fu."DepartmentId" = fud."DepartmentId"
    LEFT JOIN dbo."Department" d ON dc."AssignedDepartmentId" = d."DepartmentId"
    LEFT JOIN dbo."User" u ON d."DepartmentId" = u."DepartmentId"
    WHERE dc."DocRequestId" = $1;
  `;
  const result = await pool.query(sql, [docRequestId]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]);
}

export async function getDocRequestAssignedToUser(
  fromUserId,
  requestStatus,
  pageSize = 10,
  pageIndex = 0
) {
  const size = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const index = Number(pageIndex) >= 0 ? Number(pageIndex) : 0;
  const offset = index * size;

  const sql = `
    SELECT 
    dc."DocRequestId", 
    dc."FromUserId", 
    dc."Purpose", 
    dc."DateRequested", 
    dc."DateProcessStarted", 
    dc."DateProcessEnd", 
    dc."DateCompleted", 
    dc."DateClosed", 
    dc."DateLastUpdated", 
    dc."RequestStatus", 
    dc."Description", 
    dc."RejectReason", 
    dc."CancelReason", 
    dc."RequestNo", 
    dc."DocumentFile", 
    dc."Classification",
    dc."Steps",
      json_build_object(
        'userId', fu."UserId",
        'name', fu."Name",
        'username', fu."Username",
        'email', fu."Email",
        'department', json_build_object(
                        'departmentId', fud."DepartmentId",
                        'name', fud."Name",
                        'active', fud."Active"
                      ),
        'active', fu."Active"
      ) AS "fromUser",
      json_build_object(
        'departmentId', d."DepartmentId",
        'name', d."Name",
        'active', d."Active"
      ) AS "assignedDepartment",
           COUNT(dc.*) OVER() AS total_rows
    FROM dbo."DocRequest" dc
    LEFT JOIN dbo."User" fu ON dc."FromUserId" = fu."UserId"
    LEFT JOIN dbo."Department" fud ON fu."DepartmentId" = fud."DepartmentId"
    LEFT JOIN dbo."Department" d ON dc."AssignedDepartmentId" = d."DepartmentId"
    LEFT JOIN dbo."User" u ON d."DepartmentId" = u."DepartmentId"
    WHERE u."UserId" = $1 AND ($2::text[] IS NULL OR dc."RequestStatus" = ANY($2)) AND dc."Active" = true
    ORDER BY dc."DateRequested" DESC
    LIMIT $3 OFFSET $4;
  `;

  const result = await pool.query(sql, [
    fromUserId,
    requestStatus,
    size,
    offset,
  ]);

  const totalRows =
    result.rows.length > 0 ? Number(result.rows[0].total_rows) : 0;

  return {
    total: Math.ceil(totalRows / size),
    results: camelcaseKeys(
      result.rows.map((r) => {
        const { total_rows, ...rest } = r;
        return rest;
      })
    ),
  };
}

export async function getDocRequestFromUser(
  fromUserId,
  requestStatus,
  pageSize = 10,
  pageIndex = 0
) {
  const size = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const index = Number(pageIndex) >= 0 ? Number(pageIndex) : 0;
  const offset = index * size;

  const sql = `
    
  SELECT *
FROM (
  SELECT DISTINCT ON (dc."DocRequestId")
    dc."DocRequestId",
    dc."FromUserId",
    dc."Purpose",
    dc."DateRequested",
    dc."DateProcessStarted",
    dc."DateProcessEnd",
    dc."DateCompleted",
    dc."DateClosed",
    dc."DateLastUpdated",
    dc."RequestStatus",
    dc."Description",
    dc."RejectReason",
    dc."CancelReason",
    dc."RequestNo",
    dc."DocumentFile",
    dc."Classification",
    dc."Steps",
    json_build_object(
      'userId', fu."UserId",
      'name', fu."Name",
      'username', fu."Username",
      'email', fu."Email",
      'department', json_build_object(
        'departmentId', fud."DepartmentId",
        'name', fud."Name",
        'active', fud."Active"
      ),
      'active', fu."Active"
    ) AS "fromUser",
    json_build_object(
      'departmentId', d."DepartmentId",
      'name', d."Name",
      'active', d."Active"
    ) AS "assignedDepartment",
    COUNT(*) OVER() AS total_rows
  FROM dbo."DocRequest" dc
  LEFT JOIN dbo."User" fu ON dc."FromUserId" = fu."UserId"
  LEFT JOIN dbo."Department" fud ON fu."DepartmentId" = fud."DepartmentId"
  LEFT JOIN dbo."Department" d ON dc."AssignedDepartmentId" = d."DepartmentId"
  LEFT JOIN dbo."User" u ON d."DepartmentId" = u."DepartmentId"
  WHERE dc."FromUserId" = $1 AND dc."Active" = true
    AND ($2::text[] IS NULL OR dc."RequestStatus" = ANY($2))
  ORDER BY dc."DocRequestId", u."UserId"  -- choose which row to keep
) t
ORDER BY "DateRequested" DESC
LIMIT $3 OFFSET $4;
  `;

  const result = await pool.query(sql, [
    fromUserId,
    requestStatus,
    size,
    offset,
  ]);

  const totalRows =
    result.rows.length > 0 ? Number(result.rows[0].total_rows) : 0;

  return {
    total: Math.ceil(totalRows / size),
    results: camelcaseKeys(
      result.rows.map((r) => {
        const { total_rows, ...rest } = r;
        return rest;
      })
    ),
  };
}

export async function createDocRequest(
  fromUserId,
  assignedDepartmentId,
  purpose,
  requestStatus,
  description,
  steps 
) {
  const sql = `
    INSERT INTO dbo."DocRequest"(
    "FromUserId", "AssignedDepartmentId", "Purpose", "DateRequested", "RequestStatus", "Description", "Steps")
	VALUES ($1, $2, $3, NOW(), $4, $5, $6)
    RETURNING *;
  `;
  const params = [
    fromUserId,
    assignedDepartmentId,
    purpose,
    requestStatus,
    description,
    JSON.stringify(steps),
  ];
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateDocRequest(
  docRequestId,
  description,
  documentFile = {}
) {
  const sql = `
    UPDATE dbo."DocRequest" set 
    "Description" = $2,
    "DocumentFile" = $3::jsonb, 
    "DateLastUpdated" = NOW()
    WHERE "DocRequestId" = $1
    RETURNING *;
  `;
  const params = [docRequestId, description, documentFile];
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateDocRequestStatus(
  docRequestId,
  requestStatus, // send strings like "APPROVED"
  reason
) {
  const sql = `
    UPDATE dbo."DocRequest" d
    SET
      -- Make $2 consistently TEXT; Postgres will cast text -> enum for the column
      "RequestStatus" = $2::text,

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
        WHEN $2::text = 'REJECTED' THEN $3
        WHEN $2::text IN ('APPROVED','PROCESSING','COMPLETED','CLOSED','CANCELLED') THEN NULL
        ELSE d."RejectReason"
      END,

      "CancelReason" = CASE
        WHEN $2::text = 'CANCELLED' THEN $3
        WHEN $2::text IN ('APPROVED','PROCESSING','COMPLETED','CLOSED','REJECTED') THEN NULL
        ELSE d."CancelReason"
      END,

      "DateLastUpdated" = NOW()
    WHERE d."DocRequestId" = $1
    RETURNING
      d."DocRequestId", d."FromUserId", d."Purpose", d."DateRequested",
      d."AssignedDepartmentId", d."DateProcessStarted", d."DateProcessEnd",
      d."DateCompleted", d."DateClosed", d."DateLastUpdated", d."RequestStatus",
      d."Description", d."RequestNo", d."RejectReason", d."CancelReason";
  `;
  const params = [docRequestId, requestStatus, reason];
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateDocRequestFile(
  docRequestId,
  documentFile,
  classification
) {
  const sql = `
  UPDATE dbo."DocRequest"
  SET 
  "DocumentFile" = COALESCE("DocumentFile", '{}'::jsonb) || $2::jsonb, 
  "Classification" = COALESCE("Classification", '{}'::jsonb) || $3::jsonb,
  "DateLastUpdated" = NOW()
  WHERE "DocRequestId" = $1
  RETURNING *;
`;
  const params = [docRequestId, documentFile, classification];
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function deleteDocRequest(docRequestId,) {
  const sql = `
  UPDATE dbo."DocRequest" SET "Active" = false WHERE "DocRequestId" = $1;
`;
  const params = [docRequestId];
  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}
