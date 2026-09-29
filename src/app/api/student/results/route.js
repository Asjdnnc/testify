import { getStudentResultSummary, calculateSemesterGPA } from "@/lib/services/grading.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"], subscription: true });

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");

    if (semester) {
      const gpa = await calculateSemesterGPA(auth.userId, parseInt(semester, 10));
      return Response.json({ success: true, gpa }, { status: 200 });
    }

    const summary = await getStudentResultSummary(auth.userId);
    return Response.json({ success: true, summary }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
