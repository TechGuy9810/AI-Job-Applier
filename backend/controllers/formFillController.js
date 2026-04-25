import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendBadRequest, sendError } from '../utils/response.js';
import { getProfileService } from '../services/profileService.js';
import { profileToFormData } from '../utils/profileToFormData.js';
import Resume from '../models/Resume.js';
import { mapFormFields, answerQuestions } from '../utils/gemini.js';

export const fillForm = asyncHandler(async (req, res) => {
  const { fields, context } = req.body;
  const userId = req.user.id;

  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    return sendBadRequest(res, 'No fields provided');
  }

  try {
    // 1. Get Profile Context
    let profileContext = '';
    try {
      const profile = await getProfileService(userId);
      const formData = profileToFormData(profile);
      profileContext = Object.entries(formData)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    } catch (e) {
      console.warn('No profile found for user, continuing with only resume/context');
    }

    // 2. Get Primary Resume Data
    const primaryResume = await Resume.findOne({ user_id: userId, is_primary: true });
    let resumeText = '';
    if (primaryResume) {
      // Build resume context from flat top-level fields (no .data wrapper)
      const resumeFields = {
        skills: primaryResume.skills,
        experience: primaryResume.experience,
        projects: primaryResume.projects,
        education: primaryResume.education,
      };
      resumeText = JSON.stringify(resumeFields, null, 2);
    } else {
      return sendBadRequest(res, 'No primary resume found. Please upload a resume first.');
    }

    const fullContext = [profileContext, context, resumeText].filter(Boolean).join('\n\n---\n\n');

    // 3. Call Gemini
    const mapping = await mapFormFields(fields, fullContext);

    return sendSuccess(res, { mapping, resume_url: primaryResume?.file_url }, 'Form mapped successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});

export const fillAnswers = asyncHandler(async (req, res) => {
  const { questions, context, jd } = req.body;
  const userId = req.user.id;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return sendBadRequest(res, 'No questions provided');
  }

  try {
    // 1. Get Profile Context
    let profileContext = '';
    try {
      const profile = await getProfileService(userId);
      const formData = profileToFormData(profile);
      profileContext = Object.entries(formData)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    } catch (e) {
      console.warn('No profile found for user');
    }

    // 2. Get Primary Resume Data
    const primaryResume = await Resume.findOne({ user_id: userId, is_primary: true });
    let resumeText = '';
    if (primaryResume) {
      // Build resume context from flat top-level fields (no .data wrapper)
      const resumeFields = {
        skills: primaryResume.skills,
        experience: primaryResume.experience,
        projects: primaryResume.projects,
        education: primaryResume.education,
      };
      resumeText = JSON.stringify(resumeFields, null, 2);
    }

    const fullContext = [profileContext, context, resumeText].filter(Boolean).join('\n\n---\n\n');

    // 3. Call Gemini
    const answers = await answerQuestions(fullContext, jd, questions);

    return sendSuccess(res, { answers, resume_url: primaryResume?.file_url }, 'Questions answered successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
});
