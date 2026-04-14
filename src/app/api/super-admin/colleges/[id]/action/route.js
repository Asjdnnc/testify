import prisma from "@/lib/prisma.js";
import { cookies } from "next/headers";

async function requireSuperAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("testify-token")?.value;
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    );
    if (payload.role !== "SUPER_ADMIN") throw Object.assign(new Error("Forbidden"), { status: 403 });
    return payload;
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }
}

// POST /api/super-admin/colleges/[id]/action
// Super admin can SUSPEND, RESTORE or DELETE a college.
// Cancellation is the college's own action via /api/account/cancel.
export async function POST(req, { params }) {
  try {
    await requireSuperAdmin();
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
    return Response.json({ success: false, message: err.message }, { status: err.status || 500 });
  }
}
