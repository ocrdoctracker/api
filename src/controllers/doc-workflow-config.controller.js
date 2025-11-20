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

    // ---------- DOC PURPOSE IS REQUIRED ----------
    if (!docPurpose) {
      console.warn(`Skipping row ${rowNum}: Missing DocPurpose`);
      return;
    }

    // Ensure the group exists even if this row has NO valid steps
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

    // ---------- STEP FIELDS ----------
    const stepRaw = r[stepCol];
    const approvalRaw = r[approvalCol];
    const deptRaw = r[deptCol];
    const stepsFileRequirement = r[stepsFileRequirementCol];

    // Check if this row even tries to define a step
    const hasAnyStepData =
      (stepRaw && String(stepRaw).trim() !== "") ||
      (approvalRaw && String(approvalRaw).trim() !== "") ||
      (deptRaw && String(deptRaw).trim() !== "") ||
      (stepsFileRequirement && String(stepsFileRequirement).trim() !== "");

    // If there is absolutely no step data, we just keep the group and move on.
    if (!hasAnyStepData) {
      return;
    }

    // ---------- VALIDATION FOR STEP ----------
    // Steps must be a valid number
    const stepNum = Number(stepRaw);
    if (!stepRaw || Number.isNaN(stepNum)) {
      console.warn(
        `Row ${rowNum}: Invalid Step "${stepRaw}", skipping step but keeping DocPurpose group.`
      );
      return;
    }

    // Approval must be Yes/No
    if (!validYesNo(approvalRaw)) {
      console.warn(
        `Row ${rowNum}: Invalid Approval "${approvalRaw}", skipping step but keeping DocPurpose group.`
      );
      return;
    }

    // DepartmentId must be a number
    const deptNum = Number(deptRaw);
    if (!deptRaw || Number.isNaN(deptNum)) {
      console.warn(
        `Row ${rowNum}: Invalid DepartmentId "${deptRaw}", skipping step but keeping DocPurpose group.`
      );
      return;
    }

    // ---------- ADD VALIDATED STEP ----------
    groups[docPurpose].steps.push({
      step: stepNum,
      approval: toBool(approvalRaw),
      departmentId: deptNum,
      stepsFileRequirement: stepsFileRequirement ?? null,
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
