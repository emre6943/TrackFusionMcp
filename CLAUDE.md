# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trackfusion MCP Server — an MCP (Model Context Protocol) server that exposes all Trackfusion modules (projects, habits, items, journal, spending, people, exercise, portfolio) to AI assistants. 37 tools total. Communicates via stdio, authenticates via `TRACKFUSION_API_KEY` Bearer token against the Trackfusion REST API.

## Commands

```bash
npm install               # Install dependencies
npm run build             # TypeScript compile + chmod +x on entry point
npm test                  # Run all tests (requires --experimental-vm-modules for ESM)
npx jest --forceExit src/__tests__/client.test.ts  # Run a single test file
```

## Architecture

Two source files:

- **`src/client.ts`** — `TrackfusionClient` class: HTTP client wrapping the Trackfusion REST API. Bearer token auth, 30s timeout, single retry on 503/network errors. All methods return unwrapped response data (e.g. `data.projects` not `data`). Contains interfaces for all 8 modules and ~30 methods.
- **`src/index.ts`** — MCP server entry point (shebang `#!/usr/bin/env node`). Registers 37 tools across 8 modules using `@modelcontextprotocol/sdk`. Each tool handler calls the client, formats output as markdown text, and returns `{ content: [{ type: 'text', text }] }`. Errors return `isError: true`. Helper functions `errText()` and `text()` standardize responses.

### Tools by module

| Module | Tools | Scope required |
|--------|-------|----------------|
| Projects | `list_projects`, `list_tasks`, `get_task`, `create_task`, `update_task` | `projects:read/write` |
| Habits | `list_habits`, `create_habit`, `update_habit`, `toggle_habit_entry`, `get_habit_analytics` | `habits:read/write` |
| Items | `list_items`, `create_item`, `update_item`, `delete_item`, `list_item_categories` | `items:read/write` |
| Journal | `list_journal_entries`, `create_journal_entry`, `get_day_entry`, `list_journal_todos`, `toggle_journal_todo` | `journal:read/write` |
| Spending | `list_spendings`, `create_spending`, `update_spending`, `delete_spending`, `list_incomes`, `create_income`, `list_spending_categories`, `list_spending_sources`, `get_spending_analytics` | `spending:read/write` |
| People | `list_people`, `create_person`, `update_person`, `add_interaction` | `people:read/write` |
| Exercise | `list_workout_sessions`, `create_workout_session`, `list_workout_templates`, `list_exercises`, `get_personal_records` | `exercise:read/write` |
| Portfolio | `list_investment_transactions`, `list_assets`, `get_asset_price_history`, `get_portfolio_summary` | `portfolio:read` |

## Backend API Coupling

**CRITICAL**: This MCP server is a thin client over the Backend REST API (`Backend/functions/src/api/`). Any change to a Backend API route **must** be reflected here:

- Route path/method changes → update `client.ts` method
- Request body changes → update `client.ts` input interface + `index.ts` Zod schema
- Response shape changes → update `client.ts` response interface + `index.ts` formatting
- New/removed routes → add/remove client method + tool + tests

After any Backend API change: `cd mcp && npm run build && npm test`

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
- Two test files (69 tests total):
  - `client.test.ts` — Client methods for all 8 modules, retry logic, error handling
  - `tools.test.ts` — Tool output formatting for all modules

## Task Description Formatting

**CRITICAL:** Task descriptions are rendered in a Tiptap rich text editor. The `description` field must be **valid HTML**, not markdown or plain text. Raw text without HTML tags renders as an unreadable wall of text.

### Supported HTML tags

| Element | Tag |
|---------|-----|
| Paragraph | `<p>` |
| Headings | `<h1>`, `<h2>`, `<h3>` |
| Bold | `<strong>` |
| Italic | `<em>` |
| Inline code | `<code>` |
| Code block | `<pre><code>` |
| Bullet list | `<ul><li><p>text</p></li></ul>` |
| Numbered list | `<ol><li><p>text</p></li></ol>` |
| Checklist | `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>text</p></div></li></ul>` |
| Table | `<table><tr><th>header</th></tr><tr><td>cell</td></tr></table>` |
| Divider | `<hr>` |
| Blockquote | `<blockquote><p>text</p></blockquote>` |

### Rules
- **Always** wrap text in block elements (`<p>`, `<h2>`, `<li>`, etc.) — never send raw text
- Use `<h2>` for section headings (e.g., Goal, Acceptance Criteria)
- Use `<hr>` between major sections for visual separation
- Use `<ul data-type="taskList">` for acceptance criteria / checklists
- Use `<ul><li><p>` for bullet lists (the `<p>` inside `<li>` is required)
- Use `<table>` for structured comparisons (routes, widget types, etc.)
- Keep descriptions scannable — headings, short bullets, not walls of text

## Environment Variables

- `TRACKFUSION_API_KEY` (required) — API key with `tf_` prefix
- `TRACKFUSION_API_URL` (optional) — override API base URL
