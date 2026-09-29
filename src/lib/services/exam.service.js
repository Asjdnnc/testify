import prisma from "../prisma.js";
import { autoGradeAttempt } from "./grading.service.js";
import { checkResourceLimit } from "./subscription.service.js";
import { studentCanAccessExam } from "./attempt.service.js";

// --- Tenant validation ---
// Every id that comes from the request body must belong to the caller's college.
async function assertCollegeRefs(collegeId, { subjectId, branchId, batchId }) {
  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { collegeId: true } });
    if (!subject || subject.collegeId !== collegeId) throw new Error("Invalid subject");
  }
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { collegeId: true } });
    if (!branch || branch.collegeId !== collegeId) throw new Error("Invalid branch");
  }
  if (batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { branchId: true, branch: { select: { collegeId: true } } }
    });
    if (!batch || batch.branch.collegeId !== collegeId) throw new Error("Invalid batch");
    if (branchId && batch.branchId !== branchId) throw new Error("Batch does not belong to the selected branch");
  }
}

function toInt(value, fallback = undefined) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

// --- Collision Detection ---
async function checkSchedulingConflict(targetBatchId, targetStartTime, targetEndTime, currentExamId) {
  if (targetStartTime && targetEndTime && targetEndTime <= targetStartTime) {
    throw new Error("End time must be after start time");
  }
  if (!targetBatchId || !targetStartTime || !targetEndTime) return;

  const conflictingExam = await prisma.exam.findFirst({
    where: {
      ...(currentExamId ? { id: { not: currentExamId } } : {}),
      access: {
        some: { batchId: targetBatchId }
      },
      startTime: { lt: targetEndTime },
      endTime: { gt: targetStartTime },
      status: { not: "COMPLETED" } 
    }
  });

  if (conflictingExam) {
    throw new Error(`Scheduling Conflict: Another exam ("${conflictingExam.title}") is already scheduled for this batch during the selected time.`);
  }
}

// --- Exam Creation ---
export async function createDraftExam(teacherId, data) {
  const { title, description, semester, duration, totalMarks, passingMarks, collegeId, subjectId, branchId, batchId } = data;

  if (!title || !duration || !totalMarks || !collegeId || !subjectId) {
    throw new Error("Missing required exam fields");
  }

  // Authorize teacher
  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacher || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN") || teacher.collegeId !== collegeId) {
    throw new Error("Forbidden: Only teachers can create exams");
  }

  const parsedDuration = toInt(duration);
  const parsedTotal = toInt(totalMarks);
  if (!parsedDuration || parsedDuration <= 0) throw new Error("Duration must be a positive number of minutes");
  if (!parsedTotal || parsedTotal <= 0) throw new Error("Total marks must be a positive number");

  await assertCollegeRefs(collegeId, { subjectId, branchId, batchId });

  // Enforce plan limits
  await checkResourceLimit(collegeId, "exams");

  return prisma.exam.create({
    data: {
      title,
      description,
      semester: toInt(semester, null),
      duration: parsedDuration,
      totalMarks: parsedTotal,
      passingMarks: toInt(passingMarks, null),
      status: "DRAFT", // always draft on creation
      collegeId,
      subjectId,
      creatorId: teacherId,
      creatorName: teacher.name,
      access: (branchId || batchId) ? {
        create: {
          branchId: branchId || null,
          batchId: batchId || null
        }
      } : undefined
    }
  });
}

// --- Question Linking & Snapshotting ---
export async function addQuestionToExam(teacherId, examId, questionId, order, marks) {
  // Authorize
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Forbidden: Not your exam");
  if (exam.status !== "DRAFT" && exam.status !== "PUBLISHED") throw new Error("Cannot modify questions for this assessment phase.");

  const question = await prisma.question.findUnique({ 
    where: { id: questionId },
    include: { options: true }
  });
  // Tenant isolation: only questions from the exam's own college bank
  if (!question || question.collegeId !== exam.collegeId) throw new Error("Question not found");

  // Generate initial snapshot
  const correctAnswers = question.options.filter(o => o.isCorrect).map(o => o.label);

  const finalOrder = toInt(order, await prisma.examQuestion.count({ where: { examId } }));
  const finalMarks = toInt(marks, question.defaultMarks);
  if (finalMarks < 0) throw new Error("Marks cannot be negative");
  
  return prisma.examQuestion.create({
    data: {
      examId,
      questionId,
      order: finalOrder,
      marks: finalMarks,
      questionTextSnapshot: question.text,
      optionsSnapshot: JSON.stringify(question.options),
      correctAnswersSnapshot: correctAnswers
    }
  });
}

