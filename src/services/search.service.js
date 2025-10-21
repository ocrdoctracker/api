import pool from "../db/db.js";
import camelcaseKeys from "camelcase-keys";

export async function searchDocRequest(keyword, userId) {
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
      ) AS "assignedDepartment"
    FROM dbo."DocRequest" dc
    LEFT JOIN dbo."User" fu ON dc."FromUserId" = fu."UserId"
    LEFT JOIN dbo."Department" fud ON fu."DepartmentId" = fud."DepartmentId"
    LEFT JOIN dbo."Department" d ON dc."AssignedDepartmentId" = d."DepartmentId"
    WHERE
      -- keyword filter (handles bigint via ::text)
      (
        COALESCE($1, '') = '' OR
        dc."Purpose" ILIKE '%' || $1 || '%' OR
        LOWER(dc."DocRequestId"::text) ILIKE '%' || $1 || '%' OR
        LOWER(dc."RequestNo") ILIKE '%' || $1 || '%' OR
        LOWER(fud."Name") ILIKE '%' || $1 || '%' OR
        LOWER(d."Name") ILIKE '%' || $1 || '%'
      )
      AND dc."Active" = TRUE
      AND (
        dc."FromUserId" = $2
        OR EXISTS (
          SELECT 1
          FROM dbo."User" u2
          WHERE u2."UserId" = $2
            AND u2."DepartmentId" = dc."AssignedDepartmentId"
        )
      )
    ORDER BY dc."DateLastUpdated" DESC;
  `;

  const result = await pool.query(sql, [keyword?.trim()?.toLowerCase() ?? '', userId]);

  return camelcaseKeys(result.rows);
}


export async function searchDocRequestAttachment(keyword, userId) {
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
      ) AS "assignedDepartment"
    FROM dbo."DocRequest" dc
    LEFT JOIN dbo."User" fu ON dc."FromUserId" = fu."UserId"
    LEFT JOIN dbo."Department" fud ON fu."DepartmentId" = fud."DepartmentId"
    LEFT JOIN dbo."Department" d ON dc."AssignedDepartmentId" = d."DepartmentId"
    WHERE
      -- keyword filter (handles bigint via ::text)
      (
        COALESCE($1, '') = '' OR
        LOWER(dc."DocumentFile"->>'filename') ILIKE '%' || $1 || '%' OR
        LOWER(dc."DocumentFile"->>'mimeType') ILIKE '%' || $1 || '%' OR
        LOWER(dc."DocumentFile"->>'publicId') ILIKE '%' || $1 || '%' OR
        LOWER(dc."DocumentFile"->>'displayName') ILIKE '%' || $1 || '%'
      )
      AND dc."Active" = TRUE
      AND (
        dc."FromUserId" = $2
        OR EXISTS (
          SELECT 1
          FROM dbo."User" u2
          WHERE u2."UserId" = $2
            AND u2."DepartmentId" = dc."AssignedDepartmentId"
        )
      )
    ORDER BY (dc."DocumentFile"->>'createdAt')::timestamptz DESC NULLS LAST;
  `;

  const result = await pool.query(sql, [keyword?.trim()?.toLowerCase() ?? '', userId]);

  return camelcaseKeys(result.rows);
}