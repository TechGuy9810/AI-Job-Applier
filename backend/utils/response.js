/**
 * Standardized API response utilities.
 * All controllers should use these helpers to ensure consistent response shape.
 *
 * Success shape:
 * { success: true, message: string, data: any }
 *
 * Error shape:
 * { success: false, message: string, errors?: any }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {any} data - Payload to return
 * @param {string} message - Human-readable message
 * @param {number} statusCode - HTTP status (default 200)
 */
export const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send a 201 Created response.
 */
export const sendCreated = (res, data, message = 'Created successfully') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message - Error description
 * @param {number} statusCode - HTTP status (default 500)
 * @param {any} errors - Optional detailed errors (e.g. Zod validation errors)
 */
export const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

/**
 * Send a 400 Bad Request response.
 */
export const sendBadRequest = (res, message = 'Bad request', errors = null) => {
  return sendError(res, message, 400, errors);
};

/**
 * Send a 404 Not Found response.
 */
export const sendNotFound = (res, message = 'Resource not found') => {
  return sendError(res, message, 404);
};

/**
 * Send a 409 Conflict response.
 */
export const sendConflict = (res, message = 'Conflict') => {
  return sendError(res, message, 409);
};
