import { getAvailableExams } from "@/lib/services/attempt.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"], subscription: true });

    const exams = await getAvailableExams(auth.userId);
    return Response.json({ success: true, exams });
  } catch (error) {
    return errorResponse(error);
  }
}
