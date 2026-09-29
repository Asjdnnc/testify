import { deleteUser } from "@/lib/services/org.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// DELETE /api/org/users/[id]
export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"], subscription: true });
    const { id } = await params;
    await deleteUser(id, auth.collegeId);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
