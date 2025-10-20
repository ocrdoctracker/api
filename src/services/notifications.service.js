import pool from "../db/db.js";
import camelcaseKeys from "camelcase-keys";

export async function getNotificationsByUser(
  userId,
  pageSize = 10,
  pageIndex = 0
) {
  const size = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const index = Number(pageIndex) >= 0 ? Number(pageIndex) : 0;
  const offset = index * size;

  const sql = `
    SELECT *,
    COUNT(*) OVER() AS total_rows
    FROM dbo."Notifications"
    WHERE "UserId" = $1
    ORDER BY "Date" DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await pool.query(sql, [userId, size, offset]);

  const totalRows =
    result.rows.length > 0 ? Number(result.rows[0].total_rows) : 0;
  return {
    total: totalRows,
    results: camelcaseKeys(
      result.rows.map((r) => {
        const { total_rows, ...rest } = r;
        return rest;
      })
    ),
  };
}

export async function getTotalUnreadNotifByUser(
  userId,
) {
  const sql = `
    SELECT COUNT(*)
    FROM dbo."Notifications"
    WHERE "UserId" = $1 AND "IsRead" = false;
  `;
  const result = await pool.query(sql, [userId]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]?.count);
}

export async function createNotification(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    throw new Error('Notifications array is empty or invalid');
  }

  // Columns to insert (no Date, since it has default value in DB)
  const columns = ['userId', 'title', 'description', 'type', 'referenceId'];

  // Dynamically build placeholders for each row
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const notif of notifications) {
    const row = [];
    for (const col of columns) {
      row.push(`$${paramIndex++}`);
      params.push(notif[col]); // map JS object keys (camelCase)
    }
    values.push(`(${row.join(',')})`);
  }

  const sql = `
    INSERT INTO dbo."Notifications" 
      ("UserId", "Title", "Description", "Type", "ReferenceId")
    VALUES ${values.join(', ')}
    RETURNING *;
  `;

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows);
}

export async function markNotificationRead(notificationId) {
  const sql = `
    UPDATE dbo."Notifications" SET "IsRead" = true WHERE "NotificationId" = $1
    RETURNING *;
  `;

  // Note the order: passwordHash is $4, departmentId is $5
  const params = [notificationId];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}
