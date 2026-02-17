#!/usr/bin/env node

/**
 * Trackfusion MCP Server
 *
 * Exposes Trackfusion projects & tasks as MCP tools.
 * Communicates via stdio. Requires TRACKFUSION_API_KEY env var.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TrackfusionClient, UpdateTaskInput } from './client.js';

const API_KEY = process.env.TRACKFUSION_API_KEY;
const BASE_URL = process.env.TRACKFUSION_API_URL || 'https://europe-west1-oz-track.cloudfunctions.net/api';

if (!API_KEY) {
  console.error('TRACKFUSION_API_KEY environment variable is required');
  process.exit(1);
}

const client = new TrackfusionClient({ apiKey: API_KEY, baseUrl: BASE_URL });

const server = new McpServer({
  name: 'trackfusion',
  version: '1.0.0',
});

// ============================================
// TOOLS
// ============================================

server.tool(
  'list_projects',
  'List all Trackfusion projects with task counts and metadata',
  {
    includeArchived: z.boolean().optional().describe('Include archived projects (default: false)'),
  },
  async ({ includeArchived }) => {
    try {
      const projects = await client.listProjects(includeArchived ?? false);
      const formatted = projects.map((p) => {
        const total = Object.values(p.taskCounts).reduce((s, n) => s + n, 0);
        const done = p.taskCounts['done'] || 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return `${p.emoji} **${p.name}** (${p.id})\n  Tasks: ${total} total, ${done} done (${pct}%)\n  Status counts: ${JSON.stringify(p.taskCounts)}\n  Last activity: ${p.lastActivityAt}`;
      });
      return {
        content: [{ type: 'text', text: formatted.length > 0 ? formatted.join('\n\n') : 'No projects found.' }],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.tool(
  'list_tasks',
  'List tasks in a project, optionally filtered by status',
  {
    projectId: z.string().describe('Project ID'),
    status: z.string().optional().describe('Filter by status: backlog, todo, in-progress, testing, done (comma-separated for multiple)'),
  },
  async ({ projectId, status }) => {
    try {
      const tasks = await client.listTasks(projectId, status);
      const formatted = tasks.map((t) => {
        const tags = t.tags.length > 0 ? ` [${t.tags.map((tag) => tag.name).join(', ')}]` : '';
        const due = t.dueDate ? ` | Due: ${t.dueDateString || t.dueDate}` : '';
        return `- [${t.status}] **${t.title}** (${t.id}) | Priority: ${t.priority}${tags}${due}`;
      });
      return {
        content: [{ type: 'text', text: formatted.length > 0 ? formatted.join('\n') : 'No tasks found.' }],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.tool(
  'get_task',
  'Get full details of a specific task',
  {
    taskId: z.string().describe('Task ID'),
  },
  async ({ taskId }) => {
    try {
      const t = await client.getTask(taskId);
      const tags = t.tags.length > 0 ? `Tags: ${t.tags.map((tag) => tag.name).join(', ')}` : 'Tags: none';
      const due = t.dueDate ? `Due: ${t.dueDateString || t.dueDate}` : 'Due: not set';
      const completed = t.completedAt ? `Completed: ${t.completedAt}` : '';
      const desc = t.description ? `\nDescription:\n${t.description}` : '\nDescription: none';
      const text = [
        `**${t.title}** (${t.id})`,
        `Project: ${t.projectId}`,
        `Status: ${t.status} | Priority: ${t.priority}`,
        tags,
        due,
        completed,
        `Created: ${t.createdAt} | Updated: ${t.updatedAt}`,
        desc,
      ].filter(Boolean).join('\n');
      return { content: [{ type: 'text', text }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.tool(
  'create_task',
  'Create a new task in a project',
  {
    projectId: z.string().describe('Project ID'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Task description'),
    status: z.enum(['backlog', 'todo', 'in-progress', 'testing', 'done']).optional().describe('Initial status (default: todo)'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority (default: medium)'),
    dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD or full ISO)'),
  },
  async ({ projectId, title, description, status, priority, dueDate }) => {
    try {
      const task = await client.createTask(projectId, { title, description, status, priority, dueDate });
      return {
        content: [{ type: 'text', text: `✅ Task created: **${task.title}** (${task.id}) in status "${task.status}"` }],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }
);

server.tool(
  'update_task',
  'Update an existing task (title, description, status, priority, due date)',
  {
    taskId: z.string().describe('Task ID'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description'),
    status: z.enum(['backlog', 'todo', 'in-progress', 'testing', 'done']).optional().describe('New status'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('New priority'),
    dueDate: z.string().nullable().optional().describe('New due date (ISO format), or null to clear'),
  },
  async ({ taskId, title, description, status, priority, dueDate }) => {
    try {
      const updates: UpdateTaskInput = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
      if (dueDate !== undefined) updates.dueDate = dueDate;

      const task = await client.updateTask(taskId, updates);
      return {
        content: [{ type: 'text', text: `✅ Task updated: **${task.title}** (${task.id}) — status: ${task.status}, priority: ${task.priority}` }],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  }
);

// ============================================
// START
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
