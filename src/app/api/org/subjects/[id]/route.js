import { updateSubject, deleteSubject } from "@/lib/services/org.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });

    const { id } = await params;
    const body = await req.json();
    const scopeCollegeId = auth.role === "SUPER_ADMIN" ? null : auth.collegeId;
    const subject = await updateSubject(id, scopeCollegeId, body);
    return Response.json({ success: true, subject });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });

    const { id } = await params;
    const scopeCollegeId = auth.role === "SUPER_ADMIN" ? null : auth.collegeId;
    await deleteSubject(id, scopeCollegeId);
    return Response.json({ success: true, message: "Subject deleted" });
  } catch (error) {
    return errorResponse(error);
  }
}
