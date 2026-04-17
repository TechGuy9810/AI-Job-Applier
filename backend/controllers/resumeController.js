import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
} from '../utils/response.js';
import * as resumeService from '../services/resumeService.js';

export const getAllResumes = asyncHandler(async (req, res) => {
  const resumes = await resumeService.getAllResumesService(req.user.id);
  return sendSuccess(res, resumes, 'Resumes fetched successfully');
});

export const getResumeById = asyncHandler(async (req, res) => {
  try {
    const resume = await resumeService.getResumeByIdService(req.user.id, req.params.id);
    return sendSuccess(res, resume, 'Resume fetched successfully');
  } catch (err) {
    if (err.message === 'RESUME_NOT_FOUND') {
      return sendNotFound(res, 'Resume not found');
    }
    throw err;
  }
});

export const createResume = asyncHandler(async (req, res) => {
  const { file_url, label, is_primary } = req.body;
  if (!file_url) return sendBadRequest(res, 'file_url is required');

  const resume = await resumeService.createResumeService(req.user.id, { file_url, label, is_primary });
  return sendCreated(res, resume, 'Resume created successfully');
});

export const updateResume = asyncHandler(async (req, res) => {
  const { file_url, label, is_primary } = req.body;
  
  if (!file_url && !label && is_primary === undefined) {
    return sendBadRequest(res, 'Nothing to update');
  }

  try {
    const resume = await resumeService.updateResumeService(req.user.id, req.params.id, { file_url, label, is_primary });
    return sendSuccess(res, resume, 'Resume updated successfully');
  } catch (err) {
    if (err.message === 'RESUME_NOT_FOUND') return sendNotFound(res, 'Resume not found');
    throw err;
  }
});

export const setPrimaryResume = asyncHandler(async (req, res) => {
  try {
    const resume = await resumeService.setPrimaryResumeService(req.user.id, req.params.id);
    return sendSuccess(res, resume, 'Resume set as primary');
  } catch (err) {
    if (err.message === 'RESUME_NOT_FOUND') return sendNotFound(res, 'Resume not found');
    throw err;
  }
});

export const deleteResume = asyncHandler(async (req, res) => {
  try {
    await resumeService.deleteResumeService(req.user.id, req.params.id);
    return sendSuccess(res, null, 'Resume deleted successfully');
  } catch (err) {
    if (err.message === 'RESUME_NOT_FOUND') return sendNotFound(res, 'Resume not found');
    throw err;
  }
});
