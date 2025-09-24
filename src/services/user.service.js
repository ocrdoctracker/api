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
  role,
  passwordHash
) {
  const sql = `
    WITH ins_user AS (
      INSERT INTO dbo."User" ("Name", "Username", "Email", "Password")
      VALUES ($1, $2, $3, $4)
      RETURNING "UserId", "Name", "Username", "Email", "Active"
    ),
    ins_access AS (
      INSERT INTO dbo."UserAccess" ("UserId", "Role")
      SELECT "UserId", $5 FROM ins_user
      RETURNING "UserId", "Role"
    )
    SELECT 
      u."UserId",
      u."Name",
      u."Username",
      u."Email",
      a."Role",
      u."Active"
    FROM ins_user u
    JOIN ins_access a USING ("UserId");
  `;

  // Note the order: passwordHash is $4, role is $5
  const params = [name, username, email, passwordHash, role.toUpperCase()];

  const result = await pool.query(sql, params);
  return camelcaseKeys(result.rows[0]); // => { userId, name, username, email, role, active }
}
