import prisma from "@/lib/prisma";
import { autoGradeAttempt } from "./grading.service.js";
import {
  BROWSER_VIOLATIONS,
  BROWSER_STRIKE_LIMIT,
  FACE_VIOLATIONS,
  FACE_STRIKE_LIMIT,
} from "@/lib/proctoring-rules";

/**
 * Service to handle student exam attempts.
 */

// Saves that arrive shortly after expiry (network latency on the final
// heartbeat) are still accepted, then the attempt is closed.
const SUBMIT_GRACE_MS = 30 * 1000;

const FINAL_STATUSES = ["SUBMITTED", "TIMED_OUT", "CHEATED"];

// ---------------------------------------------------------------------------
// Cohort targeting — the single source of truth for "can this student see
// this exam?". An exam is visible when it belongs to the student's college
// AND either has no targeting rows (college-wide) or a row that matches the
// student's batch, branch, or is explicitly college-wide.
// ---------------------------------------------------------------------------
export function studentExamAccessWhere(user) {
  const matches = [{ branchId: null, batchId: null }];
  if (user.batchId) matches.push({ batchId: user.batchId });
  if (user.branchId) matches.push({ branchId: user.branchId, batchId: null });

  return {
    collegeId: user.collegeId,
    OR: [
      { access: { none: {} } },
      { access: { some: { OR: matches } } },
    ],
  };
}

export function studentCanAccessExam(exam, user) {
  if (!user?.collegeId || exam.collegeId !== user.collegeId) return false;
  if (!exam.access || exam.access.length === 0) return true;
  return exam.access.some(acc =>
    (!acc.branchId && !acc.batchId) ||
    (acc.batchId && acc.batchId === user.batchId) ||
    (!acc.batchId && acc.branchId && acc.branchId === user.branchId)
  );
}

export async function getAvailableExams(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { branchId: true, batchId: true, collegeId: true }
  });

  if (!user) throw new Error("User not found");

  // Status is not DRAFT (includes PUBLISHED, ACTIVE, COMPLETED)
  const exams = await prisma.exam.findMany({
    where: {
      status: { in: ['PUBLISHED', 'ACTIVE', 'COMPLETED'] },
      ...studentExamAccessWhere(user),
    },
    include: {
      subject: true,
      attempts: {
        where: { userId },
        select: { id: true, status: true, score: true }
      }
    }
  });

  return exams;
}

export async function startAttempt(userId, examId) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check if exam exists and is active/ready
    const exam = await tx.exam.findUnique({
      where: { id: examId },
      include: {
        access: true
      }
    });

    if (!exam) throw new Error("Exam not found");

    // 2. Check if student is in the allowed college/branch/batch
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { branchId: true, batchId: true, collegeId: true }
    });

    if (!user || !studentCanAccessExam(exam, user)) {
      throw new Error("You are not authorized for this assessment");
    }

    const now = new Date();

    // JIT Activation & Window Enforcement
    let currentStatus = exam.status;
    if (currentStatus === 'PUBLISHED') {
        const isStarted = exam.startTime ? now >= exam.startTime : true;
        const isEnded = exam.endTime ? now > exam.endTime : false;

        if (isStarted && !isEnded) {
            // Auto-activate the exam
            await tx.exam.update({
                where: { id: examId },
                data: { status: 'ACTIVE' }
            });
            currentStatus = 'ACTIVE';
        } else if (!isStarted) {
            throw new Error("This assessment has not started yet.");
        } else if (isEnded) {
            throw new Error("The assessment window has closed.");
        }
    }

    // 3. Check for existing attempt (resume) — before the window check, so a
    //    student mid-exam can reload the page even at the very end.
    const existing = await tx.attempt.findUnique({
      where: { userId_examId: { userId, examId } },
      include: { answers: { select: { questionId: true, selectedOptions: true, subjectiveText: true } } }
    });

    if (existing) {
      if (existing.status !== 'IN_PROGRESS') {
        throw new Error("You have already completed this assessment.");
      }
      // Resume if in progress (answers + strike counts included for cross-device restore)
      const faceStrikes = await tx.proctorLog.count({
        where: { attemptId: existing.id, event: { in: FACE_VIOLATIONS } }
      });
      return { ...existing, faceStrikes };
    }

    if (currentStatus !== 'ACTIVE') throw new Error("Exam is not active");

    // Check if window is closed for already ACTIVE exams too (for safety)
    if (exam.endTime && now > exam.endTime) {
        throw new Error("The assessment window has closed.");
    }

    // 4. Create new attempt. Never let the attempt outlive the exam window.
    let expiresAt = new Date(now.getTime() + exam.duration * 60 * 1000);
    if (exam.endTime && exam.endTime < expiresAt) expiresAt = exam.endTime;

    const attempt = await tx.attempt.create({
      data: {
        userId,
        examId,
        expiresAt,
        status: 'IN_PROGRESS'
      }
    });

    return { ...attempt, answers: [], faceStrikes: 0 };
  });
}

