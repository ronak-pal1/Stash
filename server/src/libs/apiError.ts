export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound = (message = "Not found") => new ApiError(404, message);
export const forbidden = (message = "You do not have access to this") => new ApiError(403, message);
export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, details);
export const unauthorized = (message = "Sign in required") => new ApiError(401, message);
