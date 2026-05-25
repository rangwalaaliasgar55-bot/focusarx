export function isPrismaValidationError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "PrismaClientValidationError" ||
      err.message.includes("Unknown field"))
  );
}

export function isMissingColumnError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("does not exist") ||
      ("code" in err && (err as { code: string }).code === "P2022"))
  );
}

/** Old SQLite DB vs current Prisma schema */
export function isSchemaMismatchError(err: unknown): boolean {
  return isPrismaValidationError(err) || isMissingColumnError(err);
}
