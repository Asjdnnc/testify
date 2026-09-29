import { createQuestion, getQuestionsByCollege } from "@/lib/services/question.service";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN", "SUPER_ADMIN"], subscription: true });

    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const filters = {
       subjectId: searchParams.get("subjectId"),
       type: searchParams.get("type"),
       creatorId: searchParams.get("creatorId")
    };

    const questions = await getQuestionsByCollege(collegeId, filters);
    return Response.json({ success: true, questions });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(req) {
  try {
    // Only teachers and admins can create questions
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const body = await req.json();

    const question = await createQuestion({
      ...body,
      collegeId: auth.collegeId,
      creatorId: auth.userId
    });

    return Response.json({ success: true, question }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
