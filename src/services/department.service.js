import pool from "../db/db.js";
import camelcaseKeys from "camelcase-keys";

export async function getDepartmentById(departmentId) {
  const sql = `
    SELECT *
    FROM dbo."Department"
    WHERE "DepartmentId" = $1 AND "Active" = true
    LIMIT 1;
  `;
  const result = await pool.query(sql, [departmentId]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]);
}

export async function createDepartment(
  name
) {
  const sql = `
    INSERT INTO dbo."Department" ("Name")
      VALUES ($1)
      RETURNING "DepartmentId", "Name", "Active";
  `;

  // Note the order: passwordHash is $4, departmentId is $5
  const params = [name];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateDepartment(
  departmentId,
  name
) {
  const sql = `
    UPDATE dbo."Department" SET "Name" = $2 WHERE "DepartmentId" = $1
    RETURNING "DepartmentId", "Name", "Active";
  `;

  // Note the order: passwordHash is $4, departmentId is $5
  const params = [departmentId, name];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function removeDepartment(departmentId) {
  const sql = `
    UPDATE dbo."Department" SET "Active" = false WHERE "DepartmentId" = $1
    RETURNING "DepartmentId", "Name", "Active";
  `;

  // Note the order: passwordHash is $4, departmentId is $5
  const params = [departmentId];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]); 
}
