/**
 * asyncHandler — wraps async route handlers so we don't need try/catch in every controller.
 * Any thrown error is forwarded to Express's global error middleware via next(err).
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
