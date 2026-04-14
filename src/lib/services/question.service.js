import prisma from "../prisma.js";
import { syncExamSnapshots } from "./exam.service.js";

/**
 * Question Bank Service
 */

export async function createQuestion({ 
  subjectId, 
  collegeId, 
  creatorId, 
  text, 
  type, 
  modelAnswer, 
  defaultMarks,
  options 
}) {
  return prisma.$transaction(async (tx) => {
    // Look up creator name to store natively
    const author = await tx.user.findUnique({ where: { id: creatorId }, select: { name: true } });

    const question = await tx.question.create({
      data: {
        text,
        type: type.toUpperCase(),
        modelAnswer,
        defaultMarks: parseInt(defaultMarks, 10),
        creatorName: author?.name || "Unknown Teacher",
        subject: { connect: { id: subjectId } },
        college: { connect: { id: collegeId } },
        creator: { connect: { id: creatorId } },
      }
    });

    if (options && options.length > 0) {
      await tx.questionOption.createMany({
        data: options.map(({ id: _, ...opt }) => ({
          ...opt,
          questionId: question.id,
        }))
      });
    }

    return tx.question.findUnique({
      where: { id: question.id },
      include: { options: true }
    });
  });
}

export async function getQuestionsBySubject(subjectId) {
  return prisma.question.findMany({
    where: { subjectId },
    include: { options: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getQuestionsByCollege(collegeId, filters = {}) {
  const { subjectId, type, creatorId } = filters;
  
  return prisma.question.findMany({
    where: {
      collegeId,
      ...(subjectId && { subjectId }),
      ...(type && { type }),
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

export async function deleteQuestion(id, userId) {
  const question = await prisma.question.findUnique({ 
    where: { id },
    include: { exams: { include: { exam: { select: { status: true } } } } }
  });

  if (!question) throw new Error("Question not found");
  if (question.creatorId !== userId) throw new Error("Unauthorized: You do not own this question");

  const isLocked = question.exams.some(eq => eq.exam.status === 'ACTIVE' || eq.exam.status === 'COMPLETED');
  if (isLocked) {
    throw new Error("Cannot delete a question used in an active or completed assessment.");
  }

  return prisma.question.delete({
    where: { id }
  });
}

export async function updateQuestion(id, userId, data, examId = null) {
  const questionRecord = await prisma.question.findUnique({ 
    where: { id },
    include: { 
      exams: { include: { exam: { select: { status: true } } } },
      options: true
    }
  });

  if (!questionRecord) throw new Error("Question not found");

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

     return prisma.$transaction(async (tx) => {
        // 1. Create the fork (clone with edits applied)
        const newQuestion = await createQuestion(mergedData);

        // 2. Hot-Swap: redirect the exam's question link to the new fork instantly
        if (examId) {
           await tx.examQuestion.updateMany({
              where: { examId, questionId: id },
              data: { questionId: newQuestion.id }
           });
        }

        return newQuestion;
     });
  }

  // --- Normal Path (Non-Locked) ---
  const { options, text, type, modelAnswer, defaultMarks } = data;

  return prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },
      data: {
        text,
        type: type ? type.toUpperCase() : undefined,
        modelAnswer,
        defaultMarks: defaultMarks ? parseInt(defaultMarks, 10) : undefined,
      }
    });

    if (options) {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.questionOption.createMany({
        data: options.map(({ id: _, ...opt }) => ({
          ...opt,
          questionId: id,
        }))
      });
    }

    const updated = await tx.question.findUnique({
      where: { id },
      include: { options: true }
    });

    await syncExamSnapshots(id);

    return updated;
  });
}