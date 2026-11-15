export function codexToolResultFacts(output: unknown): {
  isError: boolean
  isInterrupted?: boolean
  durationMs?: number
} {
  if (typeof output === 'string') {
    const cancelled =
      /^aborted by user after (\d+(?:\.\d+)?)s$/.exec(output) ??
      /^Wall time: (\d+(?:\.\d+)?) seconds\naborted by user$/.exec(output)
    if (cancelled || output === 'aborted before dispatch') {
      return {
        isError: false,
        isInterrupted: true,
        ...(cancelled ? { durationMs: Number(cancelled[1]) * 1000 } : {})
      }
    }
  }
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    const record = Object.fromEntries(Object.entries(output))
    const metadata =
      record.metadata && typeof record.metadata === 'object'
        ? Object.fromEntries(Object.entries(record.metadata))
        : {}
    const exit = record.exit_code ?? metadata.exit_code
    const isError =
      record.success === false ||
      record.is_error === true ||
      record.isError === true ||
      (typeof exit === 'number' && exit !== 0)
    const duration =
      typeof record.duration_ms === 'number'
        ? record.duration_ms
        : (record.durationMs ??
          (typeof metadata.duration_seconds === 'number'
            ? metadata.duration_seconds * 1000
            : undefined))
    return {
      isError,
      ...(typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
        ? { durationMs: duration }
        : {})
    }
  }
  if (!Array.isArray(output)) {
    return { isError: false }
  }
  const first = output[0]
  if (!first || typeof first !== 'object') {
    return { isError: false }
  }
  const header = Object.fromEntries(Object.entries(first))
  const match =
    header.type === 'input_text' && typeof header.text === 'string'
      ? /^Script (completed|failed)\nWall time (\d+(?:\.\d+)?) seconds(?: \([^\n]*\))?\nOutput:\n$/.exec(
          header.text
        )
      : null
  return match
    ? { isError: match[1] === 'failed', durationMs: Number(match[2]) * 1000 }
    : { isError: false }
}
