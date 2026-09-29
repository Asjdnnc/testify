import { calculateSemesterGPA } from "@/lib/services/grading.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"], subscription: true });

    const { searchParams } = new URL(req.url);
    const semester = parseInt(searchParams.get('semester') || "1", 10);
    if (Number.isNaN(semester)) {
      return Response.json({ success: false, message: "Invalid semester" }, { status: 400 });
    }

    const result = await calculateSemesterGPA(auth.userId, semester);
    return Response.json({ success: true, result }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
