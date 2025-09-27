import pool from '../db/db.js';
import camelcaseKeys from 'camelcase-keys';

export async function findActiveUserByEmail(email) {
  // Parameterized Postgres query
  const sql = `
    SELECT *
    FROM dbo."User"
    WHERE "Email" = $1 AND "Active" = true
    LIMIT 1;
  `;
  const result = await pool.query(sql, [email]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]);
}

export async function findActiveUserByUsername(username) {
  const sql = `
    SELECT 
      u."UserId",
      u."Name",
      u."Username",
      u."Email",
      u."Password",
      u."DepartmentId",
      u."Active",
      json_build_object(
        'departmentId', d."DepartmentId",
        'name', d."Name",
        'active', d."Active"
      ) AS department
    FROM dbo."User" u
    LEFT JOIN dbo."Department" d ON u."DepartmentId" = d."DepartmentId"
    WHERE u."Username" = $1 
      AND u."Active" = true
    LIMIT 1;
  `;

  const result = await pool.query(sql, [username]);
  if (result.rows.length === 0) return null;

  return camelcaseKeys(result.rows[0], { deep: true });
}
