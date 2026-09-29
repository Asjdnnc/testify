import { createSubject, getSubjectsByCollege } from "@/lib/services/org.service";
import { requireAuth, resolveCollegeId, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN", "TEACHER"], subscription: true });

    const { searchParams } = new URL(req.url);
    const collegeId = resolveCollegeId(auth, searchParams.get("collegeId"));

    const subjects = await getSubjectsByCollege(collegeId);
    return Response.json({ success: true, subjects });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN", "SUPER_ADMIN"], subscription: true });

    const body = await req.json();
    const collegeId = resolveCollegeId(auth, body.collegeId);

    const subject = await createSubject({ ...body, collegeId });
    return Response.json({ success: true, subject }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
