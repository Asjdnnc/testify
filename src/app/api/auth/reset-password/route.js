import prisma from "@/lib/prisma.js";
import bcrypt from "bcrypt";

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return Response.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ success: false, message: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Find user with this reset token AND ensure it hasn't expired
    const user = await prisma.user.findUnique({
      where: { resetPasswordToken: token }
    });

    if (!user) {
      return Response.json({ success: false, message: "Invalid or expired reset link" }, { status: 400 });
    }

    if (!user.resetPasswordExpires || new Date() > new Date(user.resetPasswordExpires)) {
       return Response.json({ success: false, message: "This password reset link has expired" }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the password and instantly nullify the tokens to prevent replay attacks
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        requirePasswordChange: false
      }
    });

    return Response.json({ success: true, message: "Password reset correctly!" });

  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error);
    return Response.json({ success: false, message: "Server error handling your request" }, { status: 500 });
  }
}
