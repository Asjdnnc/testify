import prisma from "@/lib/prisma.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";
import { studentExamAccessWhere } from "@/lib/services/attempt.service.js";

// GET /api/dashboard
// Returns role-specific stats for the dashboard overview
export async function GET(req) {
  try {
    const auth = await requireAuth(req);

    const { userId, role, collegeId } = auth;
    let stats = {};

    if (role === "TEACHER" || role === "ADMIN") {
      const examCount = await prisma.exam.count({ where: { creatorId: userId } });
      const draftCount = await prisma.exam.count({ where: { creatorId: userId, status: "DRAFT" } });
      const activeAttempts = await prisma.attempt.count({
        where: { exam: { creatorId: userId }, status: "IN_PROGRESS" },
      });
      const pendingGrades = await prisma.result.count({
        where: {
          exam: { creatorId: userId },
          gradingStatus: "MANUAL_REVIEW_PENDING",
        },
      });

      stats = {
        role,
        totalExams: examCount,
        draftExams: draftCount,
        activeAttempts,
        pendingGrades,
      };
    }

    if (role === "ADMIN") {
      // Also add college-level stats
      const branchCount = await prisma.branch.count({ where: { collegeId } });
      const teacherCount = await prisma.user.count({ where: { collegeId, role: "TEACHER" } });
      const studentCount = await prisma.user.count({ where: { collegeId, role: "STUDENT" } });
      const examTotal = await prisma.exam.count({ where: { collegeId } });
      stats.college = { branchCount, teacherCount, studentCount, examTotal };
    }

    if (role === "STUDENT") {
      const student = await prisma.user.findUnique({
        where: { id: userId },
        select: { collegeId: true, branchId: true, batchId: true },
      });
      const availableExams = student
        ? await prisma.exam.count({
            where: {
              status: { in: ["PUBLISHED", "ACTIVE"] },
              ...studentExamAccessWhere(student),
            },
          })
        : 0;
      const completedAttempts = await prisma.attempt.count({
        where: { userId, status: { in: ["SUBMITTED", "TIMED_OUT", "CHEATED"] } },
      });
      const inProgressAttempt = await prisma.attempt.findFirst({
        where: { userId, status: "IN_PROGRESS" },
        include: { exam: { select: { title: true, duration: true } } },
      });

      // Calculate average score
      const avgResult = await prisma.result.aggregate({
        where: { studentId: userId },
        _avg: { percentage: true },
      });

      stats = {
        role,
        availableExams,
        completedAttempts,
        inProgressAttempt,
        avgPercentage: avgResult._avg.percentage !== null
          ? Math.round(avgResult._avg.percentage)
          : null,
      };
    }

    if (role === "SUPER_ADMIN") {
      const collegeCount = await prisma.college.count({ where: { deletedAt: null } });
      const trialCount = await prisma.college.count({ where: { subscriptionStatus: "TRIAL", deletedAt: null } });
      const activeCount = await prisma.college.count({ where: { subscriptionStatus: "ACTIVE", deletedAt: null } });
      const suspendedCount = await prisma.college.count({
        where: { subscriptionStatus: { in: ["SUSPENDED", "TRIAL_EXPIRED"] }, deletedAt: null },
      });
      stats = { role, collegeCount, trialCount, activeCount, suspendedCount };
    }

    return Response.json({ success: true, stats });
  } catch (error) {
    return errorResponse(error, 500);
  }
}