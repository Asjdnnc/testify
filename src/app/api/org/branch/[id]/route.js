import { updateBranch, deleteBranch } from "@/lib/services/org.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// PATCH /api/org/branch/[id]
export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"], subscription: true });
    const { id } = await params;
    const body = await req.json();
    const branch = await updateBranch(id, auth.collegeId, body);
    return Response.json({ success: true, branch });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/org/branch/[id]
export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"], subscription: true });
    const { id } = await params;
    await deleteBranch(id, auth.collegeId);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
