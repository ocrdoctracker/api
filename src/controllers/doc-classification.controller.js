import { env } from "../config/env.js"
import {
  loadLocalClassifier,
  classifyLocal,
} from "../classifiers/localBayes.js";
import {
  readSingleFileFromMultipart,
  extractTextFromBuffer,
} from "../utils/utils.js";

const clfPromise = loadLocalClassifier()
  .then((clf) => {
    console.log("✅ Local Bayes model loaded.");
    return clf;
  })
  .catch((e) => {
    console.error("❌ Failed to load model:", e.message);
    process.exit(1);
  });

export async function classify(req, res) {
  let cnnResults;
  try {
    // read single file (10MB cap)
    const { filename, mimeType, size, buffer } =
      await readSingleFileFromMultipart(req);

    if (!size) {
      return res
        .status(400)
        .json({ success: false, message: "No file received" });
    }
    // Extract text (best-effort). If not needed, remove this block.
    let extractedText = "";
    try {
      extractedText = await extractTextFromBuffer(filename, buffer);
      if (!extractedText)
        return res.status(400).json({ error: "No text extracted" });
    } catch (e) {
      // non-fatal: continue without extracted text
      extractedText = "";
      if (!extractedText)
        return res.status(400).json({ error: "No text extracted" });
    }

    const clf = await clfPromise;
    cnnResults = classifyLocal(clf, extractedText, {
      threshold: Number(env?.cnn?.threshold),
      otherLabel: env?.cnn?.otherLabel,
      topK: 5,
    });

  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error.message || "Upload failed" });
  }
  return res.json({
    success: true,
    data: cnnResults,
    message: "Classification completed",
  });
}
