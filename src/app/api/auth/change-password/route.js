import { updateUserPassword } from "@/lib/services/auth.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

/**
 * POST /api/auth/change-password
 * Body: { password: string }
 *
 * Securely updates the logged-in user's password and removes the
 * requirePasswordChange flag.
 */
export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    const { password } = await req.json();

    if (!password || password.length < 8) {
      return Response.json({ success: false, message: "Password must be at least 8 characters" }, { status: 400 });
    }

    await updateUserPassword(auth.userId, password);

    return Response.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
