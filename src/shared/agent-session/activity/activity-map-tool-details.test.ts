import { expect, it } from 'vitest'
import { activityMapToolDetails } from './activity-map-tool-details'

it('separates external app actions from network requests across MCP provider forms', () => {
  expect(
    activityMapToolDetails({
      name: 'functions.mcp__codex_apps__github_fetch_pr',
      input: { repository_full_name: 'private/repo', pr_number: 12 }
    })
  ).toEqual({ station: 'apps', label: 'github: fetch pr' })
  expect(
    activityMapToolDetails({
      name: 'codex_document_control/execute_document_command',
      mcpIdentity: { server: 'codex_document_control', tool: 'execute_document_command' },
      input: { tool_name: 'read_range', args: { document: 'private document contents' } }
    })
  ).toEqual({ station: 'apps', label: 'codex document control: read range' })
  expect(
    activityMapToolDetails({
      name: 'mcp__blender__execute_blender_code',
      input: { code: 'private scene modification script' }
    })
  ).toEqual({ station: 'apps', label: 'blender: execute blender code' })
  expect(
    activityMapToolDetails({ name: 'WebFetch', input: { url: 'https://example.com' } })
  ).toEqual({ station: 'network', label: 'example.com' })
})
