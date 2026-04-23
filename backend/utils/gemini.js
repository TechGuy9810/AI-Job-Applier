const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  return apiKey;
}

/**
 * Extracts profile fields from a resume PDF.
 * @param {string} pdfBase64 
 * @param {string} mimeType 
 * @returns {Promise<Object>}
 */
export async function extractProfileFromResume(pdfBase64, mimeType = 'application/pdf') {
  const apiKey = getApiKey();
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `You are a smart resume parsing assistant. Extract all personal and professional information from the attached resume PDF.
Map the extracted data EXACTLY to the following JSON schema keys.

Keys:
- full_name (string)
- phone (string)
- email (string)
- gender (string, enum: male, female, non-binary, prefer_not_to_say, other)
- nationality (string)
- address_line (string)
- city (string)
- state (string)
- pincode (string)
- country (string)
- highest_education (string, enum: high_school, diploma, bachelors, masters, phd, postdoc, other)
- degree (string)
- linkedin_url (string)
- portfolio_url (string)
- github_url (string)

Rules:
- Return ONLY valid JSON.
- If you don't find a value for a field, omit it or set it to null.
- Do not make up information.
`;

  const parts = [
    {
      inline_data: {
        mime_type: mimeType,
        data: pdfBase64,
      },
    },
    { text: prompt }
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
      systemInstruction: {
        parts: [{ text: 'You are a form-filling assistant. Always respond with valid JSON only. No markdown, no explanation.' }],
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  
  if (!content) {
    throw new Error('Gemini returned an empty response.');
  }

  let result;
  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${content}`);
  }

  return result;
}

/**
 * Extracts structured data (skills, experience, projects, education) from a resume PDF
 * to populate the Resume schema.
 */
export async function extractResumeData(pdfBase64, mimeType = 'application/pdf') {
  const apiKey = getApiKey();
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `You are a resume parsing assistant. Extract the structured information from the attached resume PDF into the exact JSON format below:

{
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "e.g., Jan 2020 - Present",
      "points": ["Responsibility 1", "Responsibility 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "tech": ["React", "Node.js"],
      "points": ["Detail 1", "Detail 2"]
    }
  ],
  "education": [
    {
      "college": "University Name",
      "degree": "B.Sc Computer Science",
      "year": "2018 - 2022"
    }
  ]
}

Only return valid JSON matching this schema. If a section is missing, return an empty array for it.`;

  const parts = [
    {
      inline_data: {
        mime_type: mimeType,
        data: pdfBase64,
      },
    },
    { text: prompt }
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!content) throw new Error('Gemini returned an empty response.');

  let result;
  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    result = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${content}`);
  }

  return result;
}

/**
 * Maps webpage form fields to user details.
 * Uses extracted text context instead of PDF base64 to save tokens.
 */
export async function mapFormFields(fields, contextString) {
  const apiKey = getApiKey();
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const fieldList = fields
    .map((f, i) => {
      let entry = `${i + 1}. "${f.label}" (type: ${f.type})`;
      if (f.options && f.options.length > 0) {
        entry += ` [options: ${f.options.slice(0, 10).join(', ')}]`;
      }
      return entry;
    })
    .join('\n');

  const prompt = `You are a smart form-filling assistant. Given the user's personal data and a list of form fields, map the data to the appropriate fields.

User Context (Profile & Resume Data):
${contextString}

Rules:
- Return ONLY valid JSON. No markdown, no explanation, no extra text.
- Keys must EXACTLY match the field labels provided.
- Only include fields you have relevant data for.
- For checkboxes/radio buttons, use "yes"/"no" or the matching option text.
- For dropdowns, use the exact option text from the provided list.
- If you don't have data for a field, omit it from the response.
- NUMERIC FIELDS: If the field type is "number", or the label relates to salary/CTC/experience/age/pincode/percentage/score/phone, return ONLY the raw number with NO units, NO commas, NO currency symbols, NO text.

Form Fields:
${fieldList}

Return ONLY valid JSON like:
{
  "Field Label": "Mapped Value"
}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      systemInstruction: {
        parts: [{ text: 'You are a form-filling assistant. Always respond with valid JSON only. No markdown, no explanation.' }],
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  
  if (!content) {
    throw new Error('Gemini returned an empty response.');
  }

  let mapping;
  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    mapping = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${content}`);
  }

  return mapping;
}

export async function answerQuestions(contextString, jd, questions) {
  const apiKey = getApiKey();
  const endpoint = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const questionList = questions
    .map((q, i) => `${i + 1}. "${q.label}"`)
    .join('\n');

  const jdSection = jd
    ? `Job Description / Candidate Requirements:\n${jd}`
    : '(No job description provided — write general professional answers.)';

  const prompt = `You are an expert career coach and professional writer. Write answers to the following application/interview questions on behalf of the candidate.

Candidate Personal Context (Profile & Resume Data):
${contextString}

${jdSection}

Instructions:
- Write each answer in 100 to 200 words. Never go below 100 or above 200 words.
- Write in first person ("I", "my", "me").
- Sound professional, confident, and genuine.
- Tailor each answer to the job description when provided.
- Highlight relevant skills, achievements, and motivation from the context or resume.
- For notice period / joining questions: use the notice period from the user data; if it is 0, state "I can join immediately."
- For salary questions: do not answer with full sentences — let the form fill handle those.
- Use the education and degree details from the user context when mentioned. Do NOT invent or hardcode specific years.
- Do NOT include the question text in your answer, just the answer itself.

Questions to answer:
${questionList}

Return ONLY valid JSON where keys EXACTLY match the question labels:
{
  "Question Label": "Your 100-200 word answer here"
}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      systemInstruction: {
        parts: [{ text: 'You are a professional career writer. Return only valid JSON with question labels as keys and written answers as values.' }],
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  
  if (!content) {
    throw new Error('Gemini returned an empty response.');
  }

  let mapping;
  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    mapping = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${content}`);
  }

  return mapping;
}
