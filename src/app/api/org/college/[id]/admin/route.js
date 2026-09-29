import { createUserForCollege } from "@/lib/services/org.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// POST /api/org/college/[id]/admin — SUPER_ADMIN provisions an extra college admin
export async function POST(req, { params }) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const { id: collegeId } = await params;
    const body = await req.json();

    const admin = await createUserForCollege(collegeId, {
      name: body.name,
      email: body.email,
      password: body.password,
      role: "ADMIN",
    });

    // Sanitize user object for response
    const { passwordHash: _, resetPasswordToken: __, ...safeAdmin } = admin;

    return Response.json({ success: true, admin: safeAdmin }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
