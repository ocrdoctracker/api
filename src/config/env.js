import dotenv from "dotenv";
import path from "node:path";

// IMPORTANT: this file is ESM; emulate __dirname for ESM
const __dirname = path.dirname(new URL(import.meta.url).pathname);

dotenv.config();

// tiny helpers
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v, d) => {
  if (v === "1" || (typeof v === "string" && v.toLowerCase() === "true")) return true;
  if (v === "0" || (typeof v === "string" && v.toLowerCase() === "false")) return false;
  return d;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: num(process.env.PORT, 3000),
  httpsPort: num(process.env.HTTPS_PORT, 3443),
  sslKey: process.env.SSL_KEY,
  sslCert: process.env.SSL_CERT,
  db: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    name: process.env.DB_NAME,
    pass: process.env.DB_PASSWORD,
    port: num(process.env.DB_PORT, 5432),
    ssl: process.env.DB_SSL === "true" || false,
  },
  bcryptRounds: num(process.env.BCRYPT_SALT_ROUNDS, 10),
  ev: {
    evEmail: process.env.EV_EMAIL,
    evPass: process.env.EV_PASS,
    evAddress: process.env.EV_ADDRESS,
    evResetSubject: process.env.EV_RESET_SUBJECT,
    evCompany: process.env.EV_COMPANY,
    evUrl: process.env.EV_URL,
    evTemplate: process.env.EV_TEMPLATE,
    evResetTemplate: process.env.EV_RESET_TEMPLATE,
  },
  cnn: {
    dataSetPath:
      process.env.CNN_DATASET_PATH || path.join(__dirname, "..", "..", "dataset.csv"),
    modelPath: process.env.CNN_MODEL_PATH,
    temperature: num(process.env.CNN_TEMPERATURE, 1.0),
    otherLabel: process.env.CNN_OTHER_LABEL || "Other",
    minTokens: num(process.env.CNN_MIN_TOKENS, 2),
    threshold: Number(process.env.CNN_THRESHOLD || 0.6),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // ⬇️ NEW: minimal stamp config (only the envs you asked to keep)
  stamp: {
    // Robust matching augmentations for stamps
    ROBUST_STAMP_AUGS: bool(process.env.ROBUST_STAMP_AUGS, true),
    AUG_BLUR_SIGMA: num(process.env.AUG_BLUR_SIGMA, 0.8),
    AUG_JPEG_Q: num(process.env.AUG_JPEG_Q, 60),
    AUG_GRAYSCALE: bool(process.env.AUG_GRAYSCALE, true),

    // Near-threshold band logic
    THRESHOLD_HI: num(process.env.THRESHOLD_HI, 0.88),
    THRESHOLD_LO: num(process.env.THRESHOLD_LO, 0.80),
    MARGIN_MIN: num(process.env.MARGIN_MIN, 0.07),
    MARGIN_LO: num(process.env.MARGIN_LO, 0.05),
    NCC_BAND: num(process.env.NCC_BAND, 0.10),
    SSIM_BAND: num(process.env.SSIM_BAND, 0.25),

    // Time budget
    TIME_BUDGET_MS: num(process.env.TIME_BUDGET_MS, 8000),

    // PDF parity
    PDF_RENDER_ALWAYS: bool(process.env.PDF_RENDER_ALWAYS, true),
    PDF_RENDER_DPI: num(process.env.PDF_RENDER_DPI, 144),

    // Hard-coded sensible defaults (no env)
    MAX_PAGES: 12,
    MAX_STAMPS: 64,
    PRELOC_THRESHOLD: 0.80,
    COARSE_TOPK_SSIM: 6,

    LOC_DS_WIDTH: 900,
    LOC_BASE: 160,
    LOC_SCALES: [0.6, 0.8, 1.0, 1.25],
    LOC_STRIDE: 28,
    LOC_MAX_PATCHES: 360,
    LOC_TOPK: 6,

    PDF_RENDER_TOP_PAGES: 3,
  },
};
