import prisma from "../prisma.js";
import bcrypt from "bcrypt";
import { checkResourceLimit } from "./subscription.service.js";
import { safeQuery } from "../db-retry.js";
import { randomInt } from "crypto";
import { sendTeacherWelcomeEmail } from "../email.js";

const TRIAL_DAYS = 3;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// --- Tenant guards ---
// collegeId === null means "platform scope" (SUPER_ADMIN); otherwise the
// record must belong to that college or we pretend it doesn't exist.
async function assertBranchInCollege(branchId, collegeId) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, collegeId: true } });
  if (!branch || (collegeId && branch.collegeId !== collegeId)) throw httpError(404, "Branch not found");
  return branch;
}

async function assertBatchInCollege(batchId, collegeId) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, branchId: true, branch: { select: { collegeId: true } } }
  });
  if (!batch || (collegeId && batch.branch.collegeId !== collegeId)) throw httpError(404, "Batch not found");
  return batch;
}

async function assertSubjectInCollege(subjectId, collegeId) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, collegeId: true } });
  if (!subject || (collegeId && subject.collegeId !== collegeId)) throw httpError(404, "Subject not found");
  return subject;
}

function devLogCredentials(role, email, password) {
  // Free-tier Resend may suppress emails in development, so show creds locally.
  // NEVER log plaintext passwords in production.
  if (process.env.NODE_ENV === "production") return;
  console.log(`\n========================================`);
  console.log(`👤 NEW ${role} REGISTERED (dev only)`);
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Temp Password: ${password}`);
  console.log(`========================================\n`);
}

// --- College ---
export async function createCollege({ name, address }) {
  if (!name) throw new Error("College name is required");

  // Create college (starts on the standard trial like self-onboarded colleges)
  const college = await prisma.college.create({
    data: {
      name,
      address,
      subscriptionStatus: "TRIAL",
      planType: "TRIAL",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return college;
}

export async function getColleges() {
  return prisma.college.findMany({
    include: {
      _count: {
        select: { users: { where: { role: "ADMIN" } } }
      }
    }
  });
}

export async function getCollegeById(id) {
  const college = await safeQuery(() => prisma.college.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { id: true, name: true, email: true, createdAt: true }
      },
    }
  }));

  if (!college) return null;

  const teacherCount = await safeQuery(() => prisma.user.count({ where: { collegeId: id, role: "TEACHER" } }));
  const studentCount = await safeQuery(() => prisma.user.count({ where: { collegeId: id, role: "STUDENT" } }));

  return { ...college, teacherCount, studentCount };
}


export async function updateCollege(id, { name, address }) {
  return prisma.college.update({
    where: { id },
    data: { name, address }
  });
}

export async function getUsersByCollege(collegeId, role) {
  return prisma.user.findMany({
    where: { collegeId, role },
    select: { id: true, name: true, email: true, createdAt: true, batchId: true, branchId: true }
  });
}

export async function getUsersByBatch(batchId, collegeId) {
  return prisma.user.findMany({
    where: { batchId, role: "STUDENT", collegeId },
    select: { id: true, name: true, email: true, createdAt: true }
  });
}

/**
 * Generates a random 12-character password using a CSPRNG.
 */
function generateRandomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(randomInt(chars.length));
  }
  return password;
}

export async function createUserForCollege(collegeId, { name, email, password, role, batchId, branchId }) {
  if (!name || !email || !role || !collegeId) throw new Error("Missing required user data");

  const normalizedRole = role.toUpperCase();
  if (!["ADMIN", "TEACHER", "STUDENT"].includes(normalizedRole)) throw new Error("Invalid role");

  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true, deletedAt: true } });
  if (!college || college.deletedAt) throw new Error("College not found");
  
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("User with this email already exists");

  // Tenant isolation: branch/batch must live in this college (and match each other)
  if (branchId) await assertBranchInCollege(branchId, collegeId);
  if (batchId) {
    const batch = await assertBatchInCollege(batchId, collegeId);
    if (branchId && batch.branchId !== branchId) throw new Error("Batch does not belong to the selected branch");
    branchId = branchId || batch.branchId;
  }
  if (normalizedRole === "STUDENT" && !batchId) throw new Error("Students must be assigned to a batch");

  // Enforce plan limits for TEACHER and STUDENT roles
  if (normalizedRole === "TEACHER") await checkResourceLimit(collegeId, "teachers");
  if (normalizedRole === "STUDENT") await checkResourceLimit(collegeId, "students");

  let finalPassword = password;
  let requirePasswordChange = false;

  // If no password provided, generate one and trigger invitation email
  if (!finalPassword) {
    finalPassword = generateRandomPassword();
    requirePasswordChange = true;
  }

  if (finalPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const hashedPassword = await bcrypt.hash(finalPassword, 10);
  
  const relationData = {};
  if (collegeId) relationData.college = { connect: { id: collegeId } };
  if (branchId) relationData.branch = { connect: { id: branchId } };
  if (batchId) relationData.batch = { connect: { id: batchId } };
  
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashedPassword,
      role: normalizedRole,
      requirePasswordChange,
      ...relationData
    }
  });

  // If we generated a password, send the welcome email
  if (requirePasswordChange) {
    const collegeRow = await safeQuery(() => prisma.college.findUnique({ 
      where: { id: collegeId },
      select: { name: true }
    }));

    devLogCredentials(normalizedRole, email, finalPassword);

    await sendTeacherWelcomeEmail({
      to: email,
      name,
      tempPassword: finalPassword,
      collegeName: collegeRow?.name || "Your Institution"
    }).catch(err => console.error("[EMAIL_ERROR] Failed to send single user invite:", err.message));
  }

  return user;
}

/**
 * Creates multiple teachers from a list, generates random passwords, 
 * and sends welcome emails.
 */
export async function createTeachersBatch(collegeId, teachersList) {
  if (!collegeId || !Array.isArray(teachersList)) {
    throw new Error("Invalid input: collegeId and teachersList (array) are required");
  }

  // Get college name for email branding
  const college = await prisma.college.findUnique({ 
    where: { id: collegeId },
    select: { name: true }
  });

  const results = {
    total: teachersList.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (const t of teachersList) {
    try {
      if (!t.name || !t.email) {
        throw new Error(`Missing name or email for entry: ${JSON.stringify(t)}`);
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email: t.email } });
      if (existingUser) {
        throw new Error(`Email ${t.email} is already registered`);
      }

      // Check teacher limit
      await checkResourceLimit(collegeId, "teachers");

      // Generate credentials
      const tempPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create user
      await prisma.user.create({
        data: {
          name: t.name,
          email: t.email,
          passwordHash: hashedPassword,
          role: "TEACHER",
          collegeId,
          requirePasswordChange: true // Force reset on first login
        }
      });

      devLogCredentials("TEACHER", t.email, tempPassword);

      // Send email (the account exists at this point, so an email failure is not a row failure)
      await sendTeacherWelcomeEmail({
        to: t.email,
        name: t.name,
        tempPassword,
        collegeName: college?.name || "Your Institution"
      }).catch(err => console.error(`[EMAIL_ERROR] ${t.email}:`, err.message));

      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ email: t.email || "Unknown", error: err.message });
      // We don't stop the whole batch for one failure, but we log it.
      console.error(`[BATCH_UPLOAD_ERROR] ${t.email}:`, err.message);
    }
  }

  return results;
}

/**
 * Creates multiple students from a list, resolves branch/batch names to IDs,
 * generates random passwords, and sends welcome emails.
 */
export async function createStudentsBatch(collegeId, studentsList) {
  if (!collegeId || !Array.isArray(studentsList)) {
    throw new Error("Invalid input: collegeId and studentsList (array) are required");
  }

  // 1. Pre-fetch all branches and their batches for lookups
  const branches = await prisma.branch.findMany({
    where: { collegeId },
    include: { batches: true }
  });

  const branchMap = {};
  const batchMap = {}; // { branchId: { batchName: batchId } }

  branches.forEach(br => {
    branchMap[br.name.toLowerCase()] = br.id;
    batchMap[br.id] = {};
    br.batches.forEach(ba => {
      batchMap[br.id][ba.name.toLowerCase()] = ba.id;
    });
  });

  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { name: true } });

  const results = {
    total: studentsList.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (const s of studentsList) {
    try {
      if (!s.name || !s.email || !s.branch || !s.batch) {
        throw new Error(`Missing required fields. Expected: name, email, branch, batch`);
      }

      // Resolve IDs
      const branchId = branchMap[s.branch.toLowerCase()];
      if (!branchId) throw new Error(`Branch '${s.branch}' not found in your college`);

      const batchId = batchMap[branchId][s.batch.toString().toLowerCase()];
      if (!batchId) throw new Error(`Batch '${s.batch}' not found in branch '${s.branch}'`);

      // Check existence
      const existingUser = await prisma.user.findUnique({ where: { email: s.email } });
      if (existingUser) throw new Error(`Email ${s.email} is already registered`);

      // Check limit
      await checkResourceLimit(collegeId, "students");

      // Generate credentials
      const tempPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create student
      await prisma.user.create({
        data: {
          name: s.name,
          email: s.email,
          passwordHash: hashedPassword,
          role: "STUDENT",
          collegeId,
          branchId,
          batchId,
          requirePasswordChange: true
        }
      });

      devLogCredentials("STUDENT", s.email, tempPassword);

      // Send email (the account exists at this point, so an email failure is not a row failure)
      await sendTeacherWelcomeEmail({
        to: s.email,
        name: s.name,
        tempPassword,
        collegeName: college?.name || "Your Institution"
      }).catch(err => console.error(`[EMAIL_ERROR] ${s.email}:`, err.message));

      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ email: s.email || "Unknown", error: err.message });
      console.error(`[STUDENT_BATCH_ERROR] ${s.email}:`, err.message);
    }
  }

  return results;
}

// --- Branch ---

/**
 * Ensures that all branches in a college have a batch for the upcoming 
 * academic intake (Annual check triggered around July 1st).
 */
export async function ensureAnnualBatches(collegeId) {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed, so 6 is July
  const currentYear = now.getFullYear();

  // If before July, we are in the previous academic cycle, but we can still 
  // ensure batches for the *upcoming* intake starting July.
  // Standard graduation year is currentYear + 4
  const targetGradYear = currentYear + (currentMonth >= 6 ? 4 : 3);
  const batchName = `${targetGradYear}`;

  const branches = await prisma.branch.findMany({ 
    where: { collegeId },
    select: { id: true, name: true } // Minimum fields required
  });
  
  const created = [];
  for (const branch of branches) {
    const existing = await prisma.batch.findUnique({
      where: {
        name_branchId: {
          name: batchName,
          branchId: branch.id
        }
      }
    });

    if (!existing) {
      const newBatch = await prisma.batch.create({
        data: {
          name: batchName,
          graduationYear: targetGradYear,
          branchId: branch.id
        }
      });
      created.push({ branch: branch.name, batch: batchName });
    }
  }

  return created;
}

/**
 * Gets all unique graduation years currently defined in the college.
 * Used for building branching/batching relationship UI.
 */
export async function getCollegeBatchYears(collegeId) {
  const years = await prisma.batch.findMany({
    where: { branch: { collegeId } },
    select: { graduationYear: true, name: true },
    distinct: ['graduationYear']
  });
  return years.sort((a,b) => a.graduationYear - b.graduationYear);
}

export async function createBranch({ name, collegeId, batchYears = [] }) {
  if (!name || !collegeId) throw new Error("Branch name and collegeId are required");

  // Check if college exists
  const collegeExists = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!collegeExists) throw new Error("Invalid collegeId");

  // Ensure unique branch name per college
  const existingBranch = await prisma.branch.findUnique({
    where: { name_collegeId: { name, collegeId } },
  });
  if (existingBranch) throw new Error("Branch already exists for this college");

  // Atomic creation of branch and requested batches
  const branch = await prisma.branch.create({
    data: {
      name,
      collegeId,
      batches: {
        create: batchYears.map(year => ({
          name: `${year}`,
          graduationYear: parseInt(year, 10)
        })).filter(b => !Number.isNaN(b.graduationYear))
      }
    },
    include: { batches: true }
  });

  return branch;
}

export async function getBranchesByCollege(collegeId) {
  return prisma.branch.findMany({
    where: { collegeId },
    select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
            select: { batches: true }
        }
    }
  });
}

// --- Batch ---
export async function createBatch({ name, graduationYear, branchId, collegeId = null }) {
  if (!name || !graduationYear || !branchId) {
    throw new Error("Batch name, graduationYear, and branchId are required");
  }
  if (Number.isNaN(parseInt(graduationYear, 10))) throw new Error("graduationYear must be a number");

  // Check the branch exists and belongs to the caller's college
  await assertBranchInCollege(branchId, collegeId);

  // Batches are unlimited on all plans — no limit check needed


  // Ensure unique batch per branch
  const existingBatch = await prisma.batch.findUnique({
    where: {
      name_branchId: {
        name,
        branchId,
      },
    },
  });

  if (existingBatch) throw new Error("Batch already exists for this branch");

  const batch = await prisma.batch.create({
    data: {
      name,
      graduationYear: parseInt(graduationYear, 10),
      branchId,
    },
  });

  return batch;
}

export async function getBatchesByBranch(branchId, collegeId = null) {
  await assertBranchInCollege(branchId, collegeId);
  return prisma.batch.findMany({
    where: { branchId },
    select: {
        id: true,
        name: true,
        graduationYear: true,
        createdAt: true
    }
  });
}

// --- Subject ---
export async function createSubject({ name, code, collegeId, credits }) {
  if (!name || !collegeId) throw new Error("Name and collegeId are required");
  
  return prisma.subject.create({
    data: {
      name,
      code: code || null,
      collegeId,
      credits: credits ? parseInt(credits, 10) : 3,
    }
  });
}

/**
 * Creates multiple subjects from a list, handles both object arrays and 
 * formatted strings.
 */
export async function createSubjectsBatch(collegeId, subjectsList) {
  if (!collegeId || !Array.isArray(subjectsList)) {
    throw new Error("Invalid input: collegeId and subjectsList (array) are required");
  }

  const results = {
    total: subjectsList.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (const s of subjectsList) {
    try {
      let finalName = s.name;
      let finalCode = s.code;
      let finalCredits = s.credits ? parseInt(s.credits, 10) : 3;

      if (!finalName) {
        throw new Error("Subject name is required");
      }

      // Check for duplicates within this batch operation
      const existingName = await prisma.subject.findUnique({
        where: { name_collegeId: { name: finalName, collegeId } }
      });
      if (existingName) throw new Error(`Subject with name "${finalName}" already exists`);

      if (finalCode) {
        const existingCode = await prisma.subject.findUnique({
          where: { code_collegeId: { code: finalCode, collegeId } }
        });
        if (existingCode) throw new Error(`Subject with code "${finalCode}" already exists`);
      }

      await prisma.subject.create({
        data: {
          name: finalName,
          code: finalCode || null,
          credits: finalCredits,
          collegeId
        }
      });

      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ name: s.name || "Unknown", error: err.message });
      console.error(`[SUBJECT_BATCH_ERROR] ${s.name}:`, err.message);
    }
  }

  return results;
}

export async function getSubjectsByCollege(collegeId) {
  return prisma.subject.findMany({
    where: { collegeId },
    orderBy: { name: 'asc' }
  });
}

export async function updateSubject(id, collegeId, { name, code, credits }) {
  await assertSubjectInCollege(id, collegeId);
  return prisma.subject.update({
    where: { id },
    data: { 
      name: name || undefined,
      code: code !== undefined ? (code || null) : undefined,
      credits: credits !== undefined && !Number.isNaN(parseInt(credits, 10)) ? parseInt(credits, 10) : undefined,
    }
  });
}

export async function deleteSubject(id, collegeId) {
  await assertSubjectInCollege(id, collegeId);
  const [examCount, questionCount] = await Promise.all([
    prisma.exam.count({ where: { subjectId: id } }),
    prisma.question.count({ where: { subjectId: id } }),
  ]);
  if (examCount > 0 || questionCount > 0) {
    throw new Error("This subject still has exams or questions attached. Remove them first.");
  }
  return prisma.subject.delete({
    where: { id }
  });
}

// --- Delete User ---
export async function deleteUser(userId, adminCollegeId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.collegeId !== adminCollegeId) throw new Error("Forbidden: user belongs to a different college");
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") throw new Error("Cannot delete admin accounts via this route");
  return prisma.user.delete({ where: { id: userId } });
}

// --- Update Branch ---
export async function updateBranch(id, collegeId, { name }) {
  if (!name) throw new Error("Branch name is required");
  await assertBranchInCollege(id, collegeId);
  return prisma.branch.update({ where: { id }, data: { name } });
}

// --- Delete Branch ---
export async function deleteBranch(id, collegeId) {
  await assertBranchInCollege(id, collegeId);
  return prisma.branch.delete({ where: { id } });
}

// --- Update Batch ---
export async function updateBatch(id, collegeId, { name, graduationYear }) {
  await assertBatchInCollege(id, collegeId);
  const data = {};
  if (name) data.name = name;
  if (graduationYear && !Number.isNaN(parseInt(graduationYear, 10))) data.graduationYear = parseInt(graduationYear, 10);
  return prisma.batch.update({ where: { id }, data });
}

// --- Delete Batch ---
export async function deleteBatch(id, collegeId) {
  await assertBatchInCollege(id, collegeId);
  return prisma.batch.delete({ where: { id } });
}
