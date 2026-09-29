import { deleteQuestion, updateQuestion } from "@/lib/services/question.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    await deleteQuestion(id, auth.userId, auth.collegeId);
    return Response.json({ success: true, message: "Question deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const body = await req.json();
    const { examId, ...data } = body;
    const question = await updateQuestion(id, auth.userId, auth.collegeId, data, examId);
    return Response.json({ success: true, question });
  } catch (error) {
    return errorResponse(error);
  }
}
