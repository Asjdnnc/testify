import prisma from "@/lib/prisma.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// GET /api/admin/setup-progress
// Counts that drive the admin's first-run setup guide. Everything is scoped
// to the admin's own college.
export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"] });
    const collegeId = auth.collegeId;

    const [branches, batches, subjects, teachers, students, exams, college] = await Promise.all([
      prisma.branch.count({ where: { collegeId } }),
      prisma.batch.count({ where: { branch: { collegeId } } }),
      prisma.subject.count({ where: { collegeId } }),
      prisma.user.count({ where: { collegeId, role: "TEACHER" } }),
      prisma.user.count({ where: { collegeId, role: "STUDENT" } }),
      prisma.exam.count({ where: { collegeId } }),
      prisma.college.findUnique({ where: { id: collegeId }, select: { subscriptionStatus: true, name: true } }),
    ]);

    return Response.json({
      success: true,
      progress: {
        collegeName: college?.name || null,
        subscriptionStatus: college?.subscriptionStatus || null,
        counts: { branches, batches, subjects, teachers, students, exams },
      },
    });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
