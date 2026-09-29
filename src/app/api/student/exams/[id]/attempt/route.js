import { startAttempt } from "@/lib/services/attempt.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"], subscription: true });

    const { id } = await params;
    const attempt = await startAttempt(auth.userId, id);
    return Response.json({ success: true, attempt });
  } catch (error) {
    return errorResponse(error);
  }
}
