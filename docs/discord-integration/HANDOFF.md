# Orca Discord Integration — Coding Agent Handoff

> Note: the source copy of this handoff was truncated partway through section 6 (Observability).

## Mission

Implement a bidirectional Discord integration for Orca, following `ORCA_DISCORD_SPEC.md`.

The goal is to make Discord a practical mobile interface for controlling Orca projects, workspaces, and agent sessions.

This is an implementation task, not merely a request for an architectural proposal.

**Begin by inspecting the existing repository. Do not assume Orca exposes APIs that have not been verified.**

---

## 1. Initial Instructions

Before writing implementation code:

1. Read `ORCA_DISCORD_SPEC.md` in full.
2. Inspect the Orca repository structure.
3. Identify its existing architecture and technology stack.
4. Locate project and workspace management code.
5. Locate agent-session creation, messaging, and lifecycle management.
6. Locate event streams, subscriptions, or notification mechanisms.
7. Locate approval and permission handling.
8. Locate persistence and configuration conventions.
9. Determine whether Orca already provides remote-control APIs.
10. Identify existing tests and development workflows.

Do not introduce an alternative agent runtime.

Do not duplicate existing session management logic.

Do not create mock implementations of Orca interfaces and treat them as production integrations.

---

## 2. Required Discovery Deliverable

Create:

`docs/discord-integration/ARCHITECTURE_FINDINGS.md`

Document:

- Relevant Orca modules and file paths.
- Existing APIs and interfaces.
- Session identity and persistence model.
- Available event mechanisms.
- Approval handling.
- Authentication requirements.
- Recommended integration architecture.
- Missing capabilities.
- Required Orca modifications, if any.
- Risks and implementation tradeoffs.

Distinguish verified facts from assumptions.

If important capabilities are missing, propose the smallest safe additions.

---

## 3. Architecture Constraints

### Orca Is the Source of Truth

Orca owns:

- Projects.
- Workspaces.
- Sessions.
- Agent execution.
- Conversation history.
- Approval state.

Discord is an interface to those resources.

### Preserve Existing Functionality

The integration must not disrupt existing desktop or mobile workflows.

### Prefer Reuse

Use existing session APIs, events, and persistence mechanisms wherever possible.

### Avoid Excessive Coupling

Prefer a separately deployable integration component when the existing architecture supports it.

### Maintain Stable Identity

Use actual Orca identifiers to map projects, workspaces, and sessions to Discord resources.

Never rely on Discord thread names for message routing.

---

## 4. Recommended Initial Vertical Slice

Implement the smallest working end-to-end integration.

### Step A — Connect Discord

Create a Discord bot integration using the repository's established conventions.

Support secure configuration and authorization.

### Step B — Associate a Project

Associate an existing Orca project with a Discord text channel.

Manual association is acceptable for the initial vertical slice.

### Step C — Associate a Session

Associate an existing Orca agent session with a Discord thread.

Persist the mapping.

### Step D — Send a Message

When an authorized user sends a message in the thread, route it to the corresponding Orca session.

### Step E — Receive a Response

Forward the agent's user-facing response back to the same Discord thread.

### Step F — Verify Continuity

Send multiple messages through Discord and verify they continue the same Orca session.

Also verify that the session remains usable through Orca's existing interface.

**The vertical slice is not complete until a real Orca session has successfully received and responded to a Discord message.**

---

## 5. Follow-On Implementation

After the vertical slice works, implement the remaining features in the specification.

Recommended order:

1. Automatic workspace and session discovery.
2. Automatic Discord thread creation.
3. Persistent mapping reconciliation.
4. Normal notification filtering.
5. Quiet and verbose modes.
6. Session lifecycle commands.
7. Pending-action inbox.
8. Approval interactions.
9. Restart recovery.
10. Reliability improvements and test coverage.

Avoid building the entire command interface before proving the underlying session integration works.

---

## 6. Engineering Standards

### Type Safety

Use strict TypeScript types where appropriate.

Avoid unnecessary `any` types.

### Error Handling

Handle failed Discord requests, missing sessions, unauthorized users, and unavailable Orca services gracefully.

### Idempotency

Prevent duplicate Discord threads, duplicate message delivery, and duplicate approval execution.

### Security

Never expose bot tokens, secrets, or credentials.

Validate Discord user permissions for every control action.

### Observability

Provide structured logging for:

- Discord connection state.
- Incoming

_(truncated in source)_
