import { getPendingGradingExams, getExamAttemptsForGrading, getFullAttemptForGrading } from "@/lib/services/grading.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const attemptId = searchParams.get("attemptId");

    if (attemptId) {
      const attempt = await getFullAttemptForGrading(auth.userId, attemptId);
      return Response.json({ success: true, attempt }, { status: 200 });
    }

    if (examId) {
      const attempts = await getExamAttemptsForGrading(auth.userId, examId);
      return Response.json({ success: true, attempts }, { status: 200 });
    }

    const exams = await getPendingGradingExams(auth.userId);
    return Response.json({ success: true, exams }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
