import { ensureAnnualBatches } from "@/lib/services/org.service.js";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });
    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const created = await ensureAnnualBatches(collegeId);
    return Response.json({ success: true, created });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