export async function removeQuestionFromExam(teacherId, examId, questionId) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Forbidden");
  if (exam.status !== "DRAFT" && exam.status !== "PUBLISHED") throw new Error("Cannot modify questions for this assessment phase.");

  return prisma.examQuestion.delete({
    where: { examId_questionId: { examId, questionId } }
  });
}

export async function reorderExamQuestions(teacherId, examId, orderedIds) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Forbidden: Not your exam");
  if (exam.status !== "DRAFT" && exam.status !== "PUBLISHED") throw new Error("Layout is locked for this phase.");

  return prisma.$transaction(
    orderedIds.map((questionId, index) => 
      prisma.examQuestion.update({
        where: { examId_questionId: { examId, questionId } },
        data: { order: index }
      })
    )
  );
}

export async function publishExam(teacherId, examId, timestamps = {}) {
  const { startTime, endTime } = timestamps || {};
  
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { 
      questions: { include: { question: { include: { options: true } } } },
      access: true
    }
  });

  if (!exam || exam.creatorId !== teacherId) throw new Error("Forbidden: Not your exam");
  if (exam.status !== "DRAFT") throw new Error("Exam is already published or live");
  if (exam.questions.length === 0) throw new Error("Cannot publish an exam with zero questions");
  if (startTime && Number.isNaN(new Date(startTime).getTime())) throw new Error("Invalid start time");
  if (endTime && Number.isNaN(new Date(endTime).getTime())) throw new Error("Invalid end time");

  const targetBatchId = exam.access.length > 0 ? exam.access[0].batchId : null;
  const targetStartTime = startTime ? new Date(startTime) : exam.startTime;
  const targetEndTime = endTime ? new Date(endTime) : exam.endTime;

  await checkSchedulingConflict(targetBatchId, targetStartTime, targetEndTime, examId);


  // We perform a "hard snapshot" right before publishing 
  // to ensure any recent edits to the Question Bank are captured.
  await prisma.$transaction(
    exam.questions.map((eq) => {
      const liveQuestion = eq.question;
      const liveCorrect = liveQuestion.options.filter(o => o.isCorrect).map(o => o.label);
      
      return prisma.examQuestion.update({
        where: { examId_questionId: { examId: eq.examId, questionId: eq.questionId } },
        data: {
          questionTextSnapshot: liveQuestion.text,
          optionsSnapshot: JSON.stringify(liveQuestion.options),
          correctAnswersSnapshot: liveCorrect
        }
      });
    })
  );

  return prisma.exam.update({
    where: { id: examId },
    data: {
      status: "PUBLISHED",
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
    }
  });
}

/**
 * Synchronizes snapshots for all exams that are currently in PUBLISHED status
 * when their source question is updated. 
 * This allows "hot-fixes" for typos/clarifications before students start.
 */
export async function syncExamSnapshots(questionId, client = prisma) {
  const linkedExamQuestions = await client.examQuestion.findMany({
    where: { 
      questionId,
      exam: { status: 'PUBLISHED' } 
    },
    include: { question: { include: { options: true } } }
  });

  for (const eq of linkedExamQuestions) {
    const liveQuestion = eq.question;
    const liveCorrect = liveQuestion.options.filter(o => o.isCorrect).map(o => o.label);

    await client.examQuestion.update({
      where: { examId_questionId: { examId: eq.examId, questionId: eq.questionId } },
      data: {
        questionTextSnapshot: liveQuestion.text,
        optionsSnapshot: JSON.stringify(liveQuestion.options),
        correctAnswersSnapshot: liveCorrect
      }
    });
  }
}

