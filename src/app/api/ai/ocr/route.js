import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const QuestionSchema = {
  type: Type.ARRAY,
  description: "An array of structured educational questions perfectly extracted from the OCR document.",
  items: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description: "The main body/statement of the question."
      },
      type: {
        type: Type.STRING,
        enum: ["MCQ_SINGLE", "MCQ_MULTIPLE", "SUBJECTIVE"],
        description: "The type of the question. Is it a single choice MCQ, a multiple correct MCQ, or a subjective written answer? Default to SUBJECTIVE if unsure."
      },
      defaultMarks: {
        type: Type.INTEGER,
        description: "The numerical weightage or marks for this question. If not visible in document, default to 2."
      },
      modelAnswer: {
        type: Type.STRING,
        description: "For SUBJECTIVE questions only. Extract the reference answer provided in the text. If it is an MCQ, leave this as empty string."
      },
      options: {
        type: Type.ARRAY,
        description: "If the question is an MCQ, an array of exactly its options. Empty if subjective.",
        items: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "The option text, e.g. 'Photosynthesis'"
            },
            label: {
              type: Type.STRING,
              description: "The alphabetical label, e.g. A, B, C, D"
            },
            isCorrect: {
              type: Type.BOOLEAN,
              description: "True if this option is marked/checked as the correct answer. False otherwise. If it's not marked in the document, default to false."
            },
            order: {
              type: Type.INTEGER,
              description: "Numeric order (0 for A, 1 for B, etc.)"
            }
          },
          required: ["text", "label", "isCorrect", "order"]
        }
      }
    },
    required: ["text", "type", "defaultMarks", "modelAnswer", "options"]
  }
};

export const maxDuration = 60; // Next.js allowing up to 60s for Vercel Hobby

export async function POST(req) {
  try {
    const { fileBuffer, mimeType } = await req.json();

    if (!fileBuffer || !mimeType) {
       return Response.json({ success: false, message: "Missing file payload" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
       return Response.json({ success: false, message: "API key missing on server." }, { status: 500 });
    }

    // Prepare Prompt
    const prompt = "Please perform high-accuracy OCR on the attached educational document (worksheets, multi-page PDFs, or test papers). Intelligently parse out every single question into the structured syntax mapped by this schema. Accurately detect whether it is an MCQ or Subjective question. For MCQs, extract all choices and their corresponding letters. If an answer key is visibly marked or provided, register it in `isCorrect` or `modelAnswer`. If the mark weight is shown (e.g. [5 Marks]), extract it.";

    // Send Payload
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        prompt,
        { inlineData: { mimeType: mimeType, data: fileBuffer } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: QuestionSchema,
        temperature: 0.1, // extremely low temperature for deterministic OCR
      }
    });

    const outputText = response.text;
    const questions = JSON.parse(outputText);

    return Response.json({
        success: true,
        questions: questions
    });

  } catch (e) {
    console.error("[OCR_ENGINE_ERROR]", e);
    return Response.json({ success: false, message: e.message || "Failed to process document" }, { status: 500 });
  }
}
