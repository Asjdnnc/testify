import prisma from "../prisma.js";
import { safeWrite, safeQuery } from "../db-retry.js";

// --- Shared scoring helpers ---
function toGradePoint(percentage) {
  // Simple US 4.0 Scale Mapping
  if (percentage >= 90) return 4.0;
  if (percentage >= 80) return 3.0;
  if (percentage >= 70) return 2.0;
  if (percentage >= 60) return 1.0;
  return 0.0;
}

function summarise(exam, totalMarks) {
  const examTotal = exam.totalMarks || 1; // prevent div by zero
  const percentage = (totalMarks / examTotal) * 100;
  const isPassed = exam.passingMarks ? totalMarks >= exam.passingMarks : percentage >= 40;
  return { percentage, isPassed, gradePoint: toGradePoint(percentage) };
}

/**
 * Recomputes the Result row for an attempt from the Answer rows.
 * MCQ marks come from auto-grading; SUBJECTIVE marks from teachers.
 * A result that was already PUBLISHED stays published.
 */
async function recomputeResult(client, attemptId) {
  const attempt = await client.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: { include: { questions: { include: { question: { select: { type: true } } } } } },
      answers: true,
      result: { select: { gradingStatus: true } },
    },
  });
  if (!attempt) return null;

  const answersByQuestion = new Map(attempt.answers.map(a => [a.questionId, a]));

  let total = 0;
  let pendingSubjective = false;
  for (const eq of attempt.exam.questions) {
    const answer = answersByQuestion.get(eq.questionId);
    if (eq.question.type === "SUBJECTIVE") {
      // An unanswered subjective question needs no review (scores 0)
      if (answer && answer.marksObtained === null && (answer.subjectiveText || "").trim() !== "") {
        pendingSubjective = true;
      }
    }
    total += answer?.marksObtained || 0;
  }

  const { percentage, isPassed, gradePoint } = summarise(attempt.exam, total);
  const wasPublished = attempt.result?.gradingStatus === "PUBLISHED";
  const gradingStatus = pendingSubjective
    ? "MANUAL_REVIEW_PENDING"
    : wasPublished
      ? "PUBLISHED"
      : attempt.exam.questions.some(eq => eq.question.type === "SUBJECTIVE")
        ? "FULLY_GRADED"
        : "AUTO_GRADED";

  const data = { totalMarksObtained: total, percentage, isPassed, gradePoint, gradingStatus };

  await client.attempt.update({ where: { id: attemptId }, data: { score: total } });

  return client.result.upsert({
    where: { attemptId },
    update: data,
    create: {
      attemptId,
      studentId: attempt.userId,
      examId: attempt.examId,
      ...data,
    },
  });
}

// --- Manual Grading ---
export async function gradeSubjectiveAnswer(teacherId, answerId, marksObtained, feedback) {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: { attempt: { include: { exam: true } }, question: true }
  });

  if (!answer) throw new Error("Answer not found");
  if (answer.attempt.exam.creatorId !== teacherId) throw new Error("Unauthorized to grade this exam");
  if (answer.attempt.status === "IN_PROGRESS") throw new Error("Attempt has not been submitted yet");

  // Max marks come from the exam's own weighting (ExamQuestion.marks),
  // falling back to the bank default.
  const examQuestion = await prisma.examQuestion.findUnique({
    where: { examId_questionId: { examId: answer.attempt.examId, questionId: answer.questionId } },
    select: { marks: true }
  });
  const maxMarks = examQuestion?.marks ?? answer.question.defaultMarks;

  if (!Number.isFinite(marksObtained) || marksObtained < 0 || marksObtained > maxMarks) {
    throw new Error(`Marks must be between 0 and ${maxMarks}`);
  }

  // Update Answer
  await prisma.answer.update({
    where: { id: answerId },
    data: {
      marksObtained,
      teacherFeedback: feedback ?? null,
      gradedById: teacherId,
      isCorrect: marksObtained > 0
    }
  });

  // Re-calculate Result total score
  const result = await recomputeResult(prisma, answer.attemptId);

  return {
    success: true,
    newTotal: result.totalMarksObtained,
    percentage: result.percentage,
    gradePoint: result.gradePoint,
    gradingStatus: result.gradingStatus,
  };
}

