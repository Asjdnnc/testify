import { addQuestionToExam, removeQuestionFromExam, reorderExamQuestions } from "@/lib/services/exam.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const { questionId, order, marks } = await req.json();

    const association = await addQuestionToExam(auth.userId, id, questionId, order, marks);
    return Response.json({ success: true, association });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");

    await removeQuestionFromExam(auth.userId, id, questionId);
    return Response.json({ success: true, message: "Question removed from exam" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const { orderedIds } = await req.json();
    if (!Array.isArray(orderedIds)) {
      return Response.json({ success: false, message: "orderedIds must be an array" }, { status: 400 });
    }

    await reorderExamQuestions(auth.userId, id, orderedIds);
    return Response.json({ success: true, message: "Structure synchronized" });
  } catch (error) {
    return errorResponse(error);
  }
}
