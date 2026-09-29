// POST /api/auth/register
// Public self-registration is disabled for this multi-tenant SaaS: every
// account must belong to a college. Colleges onboard via /get-started and
// their admins provision teachers & students.
export async function POST() {
  return Response.json(
    {
      success: false,
      message:
        "Self-registration is disabled. Ask your institution admin for an account, or register your college at /get-started.",
    },
    { status: 403 }
  );
}
