import { requireAuth, errorResponse } from "@/lib/server-auth.js";
import { syncAnswers } from "@/lib/services/attempt.service.js";

export async function POST(req) {

  try {

    const decoded = await requireAuth(req, { roles: ["STUDENT"] });

    const body = await req.json();

    // body: { attemptId, questionId, selectedOptions, subjectiveText, clientSavedAt }
    const { attemptId, ...answerData } = body;
    const result = await syncAnswers(decoded.userId, attemptId, [answerData]);

    return Response.json({
      success: true,
      result
    });


  } catch (error) {

    return errorResponse(error);

  }

}