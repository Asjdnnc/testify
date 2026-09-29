import { restoreAccount } from "@/lib/services/cancellation.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// POST /api/account/restore
// Body: { collegeId: string }
// SUPER_ADMIN only
export async function POST(req) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });

    const { collegeId } = await req.json();
    if (!collegeId) {
      return Response.json(
        { success: false, message: "collegeId is required" },
        { status: 400 }
      );
    }

    const result = await restoreAccount(collegeId);

    return Response.json({
      success: true,
      message: "College account restored. Status set to TRIAL_EXPIRED — admin must re-subscribe.",
      ...result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
