import { clean, str } from './activity-map-labels'

export function activityMapAppLabel(
  server: string,
  tool: string,
  input: Record<string, unknown>
): string {
  const routed =
    server === 'codex_apps'
      ? /^(.+?)_((?:get|fetch|list|search|create|update|delete|read|write|execute|run|add|remove|open|close|set|inspect|select|download|upload|merge|enable|disable|query|call)_.*)$/.exec(
          tool
        )
      : null
  const app = routed?.[1] ?? server
  const action = routed?.[2] ?? tool
  const delegated = /^(?:execute_(?:tool|document_command)|call_tool)$/.test(action)
    ? str(input.tool_name)
    : ''
  const humanize = (value: string) => value.replace(/[_-]+/g, ' ')
  return clean(`${humanize(app)}: ${humanize(delegated || action)}`)
}
