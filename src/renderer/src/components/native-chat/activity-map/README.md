# Agent activity map

Open a Codex or Claude native chat and click **Activity map** (the connected-nodes icon) in its pane header. Click it again, or use the panel's Close button, to return to the conversation. Wide panes show the map alongside the transcript; narrow panes show it over the transcript while keeping the composer available.

The map follows that chat's loaded session journal. Running calls send pulses to their stations; subagent calls originate at Agents. Spokes grow with observed usage, and a faint route connects recent main-agent stations. Failed calls leave a red marker. The feed distinguishes running, completed, failed, interrupted, unconfirmed, waiting, and observed events. Reported context usage appears around the center; missing usage stays absent.

The projection uses Orca's existing provider-neutral journal and shared tool classification, so it needs no Claude plugin, model request, new network connection, or agent configuration. It works with local and remote native sessions and folder workspaces. Other structured providers can use the same journal contract. Terminal-only sessions and the separate mobile app do not expose this panel yet.

Labels include tool names, short file paths, and web hostnames. The map projection retains no command lines, tool output, prompt text, or file content. Memory and skills are recognized from named tools, MCP servers, and conventional instruction or skill paths. Shell commands stay in Shell unless Orca already classifies them more specifically. Hooks and model requests that the journal does not report are omitted. Reasoning activity represents reported reasoning rows, not access to internal model reasoning.

Only loaded activity contributes to the feed, routes, error markers, and spoke weights; loading older history can change them. Revisions replace calls in place. Clearing or rewinding the chat uses the same journal window as the transcript. Disconnected sessions show retained activity with animation and elapsed-time updates paused. Closing the panel or hiding the chat unmounts it.

Inspired by [lot-map](https://github.com/alexeyw/lot-map). This implementation uses Orca's journal, React components, and theme tokens; it does not embed the Claude-specific plugin.

Validation fixtures: `pnpm fixtures:shot native-chat/activity-map/NativeChatActivityMap --theme both`. The projection's behavioral checks live in `src/shared/agent-session/activity/agent-activity-map.test.ts`.
