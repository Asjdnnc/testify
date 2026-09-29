import { createDraftExam, getExamsByCreator } from "@/lib/services/exam.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const exams = await getExamsByCreator(auth.userId);
    return Response.json({ success: true, exams });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const body = await req.json();
    // collegeId always comes from the verified token, never the request body
    const exam = await createDraftExam(auth.userId, { ...body, collegeId: auth.collegeId });
    return Response.json({ success: true, exam }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
