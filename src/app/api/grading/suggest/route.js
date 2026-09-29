import { suggestSubjectiveGrade } from "@/lib/services/ai-grading.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export const maxDuration = 60;

// POST /api/grading/suggest  { answerId }
// Returns an AI recommendation for a written answer. It does NOT save a grade —
// the examiner must review it and save the final mark via POST /api/grading.
export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });
    const { answerId } = await req.json().catch(() => ({}));
    if (!answerId) {
      return Response.json({ success: false, message: "answerId is required" }, { status: 400 });
    }
    const suggestion = await suggestSubjectiveGrade(auth.userId, answerId);
    return Response.json({ success: true, suggestion });
  } catch (error) {
    return errorResponse(error);
  }
}