// --- GPA Engine ---
export async function calculateSemesterGPA(studentId, semester) {
  // Subjects that count towards this semester's GPA:
  //   • any subject the student has a graded result for in a semester-N exam
  //   • plus explicit enrolments (a subject with no graded exam yet counts as 0)
  const [enrollments, gradedResults] = await Promise.all([
    prisma.enrollment.findMany({ where: { studentId, semester }, include: { subject: true } }),
    prisma.result.findMany({
      where: {
        studentId,
        exam: { semester },
        gradingStatus: { in: ["AUTO_GRADED", "FULLY_GRADED", "PUBLISHED"] },
      },
      include: { exam: { include: { subject: true } } },
    }),
  ]);

  const subjects = new Map();
  for (const e of enrollments) subjects.set(e.subjectId, { subject: e.subject, best: null });
  for (const r of gradedResults) {
    const entry = subjects.get(r.exam.subjectId) || { subject: r.exam.subject, best: null };
    // Best graded attempt per subject counts (e.g. a re-test replaces a weak quiz)
    if (!entry.best || (r.gradePoint ?? 0) > (entry.best.gradePoint ?? 0)) entry.best = r;
    subjects.set(r.exam.subjectId, entry);
  }

  let totalQualityPoints = 0;
  let totalCredits = 0;
  const breakDown = [];

  for (const { subject, best } of subjects.values()) {
    const credits = subject.credits;
    const gradePoint = best?.gradePoint ?? 0;
    totalQualityPoints += gradePoint * credits;
    totalCredits += credits;
    breakDown.push({
      subject: subject.name,
      credits,
      gradePoint,
      percentage: best?.percentage ?? null,
      examTitle: best ? best.exam.title : "No graded exam yet",
    });
  }

  const gpa = totalCredits > 0 ? (totalQualityPoints / totalCredits).toFixed(2) : "0.00";

  return {
    studentId,
    semester,
    gpa,
    totalCredits,
    breakDown: breakDown.sort((a, b) => a.subject.localeCompare(b.subject)),
  };
}

// --- Query Methods for UI ---

export async function getPendingGradingExams(teacherId) {
  // Find exams created by this teacher that have any results (pending or auto-graded)
  const exams = await prisma.exam.findMany({
    where: {
      creatorId: teacherId,
      results: {
        some: {} // Any result
      }
    },
    include: {
      results: {
        select: { gradingStatus: true }
      },
      subject: true
    }
  });

  return exams.map(e => {
    const pendingCount = e.results.filter(r => r.gradingStatus === "MANUAL_REVIEW_PENDING").length;
    const completedCount = e.results.length - pendingCount;
    
    return {
      id: e.id,
      title: e.title,
      subject: e.subject.name,
      pendingCount,
      completedCount,
      totalCount: e.results.length,
      updatedAt: e.updatedAt
    };
  });
}

export async function getExamAttemptsForGrading(teacherId, examId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { creatorId: true }
  });

  if (!exam || exam.creatorId !== teacherId) throw new Error("Unauthorized");

  const results = await prisma.result.findMany({
    where: { examId },
    include: {
      student: {
        select: { id: true, name: true, email: true }
      },
      attempt: {
        select: { id: true, status: true, submittedAt: true }
      }
    }
  });

  // Show pending reviews first (enum order would put AUTO_GRADED first)
  return results.sort((a, b) =>
    (a.gradingStatus === "MANUAL_REVIEW_PENDING" ? 0 : 1) - (b.gradingStatus === "MANUAL_REVIEW_PENDING" ? 0 : 1)
  );
}

