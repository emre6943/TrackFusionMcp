# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trackfusion MCP Server — an MCP (Model Context Protocol) server that exposes Trackfusion projects & tasks to AI assistants. Communicates via stdio, authenticates via `TRACKFUSION_API_KEY` Bearer token against the Trackfusion REST API.

## Commands

```bash
npm install               # Install dependencies
npm run build             # TypeScript compile + chmod +x on entry point
npm test                  # Run all tests (requires --experimental-vm-modules for ESM)
npx jest --forceExit src/__tests__/client.test.ts  # Run a single test file
```

## Architecture

Two source files:

- **`src/client.ts`** — `TrackfusionClient` class: HTTP client wrapping the Trackfusion REST API. Bearer token auth, 30s timeout, single retry on 503/network errors. All methods return unwrapped response data (e.g. `data.projects` not `data`).
- **`src/index.ts`** — MCP server entry point (shebang `#!/usr/bin/env node`). Registers 5 tools (`list_projects`, `list_tasks`, `get_task`, `create_task`, `update_task`) using `@modelcontextprotocol/sdk`. Each tool handler calls the client, formats output as markdown text, and returns `{ content: [{ type: 'text', text }] }`. Errors return `isError: true`.

## Key Conventions

- ESM throughout (`"type": "module"` in package.json, ES2022 target/module)
- All imports use `.js` extension (required for ESM with TypeScript)
- Zod schemas define tool input validation inline in `server.tool()` calls
- Task statuses: `backlog`, `todo`, `in-progress`, `testing`, `done`
- Task priorities: `low`, `medium`, `high`, `urgent`
- API base URL defaults to `https://europe-west1-oz-track.cloudfunctions.net/api`

## Testing

- Jest 30 with `ts-jest` in ESM mode (`useESM: true`)
- Tests mock `global.fetch` directly — no HTTP server needed
- Helper `jsonResponse(data, status)` creates mock fetch responses
- Two test files: `client.test.ts` (client methods, retry logic, error handling) and `tools.test.ts` (tool output formatting)

## Environment Variables

- `TRACKFUSION_API_KEY` (required) — API key with `tf_` prefix
- `TRACKFUSION_API_URL` (optional) — override API base URL