export async function syncAnswers(userId, attemptId, answers) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      expiresAt: true,
      status: true,
      userId: true,
      exam: { select: { questions: { select: { questionId: true } } } }
    }
  });

  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
  if (attempt.status !== 'IN_PROGRESS') throw new Error("Attempt is already finalized");

  const now = Date.now();
  const expiresAt = attempt.expiresAt.getTime();

  // Way past expiry: reject the payload (anti-cheat) and close the attempt.
  if (now > expiresAt + SUBMIT_GRACE_MS) {
      await submitAttempt(userId, attemptId);
      throw new Error("Time expired. Assessment has been automatically submitted.");
  }

  // Only accept answers for questions that are part of this exam
  const validQuestionIds = new Set(attempt.exam.questions.map(q => q.questionId));

  for (const ans of answers || []) {
      if (!ans?.questionId || !validQuestionIds.has(ans.questionId)) continue;

      const data = {
          selectedOptions: Array.isArray(ans.selectedOptions) ? ans.selectedOptions.map(String) : [],
          subjectiveText: typeof ans.subjectiveText === "string" ? ans.subjectiveText : null,
          clientSavedAt: ans.clientSavedAt ? new Date(ans.clientSavedAt) : null,
          serverSavedAt: new Date(),
          syncStatus: "SYNCED",
      };
      if (data.clientSavedAt && Number.isNaN(data.clientSavedAt.getTime())) data.clientSavedAt = null;

      await prisma.answer.upsert({
         where: { attemptId_questionId: { attemptId, questionId: ans.questionId } },
         update: data,
         create: { attemptId, questionId: ans.questionId, ...data }
      });
  }

  // Within the grace window after expiry: answers are saved, now close it.
  if (now > expiresAt) {
      await submitAttempt(userId, attemptId);
      throw new Error("Time expired. Assessment has been automatically submitted.");
  }

  return { success: true };
}

export async function submitAttempt(userId, attemptId) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId }
  });

  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");
  if (FINAL_STATUSES.includes(attempt.status)) return attempt;

  const isLate = Date.now() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS;

  // Conditional update guards against double-submit races
  const { count } = await prisma.attempt.updateMany({
    where: { id: attemptId, status: 'IN_PROGRESS' },
    data: {
      status: isLate ? 'TIMED_OUT' : 'SUBMITTED',
      submittedAt: new Date()
    }
  });

  if (count > 0) {
    // Trigger auto-grading
    await autoGradeAttempt(attemptId);
  }

  return prisma.attempt.findUnique({ where: { id: attemptId } });
}

/**
 * Handle proctoring events and enforcement.
 *  - Browser violations (tab switch, fullscreen exit, extra display) → flagCount
 *  - Face/camera violations → counted from the ProctorLog
 * Each has its own limit; reaching either ends the attempt as CHEATED.
 */
export async function logProctorEvent(userId, attemptId, event, metadata = {}) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { userId: true, flagCount: true, status: true }
  });

  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found");

  const countFaceStrikes = () =>
    prisma.proctorLog.count({ where: { attemptId, event: { in: FACE_VIOLATIONS } } });

  if (attempt.status !== 'IN_PROGRESS') {
    return { status: attempt.status, flagCount: attempt.flagCount, faceStrikes: await countFaceStrikes() };
  }

  const eventName = String(event).slice(0, 64);
  const isBrowserViolation = BROWSER_VIOLATIONS.includes(eventName);
  const isFaceViolation = FACE_VIOLATIONS.includes(eventName);

  const newFlagCount = isBrowserViolation ? attempt.flagCount + 1 : attempt.flagCount;
  const priorFaceStrikes = await countFaceStrikes();
  const newFaceStrikes = isFaceViolation ? priorFaceStrikes + 1 : priorFaceStrikes;

  const terminationReason =
    newFlagCount >= BROWSER_STRIKE_LIMIT ? "BROWSER_VIOLATIONS"
    : newFaceStrikes >= FACE_STRIKE_LIMIT ? "FACE_VIOLATIONS"
    : null;
  const shouldTerminate = !!terminationReason;

  const safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      flagCount: newFlagCount,
      status: shouldTerminate ? 'CHEATED' : 'IN_PROGRESS',
      submittedAt: shouldTerminate ? new Date() : null,
      logs: {
        create: {
          event: eventName,
          metadata: {
            ...safeMetadata,
            strike: isBrowserViolation ? newFlagCount : isFaceViolation ? newFaceStrikes : undefined,
            strikeType: isBrowserViolation ? "browser" : isFaceViolation ? "face" : undefined,
            terminationReason: terminationReason || undefined,
          }
        }
      }
    }
  });

  // If terminated, trigger auto-grading for whatever progress they made
  if (shouldTerminate) {
    await autoGradeAttempt(attemptId);
  }

  return {
    status: updated.status,
    flagCount: updated.flagCount,
    faceStrikes: newFaceStrikes,
    wasTerminated: shouldTerminate,
    terminationReason,
  };
}
