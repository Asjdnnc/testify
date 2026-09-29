import { completeExam } from "@/lib/services/exam.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const exam = await completeExam(auth.userId, id);
    return Response.json({ success: true, exam });
  } catch (error) {
    return errorResponse(error);
  }
}