// --- Access Management ---
export async function grantExamAccess(teacherId, examId, targetId, isBatch = true) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Forbidden");
  await assertCollegeRefs(exam.collegeId, isBatch ? { batchId: targetId } : { branchId: targetId });

  return prisma.examAccess.create({
     data: {
       examId,
       batchId: isBatch ? targetId : null,
       branchId: !isBatch ? targetId : null
     }
  });
}
export async function getExamsByCreator(teacherId) {
  return prisma.exam.findMany({
    where: { creatorId: teacherId },
    include: {
      subject: true,
      _count: {
        select: { questions: true, attempts: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getExamById(id, teacherId) {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      subject: true,
      questions: {
        orderBy: { order: 'asc' },
        include: { question: { include: { options: { orderBy: { order: 'asc' } } } } }
      },
      access: {
         include: { branch: true, batch: true }
      }
    }
  });

  if (exam && exam.creatorId !== teacherId) throw new Error("Unauthorized");
  return exam;
}

// --- Deterministic Randomization Helpers ---
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function seededShuffle(array, seed) {
  if (!array || array.length <= 1) return array;
  let m = array.length, t, i;
  let seedNum = 0;
  for (let j = 0; j < seed.length; j++) {
    seedNum = (seedNum << 5) - seedNum + seed.charCodeAt(j);
    seedNum |= 0; 
  }
  
  const rnd = mulberry32(seedNum);
  while (m) {
    i = Math.floor(rnd() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

export async function getExamForStudent(id, studentId) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { branchId: true, batchId: true, collegeId: true }
  });

  if (!user) throw new Error("User not found");

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      subject: true,
      questions: {
        orderBy: { order: 'asc' },
        include: { question: { include: { options: { orderBy: { order: 'asc' } } } } }
      },
      access: true
    }
  });

  if (!exam || exam.status === 'DRAFT') throw new Error("Exam not available");

  // Verify tenant + cohort targeting (both must pass)
  if (!studentCanAccessExam(exam, user)) throw new Error("Unauthorized");

  // Questions are only revealed once the student has a live attempt — the
  // lobby only needs metadata, and this stops question-paper leaks before
  // the exam window opens.
  const liveAttempt = await prisma.attempt.findFirst({
    where: { examId: id, userId: studentId, status: 'IN_PROGRESS' },
    select: { id: true }
  });

  const { access: _, questions, ...examMeta } = exam;

  if (!liveAttempt) {
    return { ...examMeta, questionCount: questions.length, questions: [] };
  }

  // Strip sensitive info & apply shuffling
  let questionsToProcess = [...questions];

  // 1. Shuffle Questions if enabled
  if (exam.shuffleQuestions) {
     questionsToProcess = seededShuffle(questionsToProcess, `${studentId}_${exam.id}_q`);
  }

  const secureQuestions = questionsToProcess.map(eq => {
    // Prefer the frozen snapshot (what the exam was published with)
    let finalOptions = eq.question.options;
    if (eq.optionsSnapshot) {
      try {
        const parsed = typeof eq.optionsSnapshot === "string" ? JSON.parse(eq.optionsSnapshot) : eq.optionsSnapshot;
        if (Array.isArray(parsed)) finalOptions = parsed;
      } catch (e) {}
    }

    // Never send the answer key to the browser
    finalOptions = finalOptions.map(({ id, label, text, order }) => ({ id, label, text, order }));

    // 2. Shuffle Options if enabled (and it's an MCQ)
    if (exam.shuffleOptions && eq.question.type !== 'SUBJECTIVE') {
       finalOptions = seededShuffle([...finalOptions], `${studentId}_${exam.id}_opt_${eq.questionId}`);
    }

    return {
      examId: eq.examId,
      questionId: eq.questionId,
      order: eq.order,
      marks: eq.marks,
      questionTextSnapshot: eq.questionTextSnapshot,
      // Sanitised copy for clients that read the snapshot field directly
      optionsSnapshot: JSON.stringify(finalOptions),
      question: {
        id: eq.question.id,
        text: eq.questionTextSnapshot || eq.question.text,
        type: eq.question.type,
        defaultMarks: eq.question.defaultMarks,
        // modelAnswer / creator info intentionally omitted
        options: finalOptions
      }
    };
  });

  return { ...examMeta, questionCount: questions.length, questions: secureQuestions };
}

