export class ApiError extends Error {
  constructor(public status: number, message: string, public details: unknown = undefined) { super(message); }
}
export function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new ApiError(422, message);
}
