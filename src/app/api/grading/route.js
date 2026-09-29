import { gradeSubjectiveAnswer } from "@/lib/services/grading.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const body = await req.json();
    const { answerId, marksObtained, feedback } = body;

    const marks = parseFloat(marksObtained);
    if (!answerId || marksObtained === undefined || marksObtained === null || Number.isNaN(marks)) {
      return Response.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const result = await gradeSubjectiveAnswer(auth.userId, answerId, marks, feedback);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
