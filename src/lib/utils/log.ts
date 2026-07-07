export function logError(label: string, err: unknown): void {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
  console.error(`${label}: ${message}`);
}
