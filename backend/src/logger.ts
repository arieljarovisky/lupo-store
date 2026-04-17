/** Logs visibles en Railway/stdout (no usar en datos sensibles). */
export function hubLog(message: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[${ts}] [hub] ${message}`, JSON.stringify(meta));
  } else {
    console.log(`[${ts}] [hub] ${message}`);
  }
}
