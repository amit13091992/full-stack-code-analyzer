export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export class SchemaValidationError extends Error {
  issues: unknown;
  constructor(message: string, issues: unknown) {
    super(message);
    this.name = 'SchemaValidationError';
    this.issues = issues;
  }
}
