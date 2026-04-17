import asyncHandler from '../utils/asyncHandler.js';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendBadRequest,
} from '../utils/response.js';
import * as applicationService from '../services/applicationService.js';

export const getAllApplications = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await applicationService.getAllApplicationsService(req.user.id, {
    page,
    limit,
    status,
  });
  return sendSuccess(res, result, 'Applications fetched successfully');
});

export const getApplicationById = asyncHandler(async (req, res) => {
  try {
    const app = await applicationService.getApplicationByIdService(req.user.id, req.params.id);
    return sendSuccess(res, app, 'Application fetched successfully');
  } catch (err) {
    if (err.message === 'APPLICATION_NOT_FOUND') return sendNotFound(res, 'Application not found');
    throw err;
  }
});

export const createApplication = asyncHandler(async (req, res) => {
  const { job_url, company, role, generated_resume_id } = req.body;
  if (!job_url) return sendBadRequest(res, 'job_url is required');

  const app = await applicationService.createApplicationService(req.user.id, {
    job_url,
    company,
    role,
    generated_resume_id,
  });
  return sendCreated(res, app, 'Application logged successfully');
});

export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, notes, filled_at } = req.body;
  if (!status && notes === undefined && !filled_at) {
    return sendBadRequest(res, 'Provide fields to update');
  }

  try {
    const app = await applicationService.updateApplicationStatusService(req.user.id, req.params.id, {
      status,
      notes,
      filled_at,
    });
    return sendSuccess(res, app, 'Application status updated');
  } catch (err) {
    if (err.message === 'APPLICATION_NOT_FOUND') return sendNotFound(res, 'Application not found');
    throw err;
  }
});

export const deleteApplication = asyncHandler(async (req, res) => {
  try {
    await applicationService.deleteApplicationService(req.user.id, req.params.id);
    return sendSuccess(res, null, 'Application deleted successfully');
  } catch (err) {
    if (err.message === 'APPLICATION_NOT_FOUND') return sendNotFound(res, 'Application not found');
    throw err;
  }
});
