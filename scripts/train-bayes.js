// scripts/train-bayes.js
// Train a multinomial Naive Bayes classifier from dataset.csv -> model/model-bayes.json
// CSV schema: text,label
// Usage: DATASET_PATH=./dataset.csv node scripts/train-bayes.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { env } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH =
  path.join(__dirname, "..", env?.cnn?.dataSetPath);
const OUT_PATH =
  env?.cnn?.modelPath ||
  path.join(__dirname, "..", "model", "model-bayes.json");

// ------------------------ Preprocessing (dataset-only) ------------------------
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
 * Features:
 * - bigrams from ALL tokens (stopwords kept in bigrams)
 * - unigrams ONLY if NOT a stopword
 */
function preprocessToFeatures(s) {
  const all = tokenize(s);
  const uni = all.filter((t) => t && !STOP.has(t));
  const bi = toBigrams(all);
  return uni.concat(bi);
}

// ------------------------ Model structs ------------------------
function createEmptyModel(alpha = 0.3) {
  // alpha tuned for small datasets; you can set to 1.0 if you prefer classic Laplace
  return {
    version: 4,
    alpha,
    labels: [],        // e.g., ["CERT_ENROLLMENT", ...]
    priors: {},        // label -> log prior (after finalize)
    tokenCounts: {},   // label -> { feature -> count }
    totalTokens: {},   // label -> total feature count
    vocab: {},         // feature -> 1 (set)
    vocabSize: 0
  };
}

function learn(model, text, label) {
  if (!model.labels.includes(label)) {
    model.labels.push(label);
    model.priors[label] = 0;
    model.tokenCounts[label] = {};
    model.totalTokens[label] = 0;
  }
  model.priors[label] += 1; // prior as doc count (convert to log later)

  const feats = preprocessToFeatures(text);
  for (const f of feats) {
    model.vocab[f] = 1;
    model.tokenCounts[label][f] = (model.tokenCounts[label][f] || 0) + 1;
    model.totalTokens[label] += 1;
  }
}

function finalize(model) {
  model.vocabSize = Object.keys(model.vocab).length;
  const totalDocs =
    Object.values(model.priors).reduce((a, b) => a + b, 0) || 1;
  // Convert prior counts to log priors
  for (const y of model.labels) {
    model.priors[y] = Math.log((model.priors[y] || 0) / totalDocs);
  }
}

// ------------------------ Training pipeline ------------------------
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ dataset not found: ${CSV_PATH}`);
  process.exit(1);
}
const raw = fs.readFileSync(CSV_PATH, "utf8");
const rows = parse(raw, { columns: true, skip_empty_lines: true });
if (!rows.length) {
  console.error("❌ dataset is empty. Expected columns: text,label");
  process.exit(1);
}

const model = createEmptyModel(0.3);

let added = 0;
const perLabel = {};

for (const r of rows) {
  const text = r.text;
  const label = String(r.label || "").trim();
  if (!text || !label) continue;
  learn(model, text, label);
  added++;
  perLabel[label] = (perLabel[label] || 0) + 1;
}

if (added === 0) {
  console.error("❌ no valid (text,label) rows were ingested.");
  process.exit(1);
}

finalize(model);

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(model), "utf8");

console.log(`✅ Trained on ${added} samples.`);
console.log("📊 Per-label counts:", perLabel);
console.log("🏷️  Labels:", model.labels);
console.log("🔤 Vocab size:", model.vocabSize);
console.log(`💾 Saved model to: ${OUT_PATH}`);
