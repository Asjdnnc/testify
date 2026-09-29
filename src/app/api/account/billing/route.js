import { getCollegeUsage } from "@/lib/services/subscription.service.js";
import { resolveCollegeSubscription } from "@/lib/middlewares/subscription.middleware.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";
import prisma from "@/lib/prisma.js";

// GET /api/account/billing
// Returns: college subscription status + resource usage
// Intentionally NOT subscription-gated: locked colleges must still reach billing to pay.
export async function GET(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"] });

    const college = await resolveCollegeSubscription(auth.collegeId);
    const usage = await getCollegeUsage(auth.collegeId);
    const cancellation = await prisma.cancellationRequest.findUnique({
      where: { collegeId: auth.collegeId },
      select: { scheduledAt: true, processedAt: true },
    });

    return Response.json({
      success: true,
      billing: {
        subscriptionStatus: college.subscriptionStatus,
        planType: college.planType,
        plan: usage?.plan || college.planType,
        trialEndsAt: college.trialEndsAt,
        currentPeriodEnd: college.currentPeriodEnd,
        cancellationScheduledAt: cancellation?.scheduledAt || null,
        usage: usage?.usage || null,
        features: usage?.features || null,
      },
    });
  } catch (error) {
    return errorResponse(error, 500);
  }
}
