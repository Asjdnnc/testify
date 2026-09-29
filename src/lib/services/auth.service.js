import prisma from "../prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export function signAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      collegeId: user.collegeId,
      branchId: user.branchId || null,
      batchId: user.batchId || null,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "7d",
    }
  );
}

// NOTE: public self-registration was removed. In a multi-tenant SaaS every
// user must belong to a college, so accounts are created only through
// onboarding (college admins) or by an ADMIN (teachers / students).

export async function loginUser({ email, password }) {
  if (!email || !password) throw new Error("Email and password are required");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { college: { select: { name: true, deletedAt: true } } }
  });

  // Same message for unknown email and wrong password — prevents account enumeration
  const invalid = new Error("Invalid email or password");

  if (!user) {
    throw invalid;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw invalid;
  }

  if (user.role !== "SUPER_ADMIN" && (!user.collegeId || user.college?.deletedAt)) {
    throw new Error("This institution account is no longer active. Please contact support.");
  }

  const token = signAuthToken(user);

  //we dont want to give the password back to the user, so we destructure it out and return the rest of the user data as safeUser
  const { passwordHash: _, resetPasswordToken: __, resetPasswordExpires: ___, college, ...safeUser } = user;

  return {
    token,
    user: {
      ...safeUser,
      college: college ? { name: college.name } : null,
      requirePasswordChange: user.requirePasswordChange,
    },
  };
}

/**
 * Updates a user's password and clears the requirePasswordChange flag.
 */
export async function updateUserPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      requirePasswordChange: false // Clear the flag
    }
  });

  return { success: true };
}
