import { syncAnswers } from "@/lib/services/attempt.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"] });

    const { id } = await params;
    const { answers } = await req.json();
    if (!Array.isArray(answers)) {
      return Response.json({ success: false, message: "answers must be an array" }, { status: 400 });
    }

    const result = await syncAnswers(auth.userId, id, answers);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
