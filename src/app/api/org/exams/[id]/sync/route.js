import { recalculateExamResults } from "@/lib/services/grading.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id: examId } = await params;
    const result = await recalculateExamResults(auth.userId, examId);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
