import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import { sendError } from '../utils/response.js';

/**
 * Protect routes — verifies the Bearer JWT in the Authorization header.
 * On success: attaches `req.user = { id: <userId> }` and calls next().
 * On failure: returns 401 immediately.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authorization token missing', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    req.user = { id: decoded.id };

    next();
  } catch (err) {
    // jwt.verify throws JsonWebTokenError / TokenExpiredError
    // — caught and re-thrown so errorHandler can format them uniformly
    next(err);
  }
};

export default authenticate;
