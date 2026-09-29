import { createTeachersBatch, createStudentsBatch } from "@/lib/services/org.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";
import * as XLSX from "xlsx";

/**
 * POST /api/org/users/batch
 * Handles multipart/form-data with a 'file' field (XLSX or CSV).
 * Registers teachers or students in bulk and sends welcome emails.
 */
export async function POST(req) {
  try {
    // 1. Auth Check
    const decoded = await requireAuth(req, { roles: ["ADMIN"], subscription: true });

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get("file");
    const role = formData.get("role") || "TEACHER"; // Default to teacher for backward compatibility
    if (role !== "TEACHER" && role !== "STUDENT") {
      return Response.json({ success: false, message: "Invalid role" }, { status: 400 });
    }

    if (!file) {
      return Response.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    // 3. Read and Parse File
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rawData = XLSX.utils.sheet_to_json(sheet);
    
    if (rawData.length === 0) {
      return Response.json({ success: false, message: "The uploaded file is empty" }, { status: 400 });
    }

    // Normalized list
    const usersList = rawData.map(row => {
      const keys = Object.keys(row);
      const nameKey = keys.find(k => k.toLowerCase() === "name");
      const emailKey = keys.find(k => k.toLowerCase() === "email");
      const branchKey = keys.find(k => k.toLowerCase() === "branch");
      const batchKey = keys.find(k => k.toLowerCase() === "batch");
      
      const user = {
        name: row[nameKey]?.toString()?.trim(),
        email: row[emailKey]?.toString()?.trim()
      };

      if (role === "STUDENT") {
        user.branch = row[branchKey]?.toString()?.trim();
        user.batch = row[batchKey]?.toString()?.trim();
      }

      return user;
    }).filter(u => u.name && u.email);

    if (usersList.length === 0) {
      return Response.json({ 
        success: false, 
        message: "No valid rows found. Ensure your columns are titled 'Name' and 'Email' (and 'Branch', 'Batch' for students)." 
      }, { status: 400 });
    }

    // 4. Process Batch
    let result;
    if (role === "STUDENT") {
      result = await createStudentsBatch(decoded.collegeId, usersList);
    } else {
      result = await createTeachersBatch(decoded.collegeId, usersList);
    }

    return Response.json({
      success: true,
      message: `Successfully processed ${result.success} out of ${result.total} entries.`,
      data: result
    });

  } catch (error) {
    return errorResponse(error, 500);
  }
}
