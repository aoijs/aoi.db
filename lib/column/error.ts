export class WideColumnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WideColumnError";
  }
}