// src/services/stamp.service.js
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import AdmZip from "adm-zip";
import { createCanvas } from "@napi-rs/canvas";
import { env } from "../config/env.js";

/** ---------- Sharp setup ---------- */
try {
  if (typeof sharp.cache === "function") sharp.cache(true);
  if (typeof sharp.concurrency === "function") {
    const cores = Number(os.cpus()?.length || 1);
    sharp.concurrency(Math.max(1, Math.min(8, cores)));
  }
} catch {}

/** ---------- Time budget ---------- */
const nowMs = () => Number(process.hrtime.bigint() / 1000000n);
function makeBudget() {
  const deadline = nowMs() + (env.stamp.TIME_BUDGET_MS || 8000);
  return {
    over() {
      return nowMs() >= deadline;
    },
    ensure(msg = "Time budget exceeded") {
      if (this.over()) throw new Error(msg);
    },
    remain() {
      return Math.max(0, deadline - nowMs());
    },
  };
}

/** ---------- Helpers ---------- */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function isPDF(buf) {
  return (
    buf &&
    buf.length > 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  );
}
function isDOCX(buf) {
  if (!(buf && buf[0] === 0x50 && buf[1] === 0x4b)) return false;
  try {
    return !!new AdmZip(buf).getEntry("[Content_Types].xml");
  } catch {
    return false;
  }
}

/** ---------- Normalization ---------- */
async function normalizeImage(buffer) {
  return sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/** ---------- dHash (64-bit) ---------- */
async function dhash64(buffer) {
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bytes = new Uint8Array(8);
  for (let r = 0; r < 8; r++) {
    let b = 0;
    for (let c = 0; c < 8; c++) {
      const L = data[r * 9 + c],
        R = data[r * 9 + c + 1];
      b = (b << 1) | (L > R ? 1 : 0);
    }
    bytes[r] = b;
  }
  return bytes;
}
function hammingSim(a, b) {
  let same = 0;
  for (let i = 0; i < 8; i++) {
    const x = a[i] ^ b[i];
    let v = x - ((x >>> 1) & 0x55);
    v = (v & 0x33) + ((v >>> 2) & 0x33);
    const diff = (((v + (v >>> 4)) & 0x0f) * 0x01) & 0xff;
    same += 8 - diff;
  }
  return same / 64;
}

/** ---------- Edge + Cosine ---------- */
async function edgeDesc(buffer, size = 128) {
  const { data, info } = await sharp(buffer)
    .resize(size, size, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width,
    h = info.height;
  const kx = { width: 3, height: 3, kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1] };
  const ky = { width: 3, height: 3, kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1] };
  const gx = await sharp(data, { raw: { width: w, height: h, channels: 1 } })
    .convolve(kx)
    .raw()
    .toBuffer();
  const gy = await sharp(data, { raw: { width: w, height: h, channels: 1 } })
    .convolve(ky)
    .raw()
    .toBuffer();
  const desc = new Float32Array(w * h);
  let sumsq = 0;
  for (let i = 0; i < desc.length; i++) {
    const mag = Math.hypot(gx[i] - 128, gy[i] - 128);
    desc[i] = mag;
    sumsq += mag * mag;
  }
  const norm = Math.sqrt(sumsq) + 1e-8;
  for (let i = 0; i < desc.length; i++) desc[i] /= norm;
  return desc;
}
function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ai = a[i],
      bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

/** ---------- HSV histogram ---------- */
async function hsvHist(buf, binsH = 16, binsS = 8) {
  const { data } = await sharp(buf)
    .resize(128, 128, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hist = new Float32Array(binsH * binsS);
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    const s = max === 0 ? 0 : d / max;
    const hi = Math.min(binsH - 1, Math.floor(h * binsH));
    const si = Math.min(binsS - 1, Math.floor(s * binsS));
    hist[hi * binsS + si] += 1;
  }
  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += hist[i];
  for (let i = 0; i < hist.length; i++) hist[i] = hist[i] / (sum + 1e-8);
  return hist;
}
const bhattacharyya = (p, q) =>
  p.reduce((s, v, i) => s + Math.sqrt((v || 0) * (q[i] || 0)), 0);