export async function getFullAttemptForGrading(teacherId, attemptId) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          questions: {
            include: { 
              question: {
                include: { options: true }
              } 
            },
            orderBy: { order: 'asc' }
          }
        }
      },
      user: {
        select: { name: true, email: true }
      },
      answers: {
        include: {
          question: true
        }
      },
      result: true,
      logs: {
        select: { event: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!attempt) throw new Error("Attempt not found");
  if (attempt.exam.creatorId !== teacherId) throw new Error("Unauthorized");

  return attempt;
}


export async function autoGradeAttempt(attemptId, tx = null) {
  const client = tx || prisma;
  // Retrying inside an interactive transaction is pointless (the tx is aborted)
  const write = tx ? (fn) => fn() : (fn) => safeWrite(fn);

  try {
    const attempt = await client.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: {
              include: {
                question: true
              }
            }
          }
        },
        answers: true
      }
    });

    if (!attempt) {
      console.error(`[Grading Engine] Attempt ${attemptId} not found`);
      return null;
    }

    // Grade MCQs sequentially to avoid write batch active errors.
    // SUBJECTIVE answers keep whatever marks a teacher already awarded.
    for (const eq of attempt.exam.questions) {
      const answer = attempt.answers.find((a) => a.questionId === eq.questionId);
      if (!answer || eq.question.type === "SUBJECTIVE") continue;

      let originalOptions = [];
      try {
        if (eq.optionsSnapshot) {
          originalOptions = typeof eq.optionsSnapshot === "string" ? JSON.parse(eq.optionsSnapshot) : eq.optionsSnapshot;
        }
      } catch (e) {}

      const studentResponse = [...new Set((answer.selectedOptions || []).map(idOrLabel => {
        const opt = originalOptions.find(o => o.id === idOrLabel || o.label === idOrLabel);
        return opt ? opt.label : idOrLabel;
      }))].sort();
      const correctResponse = [...(eq.correctAnswersSnapshot || [])].sort();

      const isCorrect = correctResponse.length > 0 &&
        JSON.stringify(studentResponse) === JSON.stringify(correctResponse);
      const marks = isCorrect ? eq.marks : 0;

      await write(() => client.answer.update({
        where: { id: answer.id },
        data: {
          marksObtained: marks,
          isCorrect: isCorrect
        }
      }));
    }

    return recomputeResult(client, attemptId);
  } catch (err) {
    console.error(`[Grading Engine] Error grading attempt ${attemptId}:`, err);
    throw err; // Re-throw to inform the caller
  }
}

export async function recalculateExamResults(teacherId, examId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { creatorId: true }
  });

  if (!exam || exam.creatorId !== teacherId) throw new Error("Unauthorized");

  const attempts = await prisma.attempt.findMany({
    where: {
      examId,
      status: { in: ['SUBMITTED', 'TIMED_OUT', 'CHEATED'] }
    },
    select: { id: true }
  });

  // Process all through auto-grading engine
  for (const attempt of attempts) {
    await autoGradeAttempt(attempt.id);
  }

  return { success: true, count: attempts.length };
}

export async function getStudentResultSummary(studentId) {
  const results = await prisma.result.findMany({
    where: { studentId },
    include: {
      exam: {
        include: { subject: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Unique semesters from results
  // Newest semester first, so gpaBySemester[0] is the current one
  const semesters = [...new Set(results.map(r => r.exam.semester).filter(Boolean))].sort((a, b) => b - a);
  
  const gpaBySemester = [];
  for (const sem of semesters) {
      const gpa = await safeQuery(() => calculateSemesterGPA(studentId, sem));
      gpaBySemester.push(gpa);
  }

  // Cumulative GPA: credit-weighted across all semesters
  let qp = 0, cr = 0;
  for (const g of gpaBySemester) {
    for (const b of g.breakDown) { qp += b.gradePoint * b.credits; cr += b.credits; }
  }
  const cgpa = cr > 0 ? (qp / cr).toFixed(2) : null;

  return {
    results,
    gpaBySemester,
    cgpa
  };
}
