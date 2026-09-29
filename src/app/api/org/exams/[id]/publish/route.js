import { publishExam } from "@/lib/services/exam.service";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req, { roles: ["TEACHER", "ADMIN"], subscription: true });

    const { id } = await params;
    const body = await req.json().catch(() => ({})); // contains { startTime, endTime }

    const exam = await publishExam(auth.userId, id, body);
    return Response.json({ success: true, exam });
  } catch (error) {
    return errorResponse(error);
  }
}
