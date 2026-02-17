# Trackfusion MCP Server

MCP (Model Context Protocol) server for Trackfusion. Exposes projects & tasks to AI assistants like Claude, OpenClaw, etc.

## Setup

```bash
npm install
npm run build
```

## Configuration

Copy the example env file and fill in your API key:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
TRACKFUSION_API_KEY=tf_your_key_here
TRACKFUSION_API_URL=https://europe-west1-oz-track.cloudfunctions.net/api  # optional, defaults to production
```

The server loads `.env` automatically via `dotenv`.

## Usage

### With OpenClaw (mcporter)

```bash
mcporter add trackfusion --stdio "node /path/to/trackfusion/mcp/dist/index.js" --env TRACKFUSION_API_KEY=tf_xxx
```

### With Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trackfusion": {
      "command": "node",
      "args": ["/path/to/trackfusion/mcp/dist/index.js"],
      "env": {
        "TRACKFUSION_API_KEY": "tf_your_key_here"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects with task counts |
| `list_tasks` | List tasks in a project (optional status filter) |
| `get_task` | Get full task details |
| `create_task` | Create a new task |
| `update_task` | Update a task (status, title, priority, etc.) |

## Getting an API Key

1. Log in to Trackfusion
2. Go to Settings → API Keys
3. Click "New Key", select scopes, and copy the generated key
