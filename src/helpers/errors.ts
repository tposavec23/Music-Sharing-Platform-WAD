import { Request, Response, NextFunction } from "express";

//HTTP Error class
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = (err as any)?.status || 500;
  const message = (err as any)?.message || "Internal Server Error";
  console.error(`ERROR ${status}: ${message}`);
  res.status(status).json({ code: status, message });
}