/** ---------- SSIM (global) ---------- */
async function ssim(bufferA, bufferB) {
  const A = await sharp(bufferA)
    .resize(128, 128, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer();
  const B = await sharp(bufferB)
    .resize(128, 128, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer();
  const N = A.length;
  let meanA = 0,
    meanB = 0;
  for (let i = 0; i < N; i++) {
    meanA += A[i];
    meanB += B[i];
  }
  meanA /= N;
  meanB /= N;
  let varA = 0,
    varB = 0,
    cov = 0;
  for (let i = 0; i < N; i++) {
    const da = A[i] - meanA,
      db = B[i] - meanB;
    varA += da * da;
    varB += db * db;
    cov += da * db;
  }
  varA /= N - 1;
  varB /= N - 1;
  cov /= N - 1;
  const L = 255,
    k1 = 0.01,
    k2 = 0.03,
    C1 = (k1 * L) ** 2,
    C2 = (k2 * L) ** 2;
  return clamp01(
    ((2 * meanA * meanB + C1) * (2 * cov + C2)) /
      ((meanA ** 2 + meanB ** 2 + C1) * (varA + varB + C2) + 1e-8)
  );
}

/** ---------- Coarse scoring ---------- */
function fusedQuick(edgeSim, colorSim, hashSim) {
  return 0.42 * edgeSim + 0.38 * colorSim + 0.2 * hashSim;
}
async function coarseQuick(pageFeatures, edgeRef, histRef, hashRef) {
  const { edgePatch, histPatch, hashPatch } = pageFeatures;
  const hashSim = hammingSim(hashRef, hashPatch);
  const colorSim = bhattacharyya(histRef, histPatch);
  const edgeSim = cosine(edgeRef, edgePatch);
  const fused = fusedQuick(edgeSim, colorSim, hashSim);
  return { fused, edgeSim, colorSim, hashSim };
}
async function coarseWithSSIM(pageFeatures, bestQuick, stampBuf) {
  const ssimVal = await ssim(pageFeatures.pageThumb, stampBuf);
  const fused =
    0.35 * bestQuick.edgeSim +
    0.25 * bestQuick.colorSim +
    0.2 * bestQuick.hashSim +
    0.2 * ssimVal;
  return { fused, ssimVal, ...bestQuick };
}

/** ---------- Locator (bounded grid search) ---------- */
async function edgeOnlyLocator(imageBuf, stampEdgeRef, budget) {
  const {
    LOC_DS_WIDTH,
    LOC_BASE,
    LOC_SCALES,
    LOC_STRIDE,
    LOC_MAX_PATCHES,
    LOC_TOPK,
  } = env.stamp;

  const imgSharp = sharp(imageBuf);
  const meta = await imgSharp.metadata();
  const srcW = meta.width || 1600;
  const srcH = meta.height || 1600;

  const scaleDown = Math.min(1, LOC_DS_WIDTH / srcW);
  const dsW = Math.max(200, Math.round(srcW * scaleDown));
  const dsH = Math.round(srcH * scaleDown);

  const dsBuf = await imgSharp.resize({ width: dsW }).png().toBuffer();

  let evaluated = 0;
  const candidates = [];

  for (const s of LOC_SCALES) {
    budget.ensure("Locator budget exceeded");
    const w = Math.max(64, Math.round(LOC_BASE * s));
    const h = w;
    for (let y = 0; y + h <= dsH; y += LOC_STRIDE) {
      for (let x = 0; x + w <= dsW; x += LOC_STRIDE) {
        if (evaluated >= LOC_MAX_PATCHES) break;
        const patch = await sharp(dsBuf)
          .extract({ left: x, top: y, width: w, height: h })
          .png()
          .toBuffer();
        const ePatch = await edgeDesc(patch);
        const score = cosine(stampEdgeRef, ePatch);
        candidates.push({ score, x, y, w, h });
        evaluated++;
        if (budget.over()) break;
      }
      if (evaluated >= LOC_MAX_PATCHES || budget.over()) break;
    }
    if (evaluated >= LOC_MAX_PATCHES || budget.over()) break;
  }

  if (!candidates.length) return { bbox: null, locatorScore: 0 };

  candidates.sort((a, b) => b.score - a.score);
  const bestFew = candidates.slice(0, Math.max(1, LOC_TOPK));

  const inv = 1 / (scaleDown || 1);
  let best = { score: -1, bbox: null };

  for (const c of bestFew) {
    budget.ensure("Locator refine budget exceeded");
    let bx = Math.round(c.x * inv),
      by = Math.round(c.y * inv);
    let bw = Math.round(c.w * inv),
      bh = Math.round(c.h * inv);

    if (!Number.isFinite(bx)) bx = 0;
    if (!Number.isFinite(by)) by = 0;
    if (!Number.isFinite(bw) || bw <= 0) bw = 100;
    if (!Number.isFinite(bh) || bh <= 0) bh = 100;

    bx = Math.max(0, Math.min(bx, srcW - 1));
    by = Math.max(0, Math.min(by, srcH - 1));
    if (bx + bw > srcW) bw = Math.max(16, srcW - bx);
    if (by + bh > srcH) bh = Math.max(16, srcH - by);

    if (c.score > best.score)
      best = { score: c.score, bbox: { x: bx, y: by, w: bw, h: bh } };
  }

  return { bbox: best.bbox, locatorScore: best.score };
}

/** ---------- DOCX images ---------- */
function extractDocxImages(buf) {
  const z = new AdmZip(buf);
  const entries = z
    .getEntries()
    .filter((e) =>
      /^word\/media\/.+\.(png|jpe?g|webp|gif|bmp)$/i.test(e.entryName)
    );
  return entries.slice(0, env.stamp.MAX_PAGES).map((e) => e.getData());
}

/** ---------- PDF via pdfjs-dist ---------- */
async function loadPdfJs() {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    return await import("pdfjs-dist/build/pdf.mjs");
  }
}
function toPureUint8(bytesLike) {
  if (bytesLike instanceof Uint8Array && !Buffer.isBuffer(bytesLike))
    return bytesLike;
  const u8 = new Uint8Array(bytesLike.length);
  u8.set(bytesLike);
  return u8;
}
async function extractPdfImages(pdfBytes) {
  const pdfjsLib = await loadPdfJs();
  const pdfUint8 = toPureUint8(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({
    data: pdfUint8,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, env.stamp.MAX_PAGES);
  const images = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const ops = await page.getOperatorList();
    const { fnArray, argsArray } = ops;
    const imageIds = new Set();
    const inlineImages = [];

    for (let j = 0; j < fnArray.length; j++) {
      const fn = fnArray[j],
        args = argsArray[j];
      if (
        fn === pdfjsLib.OPS.paintImageXObject ||
        fn === pdfjsLib.OPS.paintImageXObjectRepeat
      ) {
        const imgId = args?.[0];
        if (typeof imgId === "string") imageIds.add(imgId);
      }
      if (fn === pdfjsLib.OPS.paintInlineImageXObject) {
        const inline = args?.[0];
        if (inline) inlineImages.push(inline);
      }
    }

    async function imageDataToPng(img) {
      const width = img.width,
        height = img.height;
      const channels =
        img.numComps === 4 || img.kind === pdfjsLib.ImageKind?.RGBA_32BPP
          ? 4
          : 3;
      const raw = Buffer.from(img.data);
      return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
    }

    for (const id of imageIds) {
      const cached = page.objs?.get(id);
      if (cached && cached.data && cached.width && cached.height) {
        try {
          images.push(await imageDataToPng(cached));
        } catch {}
      }
    }
    for (const inline of inlineImages) {
      const data = inline?.data || inline?.image?.data;
      const width = inline?.width || inline?.image?.width;
      const height = inline?.height || inline?.image?.height;
      if (data && width && height) {
        try {
          images.push(
            await sharp(Buffer.from(data), {
              raw: { width, height, channels: 3 },
            })
              .png()
              .toBuffer()
          );
        } catch {}
      }
    }
  }

  try {
    await pdf.destroy();
  } catch {}
  return images;
}
async function renderPdfPages(pdfBytes) {
  const pdfjsLib = await loadPdfJs();
  const pdfUint8 = toPureUint8(pdfBytes);
  const dpi = env.stamp.PDF_RENDER_DPI;
  const topPages = Math.max(1, env.stamp.PDF_RENDER_TOP_PAGES);
  const loadingTask = pdfjsLib.getDocument({
    data: pdfUint8,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;

  const count = Math.min(pdf.numPages, Math.min(env.stamp.MAX_PAGES, topPages));
  const out = [];

  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    const canvasFactory = {
      create: () => ({ canvas, context: ctx }),
      reset: () => {},
      destroy: () => {},
    };

    await page.render({
      canvasContext: ctx,
      viewport,
      canvasFactory,
      intent: "display",
      background: "rgba(255,255,255,1.0)",
    }).promise;

    const png = canvas.toBuffer("image/png");
    out.push(png);
  }

  try {
    await pdf.destroy();
  } catch {}
  return out;
}

/** ---------- Unify: buffer → image list ---------- */
async function normalizeToImages(buf, mime, budget) {
  if (isPDF(buf) || (mime || "").includes("pdf")) {
    const extracted = await extractPdfImages(buf);
    let imgs = await Promise.all(
      extracted.slice(0, env.stamp.MAX_PAGES).map(normalizeImage)
    );
    if (env.stamp.PDF_RENDER_ALWAYS || imgs.length === 0) {
      try {
        budget?.ensure();
        const renders = await renderPdfPages(buf);
        const norm = await Promise.all(
          renders.slice(0, env.stamp.MAX_PAGES).map(normalizeImage)
        );
        imgs = imgs.concat(norm);
      } catch {}
    }
    return imgs;
  }
  if (isDOCX(buf) || (mime || "").includes("word")) {
    const imgs = extractDocxImages(buf);
    return Promise.all(imgs.map(normalizeImage));
  }
  if ((mime || "").startsWith("image/")) {
    return [await normalizeImage(buf)];
  }
  throw new Error("Unsupported document type");
}

/** ---------- Image features ---------- */
async function precomputeImageFeatures(imgBuf) {
  const thumb = await sharp(imgBuf)
    .resize(256, 256, { fit: "inside" })
    .png()
    .toBuffer();
  const [hashPatch, histPatch, edgePatch] = await Promise.all([
    dhash64(imgBuf),
    hsvHist(imgBuf),
    edgeDesc(imgBuf),
  ]);
  return { pageThumb: thumb, hashPatch, histPatch, edgePatch };
}

/** ---------- Stamps cache (+robust variants) ---------- */
const stampDir = path.join(process.cwd(), "public", "stamps");
let stamps = []; // [{ name, buf, refs:[{edgeRef,histRef,hashRef}, ...] }]
let stampsLoaded = false;

async function buildRefsForBuffer(buf) {
  const [edgeRef, histRef, hashRef] = await Promise.all([
    edgeDesc(buf),
    hsvHist(buf),
    dhash64(buf),
  ]);
  return { edgeRef, histRef, hashRef };
}

export async function initStamps() {
  stamps = [];
  if (!fs.existsSync(stampDir)) {
    console.warn("[stamp-detector] ⚠️ No stamps directory:", stampDir);
    stampsLoaded = true;
    return;
  }
  const allFiles = fs
    .readdirSync(stampDir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const files = allFiles.slice(0, env.stamp.MAX_STAMPS);
  console.log("[stamp-detector] Loading", files.length, "stamp(s) ...");

  const ROBUST = env.stamp.ROBUST_STAMP_AUGS;
  const BLUR_SIGMA = env.stamp.AUG_BLUR_SIGMA;
  const JPEG_Q = env.stamp.AUG_JPEG_Q;
  const DO_GRAY = env.stamp.AUG_GRAYSCALE;

  for (const f of files) {
    const p = path.join(stampDir, f);
    const base = await normalizeImage(fs.readFileSync(p));
    const refs = [await buildRefsForBuffer(base)];

    if (ROBUST) {
      try {
        const blur = await sharp(base).blur(BLUR_SIGMA).png().toBuffer();
        refs.push(await buildRefsForBuffer(blur));
      } catch {}
      try {
        const jpegish = await sharp(base).jpeg({ quality: JPEG_Q }).toBuffer();
        const backToPng = await sharp(jpegish).png().toBuffer();
        refs.push(await buildRefsForBuffer(backToPng));
      } catch {}
      if (DO_GRAY) {
        try {
          const gray = await sharp(base)
            .greyscale()
            .linear(1.05, -5)
            .png()
            .toBuffer();
          refs.push(await buildRefsForBuffer(gray));
        } catch {}
      }
    }
    stamps.push({ name: f, buf: base, refs });
  }
  console.log("[stamp-detector] ✅ Loaded", stamps.length, "stamp(s).");
  stampsLoaded = true;
}

/** ---------- NCC on edges ---------- */
async function nccEdges(patchBuf, stampBuf) {
  const size = 128;
  const [eP, eS] = await Promise.all([
    edgeDesc(patchBuf, size),
    edgeDesc(stampBuf, size),
  ]);
  let meanP = 0,
    meanS = 0;
  for (let i = 0; i < eP.length; i++) {
    meanP += eP[i];
    meanS += eS[i];
  }
  meanP /= eP.length;
  meanS /= eS.length;
  let num = 0,
    denP = 0,
    denS = 0;
  for (let i = 0; i < eP.length; i++) {
    const p = eP[i] - meanP,
      s = eS[i] - meanS;
    num += p * s;
    denP += p * p;
    denS += s * s;
  }
  return clamp01(num / (Math.sqrt(denP * denS) + 1e-8));
}

/** ---------- Decision ---------- */
function fusedDecision({ top, second, refined }) {
  const {
    THRESHOLD_HI,
    THRESHOLD_LO,
    MARGIN_MIN,
    MARGIN_LO,
    NCC_BAND,
    SSIM_BAND,
  } = env.stamp;

  const margin = (top?.fused || 0) - (second?.fused || 0);
  if (top && top.fused >= THRESHOLD_HI && margin >= MARGIN_MIN) {
    return { match: true, reason: "strong-coarse", margin };
  }
  const bandOK = top && top.fused >= THRESHOLD_LO && margin >= MARGIN_LO;
  const refineStrong =
    refined?.bbox && (refined.ncc >= 0.68 || refined.ssim >= 0.62);
  const refineBand =
    refined?.bbox && (refined.ncc >= NCC_BAND || refined.ssim >= SSIM_BAND);
  if (bandOK && (refineStrong || refineBand)) {
    return { match: true, reason: "banded-with-refine", margin };
  }
  return { match: false, reason: "no-match", margin };
}

/** ---------- Core pipeline ---------- */
async function runDetectionOnImages(imgs, budget) {
  const { PRELOC_THRESHOLD, COARSE_TOPK_SSIM } = env.stamp;

  const feats = await Promise.all(imgs.map(precomputeImageFeatures));
  budget.ensure("Budget after feature precompute");

  // Stage 1: quick coarse across all stamps (best over refs)
  let quickCands = [];
  for (let pi = 0; pi < imgs.length; pi++) {
    for (const s of stamps) {
      budget.ensure("Budget during coarse quick");
      let bestQuick = null;
      for (const r of s.refs) {
        const q = await coarseQuick(feats[pi], r.edgeRef, r.histRef, r.hashRef);
        if (!bestQuick || q.fused > bestQuick.fused) bestQuick = q;
      }
      quickCands.push({ imgIdx: pi, stamp: s.name, bestQuick });
    }
  }
  quickCands.sort((a, b) => b.bestQuick.fused - a.bestQuick.fused);

  // Stage 2: add SSIM only for top-K
  const topFew = quickCands.slice(0, COARSE_TOPK_SSIM);
  const fullCands = [];
  for (const c of topFew) {
    budget.ensure("Budget during coarse full");
    const stampObj = stamps.find((x) => x.name === c.stamp);
    const r = await coarseWithSSIM(feats[c.imgIdx], c.bestQuick, stampObj.buf);
    fullCands.push({
      imgIdx: c.imgIdx,
      stamp: c.stamp,
      fused: r.fused,
      bestQuick: c.bestQuick,
    });
  }
  fullCands.sort((a, b) => b.fused - a.fused);
  const top = fullCands[0] || null;
  const second = fullCands[1] || { fused: 0 };

  // Refine: locator + NCC/SSIM
  // Refine: locator + NCC/SSIM
  let refined = { bbox: null, ncc: 0, ssim: 0 };
  if (top && top.fused >= PRELOC_THRESHOLD && budget.remain() > 300) {
    const stampObj = stamps.find((x) => x.name === top.stamp);
    const seedEdge = stampObj.refs[0]?.edgeRef;

    try {
      const loc = await edgeOnlyLocator(imgs[top.imgIdx], seedEdge, budget);
      if (loc.bbox) {
        const { x: bx, y: by, w: bw, h: bh } = loc.bbox;
        try {
          const patch = await sharp(imgs[top.imgIdx])
            .extract({ left: bx, top: by, width: bw, height: bh })
            .png()
            .toBuffer();
          const [nccVal, ssimVal] = await Promise.all([
            nccEdges(patch, stampObj.buf),
            ssim(patch, stampObj.buf),
          ]);
          refined = {
            bbox: { x: bx, y: by, w: bw, h: bh },
            ncc: nccVal,
            ssim: ssimVal,
          };
        } catch {
          // extraction failed → ignore refine
        }
      }
    } catch (e) {
      // Soft-fail on budget overrun; only rethrow unexpected errors
      const msg = String(e?.message || "");
      if (!/budget/i.test(msg)) throw e;
      // else: keep refined as {bbox:null,...} and proceed
    }
  }

  const decision = fusedDecision({ top, second, refined });
  return { ...decision, top, refined };
}

/** ---------- Public API ---------- */
export async function detectStampOnBuffer(fileBuffer, mimeType) {
  const t0 = nowMs();
  const budget = makeBudget();

  if (!stampsLoaded) {
    await initStamps();
  }
  if (!stamps.length) {
    return {
      success: true,
      match: false,
      score: 0,
      page: null,
      stamp: null,
      margin: 0,
      bbox: null,
      ncc: 0,
      ssim: 0,
      note: "No stamps loaded.",
      timeMs: nowMs() - t0,
    };
  }

  try {
    const imgs = await normalizeToImages(fileBuffer, mimeType, budget);
    if (!imgs.length) {
      return {
        success: true,
        match: false,
        score: 0,
        page: null,
        stamp: null,
        margin: 0,
        bbox: null,
        ncc: 0,
        ssim: 0,
        note: "No images found in document.",
        timeMs: nowMs() - t0,
      };
    }

    // First pass
    let { match, reason, top, refined } = await runDetectionOnImages(
      imgs,
      budget
    );

    // If PDF and still weak, try render-only pass and pick best
    if (
      (isPDF(fileBuffer) || (mimeType || "").includes("pdf")) &&
      !match &&
      budget.remain() > 600
    ) {
      try {
        const renders = await renderPdfPages(fileBuffer);
        const norm = await Promise.all(renders.map(normalizeImage));
        if (norm.length) {
          const r2 = await runDetectionOnImages(norm, budget);
          if (!match || (r2.top?.fused || 0) > (top?.fused || 0)) {
            match = r2.match;
            reason = r2.reason;
            top = r2.top;
            refined = r2.refined;
          }
        }
      } catch {}
    }

    const elapsed = nowMs() - t0;
    return {
      success: true,
      match,
      score: Number((top?.fused || 0).toFixed(3)),
      page: (top?.imgIdx ?? 0) + 1,
      stamp: top?.stamp || null,
      margin: Number(((top?.fused || 0) - 0).toFixed(3)), // (kept simple)
      bbox: refined?.bbox || null,
      ncc: Number((refined?.ncc || 0).toFixed(3)),
      ssim: Number((refined?.ssim || 0).toFixed(3)),
      note: `${reason} | hybrid(images+render) | TH_HI=${env.stamp.THRESHOLD_HI}, TH_LO=${env.stamp.THRESHOLD_LO}`,
      timeMs: elapsed,
    };
  } catch (e) {
    const elapsed = nowMs() - t0;
    return { success: false, error: e.message, timeMs: elapsed };
  }
}
