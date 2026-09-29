import { requestCancellation } from "@/lib/services/cancellation.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// POST /api/account/cancel
// Body: { reason?: string }
export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"] });

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const result = await requestCancellation(auth.collegeId, auth.userId, reason);

    return Response.json({
      success: true,
      message: "Cancellation request submitted. Your data will be retained during the grace period.",
      scheduledAt: result.cancellationRequest.scheduledAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
