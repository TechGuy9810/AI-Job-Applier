import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
} from '../utils/response.js';
import * as generatedResumeService from '../services/generatedResumeService.js';

export const getAllGeneratedResumes = asyncHandler(async (req, res) => {
  const resumes = await generatedResumeService.getAllGeneratedResumesService(req.user.id);
  return sendSuccess(res, resumes, 'Generated resumes fetched successfully');
});

export const getGeneratedResumeById = asyncHandler(async (req, res) => {
  try {
    const doc = await generatedResumeService.getGeneratedResumeByIdService(req.user.id, req.params.id);
    return sendSuccess(res, doc, 'Generated resume fetched successfully');
  } catch (err) {
    if (err.message === 'GENERATED_RESUME_NOT_FOUND') return sendNotFound(res, 'Generated resume not found');
    throw err;
  }
});

export const createGeneratedResume = asyncHandler(async (req, res) => {
  const { base_resume_id, pdf_url, jd_snapshot, generated_content } = req.body;
  if (!base_resume_id) return sendBadRequest(res, 'base_resume_id is required');

  try {
    const doc = await generatedResumeService.createGeneratedResumeService(req.user.id, {
      base_resume_id,
      pdf_url,
      jd_snapshot,
      generated_content,
    });
    return sendCreated(res, doc, 'Generated resume created successfully');
  } catch (err) {
    if (err.message === 'BASE_RESUME_NOT_FOUND') return sendNotFound(res, 'Base resume not found');
    throw err;
  }
});

export const updateGeneratedResume = asyncHandler(async (req, res) => {
  const { pdf_url, jd_snapshot, generated_content } = req.body;

  try {
    const doc = await generatedResumeService.updateGeneratedResumeService(req.user.id, req.params.id, {
      pdf_url,
      jd_snapshot,
      generated_content,
    });
    return sendSuccess(res, doc, 'Generated resume updated successfully');
  } catch (err) {
    if (err.message === 'GENERATED_RESUME_NOT_FOUND') return sendNotFound(res, 'Generated resume not found');
    throw err;
  }
});

export const deleteGeneratedResume = asyncHandler(async (req, res) => {
  try {
    await generatedResumeService.deleteGeneratedResumeService(req.user.id, req.params.id);
    return sendSuccess(res, null, 'Generated resume deleted successfully');
  } catch (err) {
    if (err.message === 'GENERATED_RESUME_NOT_FOUND') return sendNotFound(res, 'Generated resume not found');
    throw err;
  }
});
