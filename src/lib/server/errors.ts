export class DomainError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "invalid", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
