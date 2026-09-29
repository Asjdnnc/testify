import { syncAnswers } from "@/lib/services/attempt.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function PUT(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"] });

    const { id: attemptId } = await params;
    const body = await req.json();

    // Body: { questionId, selectedOptions (array), subjectiveText, clientSavedAt }
    const answer = await syncAnswers(auth.userId, attemptId, [body]);

    return Response.json({ success: true, answer }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
