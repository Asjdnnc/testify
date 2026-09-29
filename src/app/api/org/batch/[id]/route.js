import { updateBatch, deleteBatch } from "@/lib/services/org.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// PATCH /api/org/batch/[id]
export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"], subscription: true });
    const { id } = await params;
    const body = await req.json();
    const batch = await updateBatch(id, auth.collegeId, body);
    return Response.json({ success: true, batch });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/org/batch/[id]
export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"], subscription: true });
    const { id } = await params;
    await deleteBatch(id, auth.collegeId);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
