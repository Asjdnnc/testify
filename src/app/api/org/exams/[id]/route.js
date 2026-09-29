import { deleteExam, getExamById, updateExam } from "@/lib/services/exam.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const exam = await getExamById(id, auth.userId);
    if (!exam) return Response.json({ success: false, message: "Exam not found" }, { status: 404 });
    return Response.json({ success: true, exam });
  } catch (error) {
    return errorResponse(error, 404);
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const body = await req.json();
    const exam = await updateExam(id, auth.userId, body);
    return Response.json({ success: true, exam });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    await deleteExam(id, auth.userId);
    return Response.json({ success: true, message: "Exam deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
