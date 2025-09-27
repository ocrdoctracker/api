import fs from "node:fs";
import path from "node:path";

export function loadDocumentTypes() {
  const filePath = path.join(process.cwd(), "public", "document-types.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
