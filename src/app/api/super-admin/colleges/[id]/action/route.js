import prisma from "@/lib/prisma.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// POST /api/super-admin/colleges/[id]/action
// Super admin can SUSPEND, RESTORE or DELETE a college.
// Cancellation is the college's own action via /api/account/cancel.
export async function POST(req, { params }) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const { id } = await params;
    const { action } = await req.json();

    const college = await prisma.college.findUnique({ where: { id } });
    if (!college) return Response.json({ success: false, message: "College not found" }, { status: 404 });

    let update = {};

    if (action === "SUSPEND") {
      if (college.subscriptionStatus === "SUSPENDED") {
        return Response.json({ success: false, message: "College is already suspended" }, { status: 400 });
      }
      update = { subscriptionStatus: "SUSPENDED" };

    } else if (action === "RESTORE") {
      // Restore from: SUSPENDED, CANCELLED, TRIAL_EXPIRED, or soft-deleted
      update = {
        subscriptionStatus: "TRIAL_EXPIRED",
        scheduledDeletionAt: null,
        deletedAt: null,
        deletionReason: null,
      };

      // Also remove any pending cancellation request
      await prisma.cancellationRequest.deleteMany({
        where: { collegeId: id }
      });

    } else if (action === "DELETE") {
      // HARD DELETE — Cascades to users, exams, branches, etc. via schema rules
      await prisma.college.delete({ where: { id } });
      return Response.json({ success: true, message: "College and all related data deleted permanently" });

    } else {
      return Response.json(
        { success: false, message: `Unknown action "${action}". Super admin can SUSPEND, RESTORE, or DELETE.` },
        { status: 400 }
      );
    }

    const updated = await prisma.college.update({ where: { id }, data: update });
    return Response.json({ success: true, college: updated });
  } catch (err) {
    return errorResponse(err, 500);
  }
}
