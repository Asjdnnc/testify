import { createBranch, getBranchesByCollege } from "@/lib/services/org.service.js";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";

// GET /api/org/branch?collegeId=123  (collegeId is only honoured for SUPER_ADMIN)
export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "TEACHER", "SUPER_ADMIN"], subscription: true });
    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const branches = await getBranchesByCollege(collegeId);
    return Response.json({ success: true, branches });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

// POST /api/org/branch
export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });
    const body = await req.json();
    const collegeId = resolveCollegeId(auth, body.collegeId);
    const branch = await createBranch({ ...body, collegeId });

    return Response.json({ success: true, branch }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
