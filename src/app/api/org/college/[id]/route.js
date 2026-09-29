import { getCollegeById, updateCollege } from "@/lib/services/org.service";
import { requireAuth, errorResponse, HttpError } from "@/lib/server-auth.js";

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["SUPER_ADMIN", "ADMIN"] });
    const { id } = await params;
    if (auth.role === "ADMIN" && auth.collegeId !== id) throw new HttpError(403, "Forbidden");

    const college = await getCollegeById(id);
    if (!college) return Response.json({ success: false, message: "College not found" }, { status: 404 });

    return Response.json({ success: true, college });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function PATCH(req, { params }) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const { id } = await params;
    const body = await req.json();
    const college = await updateCollege(id, body);

    return Response.json({ success: true, college });
  } catch (error) {
    return errorResponse(error);
  }
}
