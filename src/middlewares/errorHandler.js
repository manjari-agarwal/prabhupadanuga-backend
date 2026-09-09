import { failure } from '../utils/apiResponse.js';

export function notFound(req, res) {
  return failure(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(error, req, res, next) {
  req.log?.error(error);
  if (error.code === 'LIMIT_FILE_SIZE') return failure(res, 'Profile image must be 5 MB or smaller', 413);
  if (error.name === 'ZodError') return failure(res, 'Validation failed', 422, error.issues);
  if (error.name === 'MongoServerError' && error.code === 11000) return failure(res, 'This record already exists', 409);
  return failure(res, error.message || 'Internal server error', error.statusCode || 500);
}
