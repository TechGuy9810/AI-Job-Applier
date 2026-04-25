import { GoogleGenAI, Type } from '@google/genai';
import config from '../config/config.js';
import {
  EXTRACT_PROFILE_PROMPT,
  EXTRACT_RESUME_PROMPT,
  MAP_FORM_FIELDS_PROMPT,
  ANSWER_QUESTIONS_PROMPT,
} from './prompts.js';

// Initialize the GoogleGenAI client
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  return new GoogleGenAI({ apiKey });
}

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function extractProfileFromResume(pdfBase64, mimeType = 'application/pdf') {
  const ai = getClient();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      full_name: { type: Type.STRING },
      phone: { type: Type.STRING },
      email: { type: Type.STRING },
      gender: { type: Type.STRING, enum: ['male', 'female', 'non-binary', 'prefer_not_to_say', 'other'] },
      nationality: { type: Type.STRING },
      address_line: { type: Type.STRING },
      city: { type: Type.STRING },
      state: { type: Type.STRING },
      pincode: { type: Type.STRING },
      country: { type: Type.STRING },
      linkedin_url: { type: Type.STRING },
      portfolio_url: { type: Type.STRING },
      github_url: { type: Type.STRING },
    },
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: pdfBase64 } },
          { text: EXTRACT_PROFILE_PROMPT },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(response.text);
}

export async function extractResumeData(pdfBase64, mimeType = 'application/pdf') {
  const ai = getClient();

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      skills: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      experience: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            company: { type: Type.STRING },
            role: { type: Type.STRING },
            duration: { type: Type.STRING },
            points: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
      projects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            tech: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            points: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
      education: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            college: { type: Type.STRING },
            degree: { type: Type.STRING },
            year: { type: Type.STRING },
          },
        },
      },
    },
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: pdfBase64 } },
          { text: EXTRACT_RESUME_PROMPT },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(response.text);
}

export async function mapFormFields(fields, contextString) {
  const ai = getClient();

  const fieldList = fields
    .map((f, i) => {
      let entry = `${i + 1}. "${f.label}" (type: ${f.type})`;
      if (f.options && f.options.length > 0) {
        entry += ` [options: ${f.options.slice(0, 10).join(', ')}]`;
      }
      return entry;
    })
    .join('\n');

  const prompt = MAP_FORM_FIELDS_PROMPT(contextString, fieldList);

  const responseSchema = {
    type: Type.OBJECT,
    description: "A dictionary where keys are exactly the form field labels and values are the user's mapped data.",
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema,
      systemInstruction: 'You are a form-filling assistant. Always respond with valid JSON only. No markdown, no explanation.',
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(response.text);
}

export async function answerQuestions(contextString, jd, questions) {
  const ai = getClient();

  const questionList = questions
    .map((q, i) => `${i + 1}. "${q.label}"`)
    .join('\n');

  const jdSection = jd
    ? `Job Description / Candidate Requirements:\n${jd}`
    : '(No job description provided — write general professional answers.)';

  const prompt = ANSWER_QUESTIONS_PROMPT(contextString, jdSection, questionList);

  const responseSchema = {
    type: Type.OBJECT,
    description: "A dictionary where keys are exactly the question labels and values are the written answers in 100-200 words.",
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema,
      systemInstruction: 'You are a professional career writer. Return only valid JSON with question labels as keys and written answers as values.',
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(response.text);
}
