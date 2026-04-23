import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess,
  sendNotFound,
  sendBadRequest,
} from '../utils/response.js';
import * as resumeService from '../services/resumeService.js';
import { extractResumeData } from '../utils/gemini.js';

export const createResume = asyncHandler(async (req, res) => {
  const { label, is_primary } = req.body;
  let pdfBase64 = null;
  let mimeType = 'application/pdf';
  let resumeData = null;

  if (req.file) {
    pdfBase64 = req.file.buffer.toString('base64');
    mimeType = req.file.mimetype;
    
    // Extract structured data using Gemini
    try {
      resumeData = await extractResumeData(pdfBase64, mimeType);
    } catch (err) {
      console.error('Failed to extract resume data:', err);
      // We can optionally fail here or just save the PDF without structured data. Let's let it pass without data if it fails, but typically we want it.
    }
  }

  const resume = await resumeService.createResumeService(req.user.id, {
    label: label || 'My Resume',
    is_primary: is_primary === 'true' || is_primary === true,
    pdfBase64,
    mimeType,
    data: resumeData
  });

  return sendSuccess(res, resume, 'Resume created successfully', 201);
});

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
