import { createQuestion, getQuestionsBySubject } from "@/lib/services/question.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const body = await req.json();
    const question = await createQuestion({
      ...body,
      collegeId: auth.collegeId,
      creatorId: auth.userId,
    });

    return Response.json({ success: true, question }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');
    if (!subjectId) return Response.json({ success: false, message: "subjectId required" }, { status: 400 });

    const questions = await getQuestionsBySubject(subjectId, auth.collegeId);
    return Response.json({ success: true, questions });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
