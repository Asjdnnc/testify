import { requireAuth, errorResponse } from "@/lib/server-auth.js";
import { submitAttempt } from "@/lib/services/attempt.service.js";

export async function POST(req) {

  try {

    const decoded = await requireAuth(req, { roles: ["STUDENT"] });

    const body = await req.json();

    const { attemptId } = body;

    const result = await submitAttempt(decoded.userId, attemptId);


    return Response.json({
      success: true,
      attempt: result
    });

  } catch (error) {

    return errorResponse(error);

  }

}