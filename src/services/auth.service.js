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
  // Parameterized Postgres query
  const sql = `
    SELECT *
    FROM dbo."User"
    WHERE "Username" = $1 AND "Active" = true
    LIMIT 1;
  `;
  const result = await pool.query(sql, [username]);
  if (result.rows.length === 0) return null;
  return camelcaseKeys(result.rows[0]);
}