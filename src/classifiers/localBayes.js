// src/classifiers/localBayes.js
// Load & run the custom multinomial Naive Bayes model produced by scripts/train-bayes.js
// Dataset-only features: non-stopword unigrams + all bigrams. No hint rules.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODEL_PATH = path.join(__dirname, "..", "..", env?.cnn?.modelPath);

// ------------------------ Preprocessing (must MATCH trainer) ------------------------
const STOP = new Set([
  "a","an","the","and","or","of","to","for","in","on","at","by","with","as","is","are",
  "this","that","these","those","be","been","being","it","its","from","was","were","will",
  "would","can","could","should","may","might","do","does","did","has","have","had","not",
  "but","if","then","than","so","such","into","over","under","between","within","per"
]);

function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  const txt = normalize(s).replace(/[^a-z0-9-]+/g, " ").trim();
  if (!txt) return [];
  return txt.split(" ");
}

function toBigrams(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length - 1; i++) out.push(tokens[i] + "_" + tokens[i + 1]);
  return out;
}

/**
 * EXACT same as trainer:
 * - bigrams from ALL tokens (stopwords kept in bigrams)
 * - unigrams ONLY if NOT a stopword
 */
function preprocessToFeatures(s) {
  const all = tokenize(s);
  if (all.length === 0) return [];
  const uni = all.filter((t) => t && !STOP.has(t));
  const bi = toBigrams(all);
  return uni.concat(bi);
}

// ------------------------ Load model ------------------------
export async function loadLocalClassifier(options = {}) {
  const modelPath = options.modelPath || DEFAULT_MODEL_PATH;
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model file not found at: ${modelPath}`);
  }
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  if (
    !model ||
    !Array.isArray(model.labels) ||
    !model.priors ||
    !model.tokenCounts ||
    !model.totalTokens ||
    typeof model.alpha !== "number"
  ) {
    throw new Error("Invalid model JSON.");
  }
  return model;
}

// ------------------------ Inference ------------------------

// P(f|y) with Laplace smoothing (same as trainer)
function logProbFeatureGivenLabel(model, label, feat) {
  const alpha = model.alpha;
  const total = model.totalTokens[label] || 0;
  const V = model.vocabSize || 1;
  const c = (model.tokenCounts[label]?.[feat] || 0);
  const denom = total + alpha * V;
  if (!isFinite(denom) || denom <= 0) return Number.NEGATIVE_INFINITY;
  const val = (c + alpha) / denom;
  return (val > 0) ? Math.log(val) : Number.NEGATIVE_INFINITY;
}

// Numerically-stable softmax (log-sum-exp with clamping)
function softmaxStable(logScores, temperature = 1.0) {
  const invT = 1 / Math.max(temperature, 1e-6);
  let maxLog = -Infinity;
  for (const s of logScores) if (isFinite(s)) maxLog = Math.max(maxLog, s);

  if (!isFinite(maxLog)) {
    const n = logScores.length || 1;
    return Array(n).fill(1 / n);
  }

  const exps = new Array(logScores.length);
  let sum = 0;
  for (let i = 0; i < logScores.length; i++) {
    const z = (logScores[i] - maxLog) * invT;
    const ez = (z < -50) ? 0 : Math.exp(z); // clamp very negative deltas
    exps[i] = ez;
    sum += ez;
  }

  if (sum === 0 || !isFinite(sum)) {
    // Fallback to argmax=1 if underflow/overflow occurs
    const out = Array(logScores.length).fill(0);
    let argmax = 0;
    for (let i = 1; i < logScores.length; i++) {
      if (logScores[i] > logScores[argmax]) argmax = i;
    }
    out[argmax] = 1;
    return out;
  }

  const probs = exps.map((e) => e / sum);
  // enforce exact normalization (guard tiny fp drift)
  const norm = probs.reduce((a, b) => a + b, 0);
  if (Math.abs(norm - 1) > 1e-12) {
    for (let i = 0; i < probs.length; i++) probs[i] /= norm;
  }
  return probs;
}

function customRound(value) {
  // if it's 0.96 or higher, round normally
  if (value >= 0.96) {
    return Math.round(value);
  }
  // otherwise, keep original with up to 3 decimals
  return Number(value.toFixed(3));
}


export function classifyLocal(model, text, opts = {}) {
  const {
    temperature = Number(env?.cnn?.temperature),
    topK = 5,
    otherLabel = env?.cnn?.otherLabel,
    minTokens = Number(env?.cnn?.minTokens),
    binary = true,       // presence-only to avoid repetition bias
    returnDebug = false, // set true to include raw logs/features for tracing
  } = opts;

  // 1) features
  let feats = preprocessToFeatures(text);
  if (feats.length < minTokens) {
    return { best: { label: otherLabel, score: 0 }, candidates: [] };
  }
  if (binary) feats = Array.from(new Set(feats));

  // 2) compute per-label log scores
  const labels = model.labels.slice();
  const logScores = new Array(labels.length);
  for (let i = 0; i < labels.length; i++) {
    const y = labels[i];
    let score = model.priors[y];
    if (!isFinite(score)) score = Number.NEGATIVE_INFINITY;

    for (const f of feats) {
      if (model.vocab && !model.vocab[f]) continue; // skip OOV features
      score += logProbFeatureGivenLabel(model, y, f);
    }
    logScores[i] = score;
  }

  // 3) sort by raw log score descending (keep index mapping)
  const idx = labels.map((_, i) => i);
  idx.sort((i, j) => logScores[j] - logScores[i]);

  // 4) stable softmax on the sorted log scores
  const sortedLogs = idx.map((i) => logScores[i]);
  const probsSorted = softmaxStable(sortedLogs, temperature);

  // 5) package candidates
  const candidates = idx.map((i, k) => ({
    label: labels[i],
    score: probsSorted[k].toFixed(18).includes("0.00") ? 0 : customRound(Number(probsSorted[k].toFixed(18))),
  })).slice(0, topK);

  const best = candidates[0] || { label: otherLabel, score: 0 };

  if (returnDebug) {
    return {
      best,
      candidates,
      _debug: {
        feats,
        labelsSorted: idx.map((i) => labels[i]),
        logScoresSorted: sortedLogs
      }
    };
  }

  return { best, candidates };
}

// (optional) export helpers for testing
export { preprocessToFeatures };
