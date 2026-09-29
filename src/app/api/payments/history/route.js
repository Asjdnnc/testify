import { getPaymentHistory } from "@/lib/services/payment.service.js";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";

// GET /api/payments/history
// Admin: returns their own college payments
// Super Admin: ?collegeId= returns any college's payments
export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"] });
    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const payments = await getPaymentHistory(collegeId);
    return Response.json({ success: true, payments });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
