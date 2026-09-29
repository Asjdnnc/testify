import { submitAttempt } from "@/lib/services/attempt.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    // Submitting is always allowed so an in-flight exam is never lost to a billing change
    const auth = await requireAuth(req, { roles: ["STUDENT"] });

    const { id } = await params;

    const attempt = await submitAttempt(auth.userId, id);
    return Response.json({ success: true, attempt });
  } catch (error) {
    return errorResponse(error);
  }
}
