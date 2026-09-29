import { logProctorEvent } from "@/lib/services/attempt.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["STUDENT"] });

    const { id: attemptId } = await params;
    const body = await req.json();

    if (!body.event) return Response.json({ success: false, message: "Event required" }, { status: 400 });

    const result = await logProctorEvent(auth.userId, attemptId, body.event, body.metadata);

    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
