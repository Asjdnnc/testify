import { createBatch, getBatchesByBranch } from "@/lib/services/org.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// GET /api/org/batch?branchId=123
export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "TEACHER", "SUPER_ADMIN"], subscription: true });
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
       return Response.json({ success: false, message: "branchId query param required" }, { status: 400 });
    }

    const scopeCollegeId = auth.role === "SUPER_ADMIN" ? null : auth.collegeId;
    const batches = await getBatchesByBranch(branchId, scopeCollegeId);
    return Response.json({ success: true, batches });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

// POST /api/org/batch
export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });
    const body = await req.json();
    const scopeCollegeId = auth.role === "SUPER_ADMIN" ? null : auth.collegeId;
    const batch = await createBatch({ ...body, collegeId: scopeCollegeId });

    return Response.json({ success: true, batch }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
