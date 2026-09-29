import prisma from "../prisma.js";

// ---------------------------------------------------------------------------
// Subscription Decision Tree (Section 12 of spec)
// ---------------------------------------------------------------------------
// 1. collegeId comes from the VERIFIED JWT (see src/lib/server-auth.js).
// 2. Fetch college (404 if deletedAt set or not found).
// 3. TRIAL        → check trialEndsAt, auto-flip to TRIAL_EXPIRED if past.
//                   On write ops: enforce resource limits (done in service layer).
// 4. TRIAL_EXPIRED / SUSPENDED / CANCELLED → 402 (allow GET for TRIAL_EXPIRED).
// 5. ACTIVE       → check currentPeriodEnd, auto-flip to SUSPENDED if past.
// ---------------------------------------------------------------------------

/**
 * Resolves the college for a given collegeId, applying automatic status
 * transitions (TRIAL→TRIAL_EXPIRED, ACTIVE→SUSPENDED) in-band.
 *
 * Returns the college row (with updated status) or throws a structured error.
 */
export async function resolveCollegeSubscription(collegeId) {
  if (!collegeId) {
    throw Object.assign(new Error("No college context"), { statusCode: 400 });
  }

  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      planType: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      deletedAt: true,
    },
  });

  // 404: college deleted or not found
  if (!college || college.deletedAt) {
    throw Object.assign(new Error("College not found"), { statusCode: 404 });
  }

  let status = college.subscriptionStatus;
  const now = new Date();

  // ── Auto-transition: TRIAL → TRIAL_EXPIRED ──────────────────────────────
  if (status === "TRIAL" && college.trialEndsAt && college.trialEndsAt < now) {
    await prisma.college.update({
      where: { id: collegeId },
      data: { subscriptionStatus: "TRIAL_EXPIRED" },
    });
    status = "TRIAL_EXPIRED";
  }

  // ── Auto-transition: ACTIVE → SUSPENDED ─────────────────────────────────
  if (
    status === "ACTIVE" &&
    college.currentPeriodEnd &&
    college.currentPeriodEnd < now
  ) {
    await prisma.college.update({
      where: { id: collegeId },
      data: { subscriptionStatus: "SUSPENDED" },
    });
    status = "SUSPENDED";
  }

  return { ...college, subscriptionStatus: status };
}
