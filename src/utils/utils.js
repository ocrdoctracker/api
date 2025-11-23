import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { randomInt } from "crypto";
import Busboy from "busboy";
import { createRequire } from "node:module";
import mammoth from "mammoth";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import path from "node:path";

export async function extractTextFromBuffer(filename, buf) {
  const lower = String(filename || "").toLowerCase();

  if (lower.endsWith(".pdf")) {
    const { text } = await pdfParse(buf);
    return cleanup(text || "");
  }
  if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return cleanup(value || "");
  }
  if (lower.endsWith(".txt")) {
    return cleanup(buf.toString("utf8"));
  }
  throw new Error("Unsupported file type. Use PDF, DOCX, or TXT.");
}
function cleanup(s) {
  return String(s)
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(env.bcryptRounds);
  return bcrypt.hash(plain, salt);
}

export function compare(storedHash, plain) {
  return bcrypt.compare(plain, storedHash);
}

// Generate a 6-digit OTP with low probability of repeating
export const generateOTP = () => {
  let otp;
  const uniqueOTPs = new Set();

  // Ensure the OTP is not a duplicate with 1 in 1000 odds
  do {
    otp = randomInt(100000, 1000000).toString(); // Generate a 6-digit OTP
  } while (uniqueOTPs.has(otp));

  // Store the OTP to track uniqueness within the 1000 scope
  uniqueOTPs.add(otp);

  // If we exceed 1000 unique OTPs, clear the set to maintain the odds
  if (uniqueOTPs.size > 1000) {
    uniqueOTPs.clear();
  }

  return otp;
};

export const generateIndentityCode = (id) => {
  return String(id).padStart(6, "0");
};

export const readSingleFileFromMultipart = (
  req,
  { maxBytes = 10 * 1024 * 1024 } = {}
) => {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: maxBytes },
    });

    const chunks = []; // array of Buffer
    let filename = "upload.bin";
    let mimeType = "application/octet-stream";
    let total = 0;
    const fields = {}; // plain object for form fields

    bb.on("file", (_name, file, info) => {
      filename = info?.filename || filename;
      mimeType = info?.mimeType || info?.mime || mimeType;

      file.on("data", (d) => {
        total += d.length;
        chunks.push(d);
      });

      file.on("limit", () => {
        reject(new Error("File too large"));
      });
    });

    // collect regular form fields
    bb.on("field", (name, value) => {
      // last value wins if duplicate field names
      fields[name] = value;
    });

    bb.on("finish", () => {
      const buffer = total ? Buffer.concat(chunks) : null;

      // We NO LONGER reject when no file is received.
      // Caller checks `size` if they want to enforce a file.
      resolve({
        filename: total ? filename : null,
        mimeType: total ? mimeType : null,
        size: total,
        buffer,
        fields,
      });
    });

    bb.on("error", reject);
    req.pipe(bb);
  });
};

export const sanitizePublicId = (originalName = "") => {
  const base = path.parse(originalName).name; // drop extension
  return base.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 120);
};

export const getExtension = (originalName = "") => {
  return path.parse(originalName).ext; // drop extension
};
