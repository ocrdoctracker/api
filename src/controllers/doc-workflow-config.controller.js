import { env } from "../config/env.js";

// Put these in ENV in real life
const API_KEY = env?.google?.apiKey; // ← replace with your key or use env
const SPREADSHEET_ID = env?.google?.workflowConfigSheetId;
const RANGE = env?.google?.workflowConfigSheetRange; // adjust to your sheet

// ---- Transform rows -> desired JSON (GROUPED BY DocPurpose) ----
function transformWorkflow(rows) {
  if (!rows || rows.length < 2) {
    throw new Error("Sheet has no data");
  }

  const header = rows[0];

  const colIndex = (name) => {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`Column "${name}" not found in header`);
    return idx;
  };

  const docPurposeCol = colIndex("DocPurpose");
  const docPurposeFileReqCol = colIndex("DocPurposeFileRequirement");
  const stepCol = colIndex("Steps");
  const approvalCol = colIndex("Approval");
  const fileUploadCol = colIndex("FileUpload");
  const deptCol = colIndex("DepartmentId");
  const stepsFileRequirementCol = colIndex("StepsFileRequirements");

  const validYesNo = (v) => {
    const s = String(v || "").trim().toLowerCase();
    return s === "yes" || s === "no";
  };

  const toBool = (v) =>
    String(v || "")
      .trim()
      .toLowerCase() === "yes";

  const groups = {};

  rows.slice(1).forEach((r, index) => {
    const rowNum = index + 2; // actual sheet row number

    const docPurpose = r[docPurposeCol];
    const docPurposeFileReqRaw = r[docPurposeFileReqCol];
    const stepRaw = r[stepCol];
    const approvalRaw = r[approvalCol];
    const fileUploadRaw = r[fileUploadCol];
    const deptRaw = r[deptCol];
    const stepsFileRequirement = r[stepsFileRequirementCol];

    // ---------- VALIDATION ----------

    // DocPurpose required
    if (!docPurpose) {
      console.warn(`Skipping row ${rowNum}: Missing DocPurpose`);
      return;
    }

    // Steps must be a valid number
    const stepNum = Number(stepRaw);
    if (!stepRaw || Number.isNaN(stepNum)) {
      console.warn(`Skipping row ${rowNum}: Invalid Step "${stepRaw}"`);
      return;
    }

    // Approval must be Yes/No
    if (!validYesNo(approvalRaw)) {
      console.warn(`Skipping row ${rowNum}: Invalid Approval "${approvalRaw}"`);
      return;
    }

    // FileUpload must be Yes/No
    if (!validYesNo(fileUploadRaw)) {
      console.warn(
        `Skipping row ${rowNum}: Invalid FileUpload "${fileUploadRaw}"`
      );
      return;
    }

    // DepartmentId must be a number
    const deptNum = Number(deptRaw);
    if (!deptRaw || Number.isNaN(deptNum)) {
      console.warn(
        `Skipping row ${rowNum}: Invalid DepartmentId "${deptRaw}"`
      );
      return;
    }

    // ---------- GROUPING + DOC PURPOSE FILE REQUIREMENT ----------

    if (!groups[docPurpose]) {
      groups[docPurpose] = {
        docPurpose,
        docPurposeFileRequirement: null, // will be filled from first non-empty value
        steps: [],
      };
    }

    // If this row has a non-empty DocPurposeFileRequirement and group doesn't yet have one, set it
    const trimmedReq = String(docPurposeFileReqRaw || "").trim();
    if (trimmedReq && !groups[docPurpose].docPurposeFileRequirement) {
      groups[docPurpose].docPurposeFileRequirement = trimmedReq;
    }

    // Add the validated step
    groups[docPurpose].steps.push({
      step: stepNum,
      approval: toBool(approvalRaw),
      department: deptNum,
      fileUpload: toBool(fileUploadRaw),
      stepsFileRequirement: stepsFileRequirement ?? false,
    });
  });

  // Return an array of { docPurpose, docPurposeFileRequirement, steps }
  return Object.values(groups);
}

// ---- Fetch sheet using API key (no OAuth) ----
async function fetchWorkflow() {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
      RANGE
    )}`
  );
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const rows = data.values || [];
  return transformWorkflow(rows);
}

export async function config(req, res) {
  try {
    const wf = await fetchWorkflow(); // ← returns an ARRAY now
    return res.json({
      success: true,
      data: wf,
      message: "Workflow config",
    });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: error?.message || "Error" });
  }
}
