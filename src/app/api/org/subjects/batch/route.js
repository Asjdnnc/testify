import { createSubjectsBatch } from "@/lib/services/org.service.js";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";
import * as XLSX from "xlsx";

/**
 * POST /api/org/subjects/batch
 * Handles both JSON (for comma-separated lists) and FormData (for file uploads).
 */
export async function POST(req) {
  try {
    // 1. Auth Check
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });
    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const contentType = req.headers.get("content-type") || "";
    let subjectsList = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle File Upload
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) return Response.json({ success: false, message: "No file uploaded" }, { status: 400 });

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      subjectsList = rawData.map(row => {
        const keys = Object.keys(row);
        const nameKey = keys.find(k => k.toLowerCase().includes("name") || k.toLowerCase().includes("subject"));
        const codeKey = keys.find(k => k.toLowerCase().includes("code"));
        const creditsKey = keys.find(k => k.toLowerCase().includes("credit"));

        return {
          name: row[nameKey]?.toString()?.trim(),
          code: row[codeKey]?.toString()?.trim(),
          credits: row[creditsKey]
        };
      }).filter(s => s.name);

    } else {
      // Expecting JSON array of {name, code, credits}
      const body = await req.json();
      if (!Array.isArray(body)) {
        return Response.json({ success: false, message: "Expected an array of subjects" }, { status: 400 });
      }
      subjectsList = body;
    }

    if (subjectsList.length === 0) {
      return Response.json({ success: false, message: "No subjects found to process" }, { status: 400 });
    }

    const result = await createSubjectsBatch(collegeId, subjectsList);

    return Response.json({
      success: true,
      message: `Successfully processed subjects.`,
      result
    });

  } catch (error) {
    return errorResponse(error, 500);
  }
}
