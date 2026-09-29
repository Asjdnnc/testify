import { startAttempt, submitAttempt } from "@/lib/services/attempt.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"] });

    const body = await req.json();

    // Distinguish between Start and Submit based on action flag
    if (body.action === "START") {
       await requireAuth(req, { roles: ["STUDENT"], subscription: true });
       const attempt = await startAttempt(auth.userId, body.examId);
       return Response.json({ success: true, attempt }, { status: 201 });
    }

    if (body.action === "SUBMIT") {
       const attempt = await submitAttempt(auth.userId, body.attemptId);
       return Response.json({ success: true, attempt }, { status: 200 });
    }

    return Response.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
