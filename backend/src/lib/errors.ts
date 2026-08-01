export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = []
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function validationError(
  message: string,
  details: unknown[] = []
): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, details);
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function conflict(message: string): AppError {
  return new AppError(409, 'CONFLICT', message);
}

export function notFound(message = 'Resource not found'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}
