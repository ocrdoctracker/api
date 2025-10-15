// src/controllers/doc-classification.controller.js
import { env } from "../config/env.js";
import { loadLocalClassifier, classifyLocal } from "../classifiers/localBayes.js";
import { readSingleFileFromMultipart, extractTextFromBuffer } from "../utils/utils.js";

// ⬇️ NEW: import the stamp detector service
import { detectStampOnBuffer, initStamps } from "../services/stamp.service.js";

// Load Bayes model at boot
const clfPromise = loadLocalClassifier()
  .then((clf) => {
    console.log("✅ Local Bayes model loaded.");
    return clf;
  })
  .catch((e) => {
    console.error("❌ Failed to load model:", e.message);
    process.exit(1);
  });

// (Optional) warm up stamp samples at boot (non-fatal if stamps folder missing)
const stampsReady = initStamps().catch((e) =>
  console.warn("⚠️ initStamps failed (continuing):", e.message)
);

/**
 * POST /api/doc-classification
 * Accepts a single file (10MB cap via utils) and returns:
 *   - bayes: your existing document classification output
 *   - stamp: stamp detection result (hybrid images+render, robust across PDF/DOCX)
 */
export async function classify(req, res) {
  try {
    // read single file (10MB cap)
    const { filename, mimeType, size, buffer } = await readSingleFileFromMultipart(req);
    if (!size) {
      return res.status(400).json({ success: false, message: "No file received" });
    }

    // Extract text (required by your current flow)
    let extractedText = "";
    try {
      extractedText = await extractTextFromBuffer(filename, buffer);
      if (!extractedText) {
        return res.status(400).json({ success: false, message: "No text extracted" });
      }
    } catch {
      return res.status(400).json({ success: false, message: "No text extracted" });
    }

    // Kick both tasks (Bayes + Stamp) concurrently for speed
    const bayesPromise = (async () => {
      const clf = await clfPromise;
      return classifyLocal(clf, extractedText, {
        threshold: Number(env?.cnn?.threshold),
        otherLabel: env?.cnn?.otherLabel,
        topK: 5,
      });
    })();

    // Ensure stamps are loaded (non-blocking if already done)
    await stampsReady;

    // Stamp detection works directly on the binary buffer (PDF/DOCX/Image)
    const stampPromise = detectStampOnBuffer(buffer, mimeType);

    // Await both
    const [bayes, stamp] = await Promise.all([bayesPromise, stampPromise]);

    return res.json({
      success: true,
      data: { bayes, stamp },
      message: "Classification completed",
    });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error?.message || "Upload failed" });
  }
}