export async function startExam(teacherId, examId) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Unauthorized");
  if (exam.status !== "PUBLISHED") throw new Error("Only published exams can be started");

  return prisma.exam.update({
    where: { id: examId },
    data: { status: "ACTIVE" }
  });
}

export async function updateExam(id, teacherId, data) {
  const exam = await prisma.exam.findUnique({ where: { id }, include: { access: true } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Unauthorized");
  
  if (exam.status !== "DRAFT" && exam.status !== "PUBLISHED") {
    throw new Error("Only draft and published exams can be modified");
  }

  const { 
    title, description, semester, duration, totalMarks, 
    passingMarks, subjectId, branchId, batchId, 
    startTime, endTime, shuffleQuestions, shuffleOptions 
  } = data;

  await assertCollegeRefs(exam.collegeId, { subjectId, branchId, batchId });

  const targetBatchId = batchId !== undefined ? batchId : (exam.access.length > 0 ? exam.access[0].batchId : null);
  const targetStartTime = startTime !== undefined ? (startTime ? new Date(startTime) : null) : exam.startTime;
  const targetEndTime = endTime !== undefined ? (endTime ? new Date(endTime) : null) : exam.endTime;

  await checkSchedulingConflict(targetBatchId, targetStartTime, targetEndTime, id);

  return prisma.$transaction(async (tx) => {
    // 1. Update core metadata
    const updated = await tx.exam.update({
      where: { id },
      data: {
        title,
        description,
        semester: semester !== undefined ? toInt(semester, null) : undefined,
        duration: toInt(duration) > 0 ? toInt(duration) : undefined,
        totalMarks: toInt(totalMarks) > 0 ? toInt(totalMarks) : undefined,
        passingMarks: passingMarks !== undefined ? toInt(passingMarks, null) : undefined,
        subjectId: subjectId || undefined,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        shuffleQuestions: shuffleQuestions !== undefined ? !!shuffleQuestions : undefined,
        shuffleOptions: shuffleOptions !== undefined ? !!shuffleOptions : undefined
      }
    });

    // 2. Manage Access Control (Atomic Upsert)
    if (branchId || batchId) {
      if (exam.access.length > 0) {
        await tx.examAccess.update({
          where: { id: exam.access[0].id },
          data: {
            branchId: branchId || null,
            batchId: batchId || null
          }
        });
      } else {
        await tx.examAccess.create({
          data: {
            examId: id,
            branchId: branchId || null,
            batchId: batchId || null
          }
        });
      }
    }

    return updated;
  });
}


export async function completeExam(teacherId, examId) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Unauthorized");
  if (exam.status !== "ACTIVE") throw new Error("Only active exams can be terminated");

  const now = new Date();

  const { updated, pendingAttempts } = await prisma.$transaction(async (tx) => {
    // 1. Mark exam as completed
    const updated = await tx.exam.update({
      where: { id: examId },
      data: { 
        status: "COMPLETED",
        endTime: now // Force end time to now
      }
    });

    // 2. Force-submit all in-progress attempts
    const pendingAttempts = await tx.attempt.findMany({
      where: { examId, status: "IN_PROGRESS" },
      select: { id: true }
    });

    await tx.attempt.updateMany({
      where: { examId, status: "IN_PROGRESS" },
      data: { status: "TIMED_OUT", submittedAt: now }
    });

    return { updated, pendingAttempts };
  });

  // 3. Grade outside the transaction — large classes would blow the
  //    interactive-transaction timeout otherwise.
  for (const attempt of pendingAttempts) {
    try {
      await autoGradeAttempt(attempt.id);
    } catch (err) {
      console.error(`[completeExam] grading failed for attempt ${attempt.id}`, err);
    }
  }

  return updated;
}

export async function deleteExam(id, teacherId) {
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam || exam.creatorId !== teacherId) throw new Error("Unauthorized");
  
  if (exam.status !== "DRAFT" && exam.status !== "PUBLISHED") {
    throw new Error("Only draft and published exams can be deleted");
  }

  return prisma.exam.delete({ where: { id } });
}
