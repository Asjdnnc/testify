import { initiatePayment } from "@/lib/services/payment.service.js";
import { requireAuth, errorResponse } from "@/lib/server-auth.js";

// POST /api/payments/initiate
// Body: { planType: "STARTER" | "PROFESSIONAL" | "ENTERPRISE", gateway?: "razorpay" }
// Not subscription-gated on purpose: expired/suspended colleges must be able to pay.
export async function POST(req) {
  try {
    const auth = await requireAuth(req, { roles: ["ADMIN"] });

    const { planType, gateway = "razorpay" } = await req.json();

    if (!planType) {
      return Response.json(
        { success: false, message: "planType is required" },
        { status: 400 }
      );
    }

    const result = await initiatePayment(auth.collegeId, planType, gateway);

    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
