import prisma from "@/lib/prisma.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

export async function GET(req) {
  try {
    const auth = await requireAuth(req);

    // Explicit allow-list — never return passwordHash / reset tokens
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        requirePasswordChange: true,
        collegeId: true,
        branchId: true,
        batchId: true,
        createdAt: true,
        updatedAt: true,
        college: { select: { name: true, deletedAt: true } },
        branch: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true, graduationYear: true } },
      },
    });

    if (!user || user.college?.deletedAt) {
      return Response.json({ success: false, message: "User not found" }, { status: 401 });
    }

    const { college, ...rest } = user;
    return Response.json({
      success: true,
      user: { ...rest, college: college ? { name: college.name } : null },
    });
  } catch (error) {
    return errorResponse(error, 401);
  }
}
