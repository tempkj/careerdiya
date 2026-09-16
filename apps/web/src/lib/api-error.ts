function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export const Unauthorized = () =>
  apiError(401, 'unauthorized', 'Authentication required.');

export const Forbidden = () =>
  apiError(403, 'forbidden', 'Insufficient permissions.');

export const NotFound = () =>
  apiError(404, 'not_found', 'Resource not found.');

export const Conflict = () =>
  apiError(409, 'conflict', 'Resource already exists or is in a conflicting state.');

export const PreconditionFailed = () =>
  apiError(412, 'precondition_failed', 'ETag mismatch — fetch the current version and retry.');

export const UnprocessableEntity = (message: string) =>
  apiError(422, 'validation_error', message);

export const InternalError = () =>
  apiError(500, 'internal_error', 'An unexpected error occurred.');
