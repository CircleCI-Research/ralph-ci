export class RalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RalError";
  }
}

export class ValidationError extends RalError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class FileOperationError extends RalError {
  constructor(
    message: string,
    public readonly filePath?: string,
  ) {
    super(message);
    this.name = "FileOperationError";
  }
}

export class CommandError extends RalError {
  constructor(
    message: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export function formatError(error: unknown): string {
  if (error instanceof RalError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
