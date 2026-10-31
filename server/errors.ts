import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Login required') => new HttpError(401, 'unauthorized', msg);
export const forbidden = (msg = 'You do not have permission to do this') => new HttpError(403, 'forbidden', msg);
export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, 'conflict', msg, details);

/** Validates untrusted input; throws a 400 with field-level messages. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw badRequest('Some fields are invalid', fields);
  }
  return result.data;
}
