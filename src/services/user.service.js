import pool from "../db/db.js";
import camelcaseKeys from "camelcase-keys";

export async function getUserById(userId) {
  const sql = `
    SELECT *
    FROM dbo."User"
    WHERE "UserId" = $1 AND "Active" = true
    LIMIT 1;
  `;
  const result = await pool.query(sql, [userId]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]);
}

export async function createUser(
  name,
  username,
  email,
  departmentId,
  passwordHash
) {
  const sql = `
    INSERT INTO dbo."User" ("Name", "Username", "Email", "Password", "DepartmentId")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING "UserId", "Name", "Username", "Email", "DepartmentId", "Active";
  `;

  // Note the order: passwordHash is $4, departmentId is $5
  const params = [
    name,
    username,
    email,
    passwordHash,
    departmentId.toUpperCase(),
  ];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]); // => { userId, name, username, email, departmentId, active }
}

export async function updateUser(userId, name, username, email) {
  const sql = `
    UPDATE dbo."User"
    SET
    "Name" = $2,
    "Username" = $3,
    "Email" = $4
    WHERE "UserId" = $1
    RETURNING *;
  `;
  const params = [userId, name, username, email];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function updateUserPassword(userId, passwordHash) {
  const sql = `
    UPDATE dbo."User"
    SET
    "Password" = $2
    WHERE "UserId" = $1
    RETURNING *;
  `;

  const params = [userId, passwordHash];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]);
}

export async function getAllUserByDepartment(departmentIds) { 
  const sql = `
    SELECT *
    FROM dbo."User"
    WHERE "DepartmentId" = ANY($1)
      AND "Active" = true;
  `;
  
  const result = await pool.query(sql, [departmentIds]);
  return camelcaseKeys(result.rows);
}

