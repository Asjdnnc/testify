import { getExamForStudent } from "@/lib/services/exam.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"], subscription: true });

    const { id } = await params;
    const exam = await getExamForStudent(id, auth.userId);
    return Response.json({ success: true, exam });
  } catch (error) {
    return errorResponse(error, 403);
  }
}
