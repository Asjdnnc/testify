import prisma from "../prisma.js";
import { syncExamSnapshots } from "./exam.service.js";

/**
 * Question Bank Service
 */

const QUESTION_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE", "SUBJECTIVE"];

function normaliseType(type) {
  const upper = String(type || "").toUpperCase();
  if (!QUESTION_TYPES.includes(upper)) throw new Error("Invalid question type");
  return upper;
}

function normaliseOptions(options = []) {
  return options.map(({ text, label, isCorrect, order }, index) => ({
    text: String(text ?? ""),
    label: String(label ?? String.fromCharCode(65 + index)),
    isCorrect: !!isCorrect,
    order: Number.isInteger(order) ? order : parseInt(order, 10) || index,
  }));
}

export async function createQuestion(
  { subjectId, collegeId, creatorId, text, type, modelAnswer, defaultMarks, options },
  client = null
) {
  const run = async (tx) => {
    if (!text || !subjectId) throw new Error("Question text and subject are required");

    // Tenant isolation: the subject must belong to the caller's college
    const subject = await tx.subject.findUnique({ where: { id: subjectId }, select: { collegeId: true } });
    if (!subject || subject.collegeId !== collegeId) throw new Error("Invalid subject");

    const marks = parseInt(defaultMarks, 10);
    if (Number.isNaN(marks) || marks < 0) throw new Error("Marks must be a non-negative number");

    // Look up creator name to store natively
    const author = await tx.user.findUnique({ where: { id: creatorId }, select: { name: true } });

    const question = await tx.question.create({
      data: {
        text,
        type: normaliseType(type),
        modelAnswer,
        defaultMarks: marks,
        creatorName: author?.name || "Unknown Teacher",
        subject: { connect: { id: subjectId } },
        college: { connect: { id: collegeId } },
        creator: { connect: { id: creatorId } },
      }
    });

    if (options && options.length > 0) {
      await tx.questionOption.createMany({
        data: normaliseOptions(options).map((opt) => ({
          ...opt,
          questionId: question.id,
        }))
      });
    }

    return tx.question.findUnique({
      where: { id: question.id },
      include: { options: true }
    });
  };

  return client ? run(client) : prisma.$transaction(run);
}

export async function getQuestionsBySubject(subjectId, collegeId) {
  return prisma.question.findMany({
    where: { subjectId, collegeId },
    include: { options: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getQuestionsByCollege(collegeId, filters = {}) {
  const { subjectId, type, creatorId } = filters;
  const normalisedType = type ? String(type).toUpperCase() : null;

  return prisma.question.findMany({
    where: {
      collegeId,
      ...(subjectId && { subjectId }),
      ...(normalisedType && QUESTION_TYPES.includes(normalisedType) && { type: normalisedType }),
      ...(creatorId && { creatorId }),
    },
    include: {
      options: { orderBy: { order: 'asc' } },
      subject: { select: { name: true } },
      creator: { select: { name: true } },
      exams: {
         include: {
            exam: { select: { title: true } }
         }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function deleteQuestion(id, userId, collegeId) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: { exams: { include: { exam: { select: { status: true } } } } }
  });

  if (!question || question.collegeId !== collegeId) throw new Error("Question not found");
  if (question.creatorId !== userId) throw new Error("Unauthorized: You do not own this question");

  const isLocked = question.exams.some(eq => eq.exam.status === 'ACTIVE' || eq.exam.status === 'COMPLETED');
  if (isLocked) {
    throw new Error("Cannot delete a question used in an active or completed assessment.");
  }

  return prisma.question.delete({
    where: { id }
  });
}

export async function updateQuestion(id, userId, collegeId, data, examId = null) {
  const questionRecord = await prisma.question.findUnique({
    where: { id },
    include: {
      exams: { include: { exam: { select: { status: true } } } },
      options: true
    }
  });

  // Tenant isolation: never expose or fork another college's question
  if (!questionRecord || questionRecord.collegeId !== collegeId) throw new Error("Question not found");

  const isOwner = questionRecord.creatorId === userId;
  const isLocked = questionRecord.exams.some(eq => eq.exam.status === 'ACTIVE' || eq.exam.status === 'COMPLETED');

  // FORK path: clone when the question is locked (live exam) OR when the editor is not the original author.
  // Cloning is always non-destructive — the original is never mutated.
  if (isLocked || !isOwner) {
     const mergedData = {
        text: data.text !== undefined ? data.text : questionRecord.text,
        type: data.type || questionRecord.type,
        modelAnswer: data.modelAnswer !== undefined ? data.modelAnswer : questionRecord.modelAnswer,
        defaultMarks: data.defaultMarks !== undefined ? data.defaultMarks : questionRecord.defaultMarks,
        options: data.options || questionRecord.options.map(o => ({
           text: o.text,
           label: o.label,
           isCorrect: o.isCorrect,
           order: o.order
        })),
        subjectId: questionRecord.subjectId,
        collegeId: questionRecord.collegeId,
        creatorId: userId // clone is owned by the editing teacher
     };

     // Validate the hot-swap target BEFORE writing anything
     let swapExam = null;
     if (examId) {
        swapExam = await prisma.exam.findUnique({ where: { id: examId }, select: { creatorId: true, collegeId: true, status: true } });
        if (!swapExam || swapExam.collegeId !== collegeId || swapExam.creatorId !== userId) {
           throw new Error("Forbidden: you can only update questions in your own exams");
        }
        // Swapping the question id under a live/finished exam would orphan
        // students' existing answers and break grading.
        if (swapExam.status !== "DRAFT" && swapExam.status !== "PUBLISHED") {
           throw new Error("Questions in an active or completed assessment cannot be changed.");
        }
     }

     return prisma.$transaction(async (tx) => {
        // 1. Create the fork (clone with edits applied) — same transaction
        const newQuestion = await createQuestion(mergedData, tx);

        // 2. Hot-Swap: redirect the exam's question link to the new fork and refresh its snapshot
        if (swapExam) {
           await tx.examQuestion.updateMany({
              where: { examId, questionId: id },
              data: {
                 questionId: newQuestion.id,
                 questionTextSnapshot: newQuestion.text,
                 optionsSnapshot: JSON.stringify(newQuestion.options),
                 correctAnswersSnapshot: newQuestion.options.filter(o => o.isCorrect).map(o => o.label),
              }
           });
        }

        return newQuestion;
     });
  }

  // --- Normal Path (Non-Locked) ---
  const { options, text, type, modelAnswer, defaultMarks } = data;

  return prisma.$transaction(async (tx) => {
    const parsedMarks = defaultMarks !== undefined ? parseInt(defaultMarks, 10) : undefined;

    await tx.question.update({
      where: { id },
      data: {
        text,
        type: type ? normaliseType(type) : undefined,
        modelAnswer,
        defaultMarks: Number.isNaN(parsedMarks) ? undefined : parsedMarks,
      }
    });

    if (options) {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.questionOption.createMany({
        data: normaliseOptions(options).map((opt) => ({
          ...opt,
          questionId: id,
        }))
      });
    }

    const updated = await tx.question.findUnique({
      where: { id },
      include: { options: true }
    });

    // Must run on the SAME transaction, otherwise it reads the pre-edit row
    await syncExamSnapshots(id, tx);

    return updated;
  });
}
