import prisma from "@/lib/prisma.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// GET /api/super-admin/plans — list all plans
export async function GET(req) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceInPaise: "asc" },
    });
    return Response.json({ success: true, plans });
  } catch (err) {
    return errorResponse(err, 500);
  }
}

// PATCH /api/super-admin/plans — update a plan by planType
export async function PATCH(req) {
  try {
    await requireAuth(req, { roles: ["SUPER_ADMIN"] });
    const body = await req.json();
    const { planType, ...updates } = body;

    if (!planType) return Response.json({ success: false, message: "planType is required" }, { status: 400 });

    // Only allow safe numeric/boolean fields to be updated
    const allowed = ["maxBranches", "maxBatches", "maxTeachers", "maxStudents", "maxExams",
                     "priceInPaise", "durationDays", "isActive", "features", "name"];
    const safeUpdates = {};
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { planType },
      data: safeUpdates,
    });

    return Response.json({ success: true, plan });
  } catch (err) {
    return errorResponse(err, 500);
  }
}
