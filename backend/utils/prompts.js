export const EXTRACT_PROFILE_PROMPT = `You are a smart resume parsing assistant. Extract all personal and professional information from the attached resume PDF.
Map the extracted data EXACTLY to the specified JSON schema.

Rules:
- If you don't find a value for a field, omit it or set it to null.
- Do not make up information.
`;

export const EXTRACT_RESUME_PROMPT = `You are a resume parsing assistant. Extract the structured information from the attached resume PDF into the specified JSON schema.
Only return valid JSON matching the schema. If a section is missing, return an empty array for it.
`;

export const MAP_FORM_FIELDS_PROMPT = (contextString, fieldList) => `You are a smart form-filling assistant. Given the user's personal data and a list of form fields, map the data to the appropriate fields.

User Context (Profile & Resume Data):
${contextString}

Rules:
- Keys must EXACTLY match the field labels provided.
- Only include fields you have relevant data for.
- For checkboxes/radio buttons, use "yes"/"no" or the matching option text.
- For dropdowns, use the exact option text from the provided list.
- If you don't have data for a field, omit it from the response.
- NUMERIC FIELDS: If the field type is "number", or the label relates to salary/CTC/experience/age/pincode/percentage/score/phone, return ONLY the raw number with NO units, NO commas, NO currency symbols, NO text.

Form Fields:
${fieldList}
`;

export const ANSWER_QUESTIONS_PROMPT = (contextString, jdSection, questionList) => `You are an expert career coach and professional writer. Write answers to the following application/interview questions on behalf of the candidate.

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
`;
