import { createUserForCollege, getUsersByCollege, getUsersByBatch } from "@/lib/services/org.service";
import { requireAuth, resolveCollegeId, errorResponse, HttpError } from "@/lib/server-auth.js";

const MANAGEABLE_ROLES = ["TEACHER", "STUDENT"];

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });

    const { searchParams } = new URL(req.url);
    const role = (searchParams.get("role") || "TEACHER").toUpperCase();
    const batchId = searchParams.get("batchId");

    if (!["ADMIN", ...MANAGEABLE_ROLES].includes(role)) throw new HttpError(400, "Invalid role");

    // Admins can only see users for their own college. Super Admins pass collegeId in query.
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    let users;
    if (batchId && role === "STUDENT") {
      users = await getUsersByBatch(batchId, collegeId);
    } else {
      users = await getUsersByCollege(collegeId, role);
    }

    return Response.json({ success: true, users });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });

    const body = await req.json();
    const collegeId = resolveCollegeId(auth, body.collegeId);
    const role = (body.role || "TEACHER").toUpperCase();

    // College admins may only create teachers/students — never ADMIN or SUPER_ADMIN
    if (!MANAGEABLE_ROLES.includes(role)) {
      throw new HttpError(403, "You can only create teacher or student accounts here");
    }

    const user = await createUserForCollege(collegeId, {
      name: body.name,
      email: body.email,
      password: body.password,
      role,
      batchId: body.batchId,
      branchId: body.branchId,
    });
    const { passwordHash: _, resetPasswordToken: __, ...safeUser } = user;

    return Response.json({ success: true, user: safeUser }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
