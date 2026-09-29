import { getCollegeBatchYears } from "@/lib/services/org.service.js";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "TEACHER", "SUPER_ADMIN"], subscription: true });
    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const years = await getCollegeBatchYears(collegeId);
    return Response.json({ success: true, years });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
