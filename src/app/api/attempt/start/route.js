import { requireAuth, errorResponse } from "@/lib/server-auth.js";
import { startAttempt } from "@/lib/services/attempt.service.js";

export async function POST(req) {

  try {

    const decoded = await requireAuth(req, { roles: ["STUDENT"], subscription: true });

    const body = await req.json();

    const { examId } = body;

    const attempt = await startAttempt(decoded.userId, examId);

    return Response.json({
      success: true,
      attempt
    });

  } catch (error) {

    return errorResponse(error);

  }

}

