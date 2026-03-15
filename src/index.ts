#!/usr/bin/env node

/**
 * Trackfusion MCP Server
 *
 * Exposes all Trackfusion modules as MCP tools.
 * Communicates via stdio. Requires TRACKFUSION_API_KEY env var.
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TrackfusionClient, UpdateTaskInput, UpdatePersonInput, UpdateFoodInput, UpdateMealEntryInput, SetDietProfileInput, CreateMealTemplateInput, UpdateMealTemplateInput, MealTemplateItem } from './client.js';

const API_KEY = process.env.TRACKFUSION_API_KEY;
const BASE_URL = process.env.TRACKFUSION_API_URL || 'https://europe-west1-oz-track.cloudfunctions.net/api';

if (!API_KEY) {
  console.error('TRACKFUSION_API_KEY environment variable is required');
  process.exit(1);
}

const client = new TrackfusionClient({ apiKey: API_KEY, baseUrl: BASE_URL });

const server = new McpServer({
  name: 'trackfusion',
  version: '2.0.0',
});

/** Standard error handler for tool handlers */
function errText(err: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] };
}

// ============================================
// PROJECTS & TASKS
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
        const shared = p.sharedWith && p.sharedWith.length > 0 ? ` | Shared with ${p.sharedWith.length} user(s)` : '';
        const ownership = p.isOwner === false ? ' | 👤 Shared with you' : '';
        return `${p.emoji} **${p.name}** (${p.id})\n  Tasks: ${total} total, ${done} done (${pct}%)\n  Status counts: ${JSON.stringify(p.taskCounts)}\n  Last activity: ${p.lastActivityAt}${shared}${ownership}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No projects found.');
    } catch (err) {
      return errText(err);
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
      return text(formatted.length > 0 ? formatted.join('\n') : 'No tasks found.');
    } catch (err) {
      return errText(err);
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
      const lines = [
        `**${t.title}** (${t.id})`,
        `Project: ${t.projectId}`,
        `Status: ${t.status} | Priority: ${t.priority}`,
        tags,
        due,
        completed,
        `Created: ${t.createdAt} | Updated: ${t.updatedAt}`,
        desc,
      ].filter(Boolean).join('\n');
      return text(lines);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_task',
  'Create a new task in a project',
  {
    projectId: z.string().describe('Project ID'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Task description as HTML (rendered in Tiptap rich text editor). Supported tags: <h1>/<h2>/<h3> headings, <p> paragraphs, <ul><li> bullet lists, <ol><li> numbered lists, <ul data-type="taskList"><li data-type="taskItem" data-checked="false"> checklists, <strong> bold, <em> italic, <code> inline code, <pre><code> code blocks, <table><tr><th>/<td> tables, <hr> dividers, <blockquote> quotes. Always wrap text in block elements (<p>, <h2>, <li>, etc.) — never send raw text.'),
    status: z.enum(['backlog', 'todo', 'in-progress', 'testing', 'done']).optional().describe('Initial status (default: todo)'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority (default: medium)'),
    dueDate: z.string().optional().describe('Due date in ISO format (YYYY-MM-DD or full ISO)'),
  },
  async ({ projectId, title, description, status, priority, dueDate }) => {
    try {
      const task = await client.createTask(projectId, { title, description, status, priority, dueDate });
      return text(`Task created: **${task.title}** (${task.id}) in status "${task.status}"`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_task',
  'Update an existing task (title, description, status, priority, due date)',
  {
    taskId: z.string().describe('Task ID'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description as HTML (rendered in Tiptap rich text editor). Supported tags: <h1>/<h2>/<h3> headings, <p> paragraphs, <ul><li> bullet lists, <ol><li> numbered lists, <ul data-type="taskList"><li data-type="taskItem" data-checked="false"> checklists, <strong> bold, <em> italic, <code> inline code, <pre><code> code blocks, <table><tr><th>/<td> tables, <hr> dividers, <blockquote> quotes. Always wrap text in block elements (<p>, <h2>, <li>, etc.) — never send raw text.'),
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
      return text(`Task updated: **${task.title}** (${task.id}) — status: ${task.status}, priority: ${task.priority}`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// HABITS
// ============================================

server.tool(
  'list_habits',
  'List all habits, optionally filtered by active status. Returns name, goal, streak info, and priority.',
  {
    active: z.boolean().optional().describe('Filter by active status (true = active only, false = inactive only, omit = all)'),
  },
  async ({ active }) => {
    try {
      const habits = await client.listHabits(active);
      const formatted = habits.map((h) => {
        const status = h.isActive ? 'active' : 'inactive';
        return `${h.emoji || '•'} **${h.name}** (${h.id}) [${status}]\n  Goal: ${h.goalFrequency}x per ${h.goalPeriod} | Priority: ${h.priority ?? 1}\n  Started: ${h.startDate}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No habits found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_habit',
  'Create a new habit with a goal frequency',
  {
    name: z.string().describe('Habit name'),
    goalFrequency: z.number().describe('How many times per period (e.g., 3)'),
    goalPeriod: z.enum(['week', 'month', 'year']).describe('Goal period'),
    emoji: z.string().optional().describe('Emoji for the habit'),
    color: z.string().optional().describe('Hex color (default: #8B5CF6)'),
    startDate: z.string().optional().describe('Start date (ISO format, default: today)'),
    notes: z.string().optional().describe('Notes'),
    priority: z.number().optional().describe('Sort priority (lower = higher priority, default: 1)'),
  },
  async (input) => {
    try {
      const habit = await client.createHabit(input);
      return text(`Habit created: ${habit.emoji || ''} **${habit.name}** (${habit.id}) — ${habit.goalFrequency}x per ${habit.goalPeriod}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_habit',
  'Update a habit (name, goal, active status, etc.)',
  {
    habitId: z.string().describe('Habit ID'),
    name: z.string().optional().describe('New name'),
    goalFrequency: z.number().optional().describe('New goal frequency'),
    goalPeriod: z.enum(['week', 'month', 'year']).optional().describe('New goal period'),
    emoji: z.string().optional().describe('New emoji'),
    color: z.string().optional().describe('New hex color'),
    isActive: z.boolean().optional().describe('Set active/inactive'),
    notes: z.string().optional().describe('Notes'),
    priority: z.number().optional().describe('Sort priority'),
    endDate: z.string().nullable().optional().describe('End date (ISO), or null to clear'),
  },
  async ({ habitId, ...input }) => {
    try {
      const habit = await client.updateHabit(habitId, input);
      return text(`Habit updated: ${habit.emoji || ''} **${habit.name}** (${habit.id}) — active: ${habit.isActive}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'toggle_habit_entry',
  'Toggle a habit completion for a specific date. If already completed, removes it. If not completed, marks it done.',
  {
    habitId: z.string().describe('Habit ID'),
    date: z.string().describe('Date to toggle (YYYY-MM-DD)'),
  },
  async ({ habitId, date }) => {
    try {
      const result = await client.toggleHabitEntry(habitId, date);
      return text(`Habit entry toggled **${result.toggled}** for ${result.date}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_habit_analytics',
  'Get analytics for a habit: streaks, completion rate, monthly/yearly completions',
  {
    habitId: z.string().describe('Habit ID'),
  },
  async ({ habitId }) => {
    try {
      const a = await client.getHabitAnalytics(habitId);
      if (!a) return text('No analytics data available for this habit yet.');
      const lines = [
        `**Streaks**: Current: ${a.currentStreak} | Longest: ${a.longestStreak}`,
        `**Lifetime**: ${a.lifetimeCompletions} completions | ${Math.round(a.completionRate * 100)}% rate`,
        `**Last 30 days**: ${a.last30Days.filter(Boolean).length}/30 days`,
      ];
      return text(lines.join('\n'));
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// ITEMS
// ============================================

server.tool(
  'list_items',
  'List tracked items/products, optionally filtered by status or category',
  {
    status: z.enum(['active', 'replaced', 'retired']).optional().describe('Filter by status'),
    categoryId: z.string().optional().describe('Filter by category ID'),
  },
  async ({ status, categoryId }) => {
    try {
      const items = await client.listItems(status, categoryId);
      const formatted = items.map((i) => {
        return `**${i.name}** (${i.id}) [${i.status}]\n  Price: ${i.purchasePrice} ${i.currency} | Purchased: ${i.purchaseDate?.slice(0, 10)}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No items found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_item',
  'Track a new item/product purchase',
  {
    name: z.string().describe('Item name'),
    categoryId: z.string().describe('Category ID (use list_item_categories to find IDs)'),
    purchaseDate: z.string().describe('Purchase date (YYYY-MM-DD)'),
    purchasePrice: z.number().describe('Purchase price'),
    currency: z.string().describe('Currency code (e.g., EUR, USD)'),
    status: z.enum(['active', 'replaced', 'retired']).optional().describe('Status (default: active)'),
    expectedLifespan: z.number().optional().describe('Expected lifespan in days'),
    notes: z.string().optional().describe('Notes'),
  },
  async (input) => {
    try {
      const item = await client.createItem(input);
      return text(`Item created: **${item.name}** (${item.id}) — ${item.purchasePrice} ${item.currency}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_item',
  'Update an existing tracked item',
  {
    itemId: z.string().describe('Item ID'),
    name: z.string().optional().describe('New name'),
    status: z.enum(['active', 'replaced', 'retired']).optional().describe('New status'),
    notes: z.string().optional().describe('New notes'),
    replacementDate: z.string().nullable().optional().describe('Replacement date (ISO), or null to clear'),
  },
  async ({ itemId, ...input }) => {
    try {
      const item = await client.updateItem(itemId, input);
      return text(`Item updated: **${item.name}** (${item.id}) — status: ${item.status}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'delete_item',
  'Delete a tracked item permanently',
  {
    itemId: z.string().describe('Item ID'),
  },
  async ({ itemId }) => {
    try {
      await client.deleteItem(itemId);
      return text(`Item deleted (${itemId})`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_item_categories',
  'List all item categories (needed for creating items)',
  {},
  async () => {
    try {
      const categories = await client.listItemCategories();
      const formatted = categories.map((c) =>
        `${c.emoji || '•'} **${c.name}** (${c.id})`
      );
      return text(formatted.length > 0 ? formatted.join('\n') : 'No categories found.');
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// JOURNAL
// ============================================

server.tool(
  'list_journal_entries',
  'List journal entries, optionally filtered by date range',
  {
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().describe('Max entries to return (default: 50)'),
  },
  async ({ from, to, limit }) => {
    try {
      const entries = await client.listJournalEntries(from, to, limit);
      const formatted = entries.map((e) => {
        const mood = e.mood ? ` | Mood: ${e.mood}` : '';
        return `${e.emoji || '•'} **${e.title}** (${e.id})\n  Created: ${e.createdAt?.slice(0, 10)}${mood}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No journal entries found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_journal_entry',
  'Create a new journal entry with rich text content',
  {
    title: z.string().describe('Entry title'),
    content: z.string().describe('Entry content as HTML (rendered in Tiptap). Use <p> for paragraphs, <h2> for headings, <ul><li> for lists.'),
    emoji: z.string().optional().describe('Emoji'),
    mood: z.string().optional().describe('Mood (e.g., happy, sad, neutral, excited, anxious)'),
  },
  async (input) => {
    try {
      const entry = await client.createJournalEntry(input);
      return text(`Journal entry created: ${entry.emoji || ''} **${entry.title}** (${entry.id})`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_day_entry',
  'Get the day entry (daily notes) for a specific date',
  {
    dateString: z.string().describe('Date in YYYY-MM-DD format'),
  },
  async ({ dateString }) => {
    try {
      const entry = await client.getDayEntry(dateString);
      if (!entry) return text(`No day entry for ${dateString}`);
      const notes = entry.notes.map((n) => `${n.emoji || '•'} ${n.text}`).join('\n');
      return text(`**Day Entry for ${entry.date}**\n${notes || 'No notes'}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_journal_todos',
  'List journal todos (task items), optionally filtered by completion status',
  {
    completed: z.boolean().optional().describe('Filter: true = completed only, false = pending only, omit = all'),
  },
  async ({ completed }) => {
    try {
      const todos = await client.listJournalTodos(completed);
      const formatted = todos.map((t) => {
        const check = t.isCompleted ? '[x]' : '[ ]';
        const due = t.dueDate ? ` | Due: ${t.dueDate.slice(0, 10)}` : '';
        return `${check} **${t.title}** (${t.id}) | Priority: ${t.priority}${due}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n') : 'No todos found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'toggle_journal_todo',
  'Toggle a journal todo completion, or update its fields',
  {
    todoId: z.string().describe('Todo ID'),
    isCompleted: z.boolean().optional().describe('Set completion status'),
    title: z.string().optional().describe('New title'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
    dueDate: z.string().nullable().optional().describe('New due date (ISO), or null to clear'),
  },
  async ({ todoId, ...input }) => {
    try {
      const todo = await client.updateJournalTodo(todoId, input);
      const check = todo.isCompleted ? 'completed' : 'pending';
      return text(`Todo updated: **${todo.title}** (${todo.id}) — ${check}`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// SPENDING
// ============================================

server.tool(
  'list_spendings',
  'List expense records, optionally filtered by date range, category, or source',
  {
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    categoryId: z.string().optional().describe('Filter by category ID'),
    sourceId: z.string().optional().describe('Filter by payment source ID'),
    limit: z.number().optional().describe('Max results (default: 100)'),
  },
  async (opts) => {
    try {
      const spendings = await client.listSpendings(opts);
      const formatted = spendings.map((s) =>
        `**${s.description}** (${s.id}) — ${s.amount} | ${s.date?.slice(0, 10)}`
      );
      return text(formatted.length > 0 ? formatted.join('\n') : 'No spendings found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_spending',
  'Record a new expense. Use list_spending_categories and list_spending_sources first to get valid IDs.',
  {
    description: z.string().describe('Expense description'),
    amount: z.number().describe('Amount spent'),
    categoryId: z.string().describe('Category ID'),
    sourceId: z.string().describe('Payment source ID'),
    date: z.string().describe('Date (YYYY-MM-DD)'),
  },
  async (input) => {
    try {
      const spending = await client.createSpending(input);
      return text(`Spending created: **${spending.description}** (${spending.id}) — ${spending.amount}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_spending',
  'Update an existing expense record',
  {
    spendingId: z.string().describe('Spending ID'),
    description: z.string().optional().describe('New description'),
    amount: z.number().optional().describe('New amount'),
    categoryId: z.string().optional().describe('New category ID'),
    sourceId: z.string().optional().describe('New source ID'),
    date: z.string().optional().describe('New date (YYYY-MM-DD)'),
  },
  async ({ spendingId, ...input }) => {
    try {
      const spending = await client.updateSpending(spendingId, input);
      return text(`Spending updated: **${spending.description}** (${spending.id}) — ${spending.amount}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'delete_spending',
  'Delete an expense record permanently',
  {
    spendingId: z.string().describe('Spending ID'),
  },
  async ({ spendingId }) => {
    try {
      await client.deleteSpending(spendingId);
      return text(`Spending deleted (${spendingId})`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_incomes',
  'List income records, optionally filtered by date range',
  {
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
  },
  async ({ from, to }) => {
    try {
      const incomes = await client.listIncomes(from, to);
      const formatted = incomes.map((i) =>
        `**${i.name}** (${i.id}) — ${i.income} | ${i.date?.slice(0, 10)}`
      );
      return text(formatted.length > 0 ? formatted.join('\n') : 'No incomes found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_income',
  'Record a new income entry. Use list_spending_sources to get valid source IDs.',
  {
    name: z.string().describe('Income description'),
    income: z.number().describe('Amount received'),
    sourceId: z.string().describe('Source ID'),
    date: z.string().describe('Date (YYYY-MM-DD)'),
    description: z.string().optional().describe('Additional notes'),
  },
  async (input) => {
    try {
      const inc = await client.createIncome(input);
      return text(`Income created: **${inc.name}** (${inc.id}) — ${inc.income}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_spending_categories',
  'List all spending categories (needed for creating expenses)',
  {},
  async () => {
    try {
      const categories = await client.listSpendingCategories();
      const formatted = categories.map((c) => {
        const limit = c.monthlyLimit ? ` | Budget: ${c.monthlyLimit}/mo` : '';
        return `${c.emoji || '•'} **${c.name}** (${c.id})${limit}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n') : 'No categories found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_spending_sources',
  'List all payment sources (needed for creating expenses and incomes)',
  {},
  async () => {
    try {
      const sources = await client.listSpendingSources();
      const formatted = sources.map((s) =>
        `${s.emoji || '•'} **${s.name}** (${s.id})`
      );
      return text(formatted.length > 0 ? formatted.join('\n') : 'No sources found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_spending_analytics',
  'Get monthly spending analytics (total spend & income for a month)',
  {
    yearMonth: z.string().describe('Month in YYYY-MM format (e.g., 2026-02)'),
  },
  async ({ yearMonth }) => {
    try {
      const a = await client.getSpendingAnalytics(yearMonth);
      if (!a) return text(`No analytics for ${yearMonth}`);
      return text(`**${yearMonth}** — Spent: ${a.totalSpend} | Income: ${a.totalIncome} | Net: ${a.totalIncome - a.totalSpend}`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// PEOPLE
// ============================================

server.tool(
  'list_people',
  'List people in your CRM, optionally filtered by search or relationship type',
  {
    search: z.string().optional().describe('Search by name or nickname'),
    relationshipTypeId: z.string().optional().describe('Filter by relationship type ID'),
    archived: z.string().optional().describe('"true" for archived only, "all" for both, omit for non-archived only'),
  },
  async (opts) => {
    try {
      const people = await client.listPeople(opts);
      const formatted = people.map((p) => {
        const lastContact = p.lastContactedAt ? ` | Last contact: ${p.lastContactedAt.slice(0, 10)}` : '';
        const linked = p.linkedFriendName ? ` | Linked: ${p.linkedFriendName}` : '';
        return `**${p.name}** (${p.id}) — ${p.relationshipTypeName}${lastContact}${linked}\n  Interactions: ${p.interactions?.length || 0} | Connections: ${p.connections?.length || 0}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No people found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_person',
  'Add a new person to your CRM',
  {
    name: z.string().describe('Person name'),
    relationshipTypeId: z.string().describe('Relationship type ID (e.g., family, friend, colleague)'),
    nickname: z.string().optional().describe('Nickname'),
    description: z.string().optional().describe('Description/notes about this person'),
    birthday: z.string().optional().describe('Birthday (YYYY-MM-DD)'),
    location: z.string().optional().describe('Location'),
    priority: z.number().optional().describe('Priority 1-5 (affects graph node size, default: 3)'),
    linkedFriendUserId: z.string().optional().describe('Link to a TrackFusion friend by their user ID (use list_friends to find)'),
    linkedFriendName: z.string().optional().describe('Display name of the linked friend'),
    linkedFriendEmail: z.string().optional().describe('Email of the linked friend'),
  },
  async (input) => {
    try {
      const person = await client.createPerson(input);
      return text(`Person created: **${person.name}** (${person.id}) — ${person.relationshipTypeName}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_person',
  'Update a person in your CRM',
  {
    personId: z.string().describe('Person ID'),
    name: z.string().optional().describe('New name'),
    nickname: z.string().optional().describe('New nickname'),
    description: z.string().optional().describe('New description'),
    birthday: z.string().nullable().optional().describe('New birthday (YYYY-MM-DD), or null to clear'),
    location: z.string().optional().describe('New location'),
    priority: z.number().optional().describe('New priority (1-5)'),
    isArchived: z.boolean().optional().describe('Archive/unarchive'),
    linkedFriendUserId: z.string().nullable().optional().describe('Link to a TrackFusion friend by user ID, or null to unlink'),
    linkedFriendName: z.string().optional().describe('Display name of the linked friend'),
    linkedFriendEmail: z.string().optional().describe('Email of the linked friend'),
  },
  async ({ personId, ...input }) => {
    try {
      const updates: UpdatePersonInput = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.nickname !== undefined) updates.nickname = input.nickname;
      if (input.description !== undefined) updates.description = input.description;
      if (input.birthday !== undefined) updates.birthday = input.birthday;
      if (input.location !== undefined) updates.location = input.location;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
      if (input.linkedFriendUserId !== undefined) {
        updates.linkedFriendUserId = input.linkedFriendUserId === null ? '' : input.linkedFriendUserId;
        updates.linkedFriendName = input.linkedFriendName;
        updates.linkedFriendEmail = input.linkedFriendEmail;
      }
      const person = await client.updatePerson(personId, updates);
      return text(`Person updated: **${person.name}** (${person.id})`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'add_interaction',
  'Log an interaction with a person (meeting, call, message, etc.)',
  {
    personId: z.string().describe('Person ID'),
    typeId: z.string().describe('Interaction type ID (e.g., met-in-person, phone-call)'),
    date: z.string().describe('Date of interaction (YYYY-MM-DD)'),
    note: z.string().describe('What happened / notes about the interaction'),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional().describe('Sentiment (default: neutral)'),
    location: z.string().optional().describe('Where it happened'),
  },
  async ({ personId, ...input }) => {
    try {
      const interaction = await client.addInteraction(personId, input);
      return text(`Interaction logged: ${interaction.typeName} on ${interaction.dateString} — "${interaction.note.slice(0, 80)}"`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// EXERCISE
// ============================================

server.tool(
  'list_workout_sessions',
  'List workout sessions, optionally filtered by date range',
  {
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().describe('Max results (default: 50)'),
  },
  async ({ from, to, limit }) => {
    try {
      const sessions = await client.listWorkoutSessions(from, to, limit);
      const formatted = sessions.map((s) => {
        const exNames = s.exercises.map((e) => e.exerciseName).filter(Boolean).join(', ');
        const vol = s.totalVolume ? ` | Volume: ${s.totalVolume}kg` : '';
        const dur = s.durationMinutes ? ` | ${s.durationMinutes}min` : '';
        return `**${s.name || s.dateString}** (${s.id})${dur}${vol}\n  Exercises: ${exNames || 'none'}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No workout sessions found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_workout_session',
  'Log a workout session with exercises and sets',
  {
    date: z.string().describe('Workout date (YYYY-MM-DD)'),
    name: z.string().optional().describe('Session name (e.g., "Push Day")'),
    exercises: z.array(z.object({
      exerciseDefinitionId: z.string().describe('Exercise definition ID (use list_exercises to find)'),
      exerciseName: z.string().optional().describe('Exercise name (for display)'),
      muscleGroups: z.array(z.string()).optional().describe('Primary muscle groups'),
      sets: z.array(z.object({
        reps: z.number().describe('Number of reps'),
        weight: z.number().describe('Weight in kg'),
        isWarmup: z.boolean().optional().describe('Is this a warmup set?'),
      })).describe('Sets performed'),
      order: z.number().optional().describe('Exercise order'),
      notes: z.string().optional().describe('Exercise-specific notes'),
      supersetGroupId: z.string().optional().describe('Group ID for superset linking'),
    })).describe('Exercises performed'),
    durationMinutes: z.number().optional().describe('Total duration in minutes'),
    notes: z.string().optional().describe('Session notes'),
    energyLevel: z.number().optional().describe('Energy level 1-5'),
  },
  async (input) => {
    try {
      const session = await client.createWorkoutSession(input);
      return text(`Workout logged: **${session.name || session.dateString}** (${session.id}) — ${session.exercises.length} exercises, volume: ${session.totalVolume || 0}kg`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_workout_templates',
  'List saved workout templates',
  {},
  async () => {
    try {
      const templates = await client.listWorkoutTemplates();
      const formatted = templates.map((t) => {
        const exNames = t.exercises.map((e) => e.exerciseName).join(', ');
        return `**${t.name}** (${t.id}) [${t.category}]\n  Exercises: ${exNames}\n  Used: ${t.usageCount} times`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No workout templates found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_exercises',
  'List available exercise definitions (system + custom)',
  {},
  async () => {
    try {
      const exercises = await client.listExerciseDefinitions();
      const formatted = exercises.map((e) => {
        const muscles = e.muscleGroups.join(', ');
        const type = e.isSystem ? 'system' : 'custom';
        return `**${e.name}** (${e.id}) [${type}] — ${muscles} | ${e.equipment}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n') : 'No exercises found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_personal_records',
  'Get personal records (PRs), optionally filtered by exercise',
  {
    exerciseId: z.string().optional().describe('Exercise definition ID to filter by'),
  },
  async ({ exerciseId }) => {
    try {
      const records = await client.getPersonalRecords(exerciseId);
      const formatted = records.map((r) => {
        const detail = r.weight ? ` (${r.weight}kg x ${r.reps} reps)` : '';
        return `**${r.exerciseName}** — ${r.type}: ${r.value}${detail} on ${r.dateString}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n') : 'No personal records found.');
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// PORTFOLIO
// ============================================

server.tool(
  'list_investment_transactions',
  'List investment transactions (buys/sells), optionally filtered',
  {
    assetType: z.string().optional().describe('Filter by type: crypto, stock, etf, commodity, currency'),
    assetId: z.string().optional().describe('Filter by asset ID'),
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().describe('Max results (default: 100)'),
  },
  async (opts) => {
    try {
      const txs = await client.listInvestmentTransactions(opts);
      const formatted = txs.map((t) =>
        `${t.type.toUpperCase()} **${t.assetId}** — ${t.quantity} @ ${t.pricePerUnit} ${t.currency} (cost: ${t.amountOut || 0}) | ${t.date?.slice(0, 10)}`
      );
      return text(formatted.length > 0 ? formatted.join('\n') : 'No transactions found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_assets',
  'List available assets (stocks, crypto, etc.) with current prices',
  {
    assetType: z.string().optional().describe('Filter by type: crypto, stock, etf, commodity, currency'),
    search: z.string().optional().describe('Search by name or symbol'),
  },
  async ({ assetType, search }) => {
    try {
      const assets = await client.listAssets(assetType, search);
      const formatted = assets.map((a) => {
        const price = a.lastPrice ? ` | Price: $${a.lastPrice}` : '';
        return `**${a.name}** (${a.symbol}) [${a.assetType}]${price}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n') : 'No assets found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_asset_price_history',
  'Get historical price data for an asset',
  {
    assetId: z.string().describe('Asset ID'),
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().describe('Max data points (default: 90)'),
  },
  async ({ assetId, from, to, limit }) => {
    try {
      const { asset, prices } = await client.getAssetPriceHistory(assetId, from, to, limit);
      const header = `**${asset.name}** (${asset.symbol}) — ${prices.length} data points`;
      if (prices.length === 0) return text(`${header}\nNo price history available.`);
      const latest = prices[0];
      const oldest = prices[prices.length - 1];
      const change = latest.price - oldest.price;
      const pct = oldest.price > 0 ? (change / oldest.price) * 100 : 0;
      return text(`${header}\nLatest: $${latest.price} (${latest.date})\nOldest: $${oldest.price} (${oldest.date})\nChange: $${change.toFixed(2)} (${pct.toFixed(1)}%)`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_portfolio_summary',
  'Get portfolio overview: total value, P&L, allocation, and all holdings',
  {},
  async () => {
    try {
      const { summary: s, holdings } = await client.getPortfolioSummary();
      const header = [
        `**Portfolio Summary**`,
        `Total Value: $${s.totalValue.toFixed(2)} | Invested: $${s.totalInvested.toFixed(2)}`,
        `P&L: $${s.totalPnl.toFixed(2)} (${s.totalPnlPercent.toFixed(1)}%)`,
        `Holdings: ${s.holdingCount}`,
        `\nAllocation: ${Object.entries(s.allocationByType).map(([k, v]) => `${k}: $${v.toFixed(0)}`).join(' | ')}`,
      ].join('\n');

      const holdingLines = holdings.slice(0, 20).map((h) =>
        `  **${h.symbol}** (${h.assetName}) — ${h.quantity} units @ $${h.currentPrice} = $${h.currentValue.toFixed(2)} | P&L: $${h.pnl.toFixed(2)} (${h.pnlPercent.toFixed(1)}%)`
      );

      return text(header + (holdingLines.length > 0 ? '\n\n' + holdingLines.join('\n') : ''));
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// FRIENDS
// ============================================

server.tool(
  'list_friends',
  'List your accepted friends',
  {},
  async () => {
    try {
      const friends = await client.listFriends();
      const formatted = friends.map((f) =>
        `**${f.friendName}** (${f.friendUserId}) — ${f.friendEmail}`
      );
      return text(formatted.length > 0 ? formatted.join('\n') : 'No friends yet.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_friend_requests',
  'List pending friend requests (sent and received)',
  {},
  async () => {
    try {
      const requests = await client.listFriendRequests();
      if (requests.length === 0) return text('No pending friend requests.');
      const formatted = requests.map((r) => {
        const dir = r.direction === 'received' ? '⬅ From' : '➡ To';
        return `${dir} **${r.displayName}** (${r.email}) — ID: ${r.id}`;
      });
      return text(formatted.join('\n'));
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'send_friend_request',
  'Send a friend request by email address',
  {
    email: z.string().describe('Email address of the user to send a friend request to'),
  },
  async ({ email }) => {
    try {
      const result = await client.sendFriendRequest(email);
      return text(`Friend request sent! (ID: ${result.friendship.id})`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'respond_to_friend_request',
  'Accept or reject a pending friend request',
  {
    friendshipId: z.string().describe('Friendship ID from list_friend_requests'),
    action: z.enum(['accept', 'reject']).describe('Accept or reject the request'),
  },
  async ({ friendshipId, action }) => {
    try {
      await client.respondToFriendRequest(friendshipId, action);
      return text(`Friend request ${action}ed.`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'delete_friend',
  'Remove a friend (also removes them from any shared projects)',
  {
    friendshipId: z.string().describe('Friendship ID'),
  },
  async ({ friendshipId }) => {
    try {
      await client.deleteFriend(friendshipId);
      return text('Friend removed.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'share_project',
  'Share a project with a friend (owner only)',
  {
    projectId: z.string().describe('Project ID'),
    friendUserId: z.string().describe('Friend user ID to share with'),
  },
  async ({ projectId, friendUserId }) => {
    try {
      await client.shareProject(projectId, friendUserId);
      return text(`Project shared with user ${friendUserId}.`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'unshare_project',
  'Remove a friend from a shared project (owner only)',
  {
    projectId: z.string().describe('Project ID'),
    friendUserId: z.string().describe('Friend user ID to remove'),
  },
  async ({ projectId, friendUserId }) => {
    try {
      await client.unshareProject(projectId, friendUserId);
      return text(`User ${friendUserId} removed from project.`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// DIET & NUTRITION
// ============================================

server.tool(
  'list_food_definitions',
  'List food definitions (system + custom). Optionally search by name or filter by category.',
  {
    search: z.string().optional().describe('Search foods by name or brand'),
    category: z.string().optional().describe('Filter by category'),
  },
  async ({ search, category }) => {
    try {
      const foods = await client.listFoodDefinitions(search, category);
      const formatted = foods.map((f) => {
        const brand = f.brand ? ` (${f.brand})` : '';
        const sys = f.isSystem ? ' [system]' : '';
        const household = f.householdServingName && f.householdServingGrams ? ` (1 ${f.householdServingName} = ${f.householdServingGrams}g)` : '';
        return `**${f.name}**${brand}${sys} (${f.id})\n  Per ${f.servingSize}${f.servingUnit}: ${f.calories} kcal | P: ${f.protein}g | C: ${f.carbs}g | F: ${f.fat}g${household}`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No food definitions found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_food_definition',
  'Create a custom food definition with nutritional info per serving',
  {
    name: z.string().describe('Food name'),
    brand: z.string().optional().describe('Brand name'),
    servingSize: z.number().describe('Serving size amount'),
    servingUnit: z.string().describe('Serving unit (g, ml, oz, cup, piece)'),
    calories: z.number().describe('Calories per serving'),
    protein: z.number().describe('Protein grams per serving'),
    carbs: z.number().describe('Carbs grams per serving'),
    fat: z.number().describe('Fat grams per serving'),
    fiber: z.number().optional().describe('Fiber grams per serving'),
    sugar: z.number().optional().describe('Sugar grams per serving'),
    barcode: z.string().optional().describe('Barcode number'),
    category: z.string().optional().describe('Food category'),
    householdServingName: z.string().optional().describe('Household serving name (e.g., "egg", "slice", "scoop")'),
    householdServingGrams: z.number().optional().describe('Grams per one household serving unit'),
  },
  async (input) => {
    try {
      const food = await client.createFoodDefinition(input);
      return text(`Food created: **${food.name}** (${food.id}) — ${food.calories} kcal per ${food.servingSize}${food.servingUnit}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_food_definition',
  'Update a custom food definition (cannot update system foods)',
  {
    foodId: z.string().describe('Food definition ID'),
    name: z.string().optional().describe('New name'),
    brand: z.string().optional().describe('New brand'),
    servingSize: z.number().optional().describe('New serving size'),
    servingUnit: z.string().optional().describe('New serving unit'),
    calories: z.number().optional().describe('New calories'),
    protein: z.number().optional().describe('New protein grams'),
    carbs: z.number().optional().describe('New carbs grams'),
    fat: z.number().optional().describe('New fat grams'),
    fiber: z.number().optional().describe('New fiber grams'),
    sugar: z.number().optional().describe('New sugar grams'),
    barcode: z.string().optional().describe('New barcode'),
    category: z.string().optional().describe('New category'),
    householdServingName: z.string().optional().describe('Household serving name'),
    householdServingGrams: z.number().optional().describe('Grams per household serving'),
  },
  async ({ foodId, ...input }) => {
    try {
      const updates: UpdateFoodInput = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) (updates as any)[k] = v;
      }
      const food = await client.updateFoodDefinition(foodId, updates);
      return text(`Food updated: **${food.name}** (${food.id})`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'delete_food_definition',
  'Delete a custom food definition (cannot delete system foods)',
  {
    foodId: z.string().describe('Food definition ID'),
  },
  async ({ foodId }) => {
    try {
      await client.deleteFoodDefinition(foodId);
      return text('Food definition deleted.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'list_meal_entries',
  'List logged meal entries. Filter by date, date range, or meal type.',
  {
    date: z.string().optional().describe('Exact date (YYYY-MM-DD)'),
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']).optional().describe('Filter by meal type'),
    limit: z.number().optional().describe('Max entries to return (default 100)'),
  },
  async (opts) => {
    try {
      const entries = await client.listMealEntries(opts);
      const formatted = entries.map((e) => {
        const quick = e.isQuickAdd ? ' [quick-add]' : '';
        const serving = e.householdServingCount != null && e.householdServingName
          ? `${e.householdServingCount} ${e.householdServingName} (${Math.round(e.servingCount * 100)}g)`
          : `${e.servingCount}x`;
        return `**${e.foodName}**${quick} — ${e.mealType} on ${e.dateString}\n  ${serving} | ${e.calories} kcal | P: ${e.protein}g | C: ${e.carbs}g | F: ${e.fat}g`;
      });
      return text(formatted.length > 0 ? formatted.join('\n\n') : 'No meal entries found.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_meal_entry',
  'Log a meal entry. Can reference a food definition or be a quick-add with just calories.',
  {
    foodDefinitionId: z.string().optional().describe('Food definition ID (omit for quick-add)'),
    foodName: z.string().describe('Food name (denormalized for history)'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']).describe('Meal type'),
    servingCount: z.number().describe('Number of servings'),
    calories: z.number().describe('Total calories'),
    protein: z.number().optional().describe('Total protein grams'),
    carbs: z.number().optional().describe('Total carbs grams'),
    fat: z.number().optional().describe('Total fat grams'),
    dateString: z.string().describe('Date (YYYY-MM-DD)'),
    isQuickAdd: z.boolean().optional().describe('True if quick-add without food definition'),
    notes: z.string().optional().describe('Optional notes about the meal'),
    photoUrl: z.string().optional().describe('Optional photo URL'),
    householdServingCount: z.number().optional().describe('Household serving count (e.g., 2 for "2 eggs")'),
    householdServingName: z.string().optional().describe('Household serving name for display (e.g., "eggs")'),
  },
  async (input) => {
    try {
      const entry = await client.createMealEntry(input);
      return text(`Meal logged: **${entry.foodName}** (${entry.mealType}) — ${entry.calories} kcal on ${entry.dateString}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_meal_entry',
  'Update an existing meal entry',
  {
    entryId: z.string().describe('Meal entry ID'),
    foodName: z.string().optional().describe('New food name'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']).optional().describe('New meal type'),
    servingCount: z.number().optional().describe('New serving count'),
    calories: z.number().optional().describe('New calories'),
    protein: z.number().optional().describe('New protein grams'),
    carbs: z.number().optional().describe('New carbs grams'),
    fat: z.number().optional().describe('New fat grams'),
    dateString: z.string().optional().describe('New date (YYYY-MM-DD)'),
    foodDefinitionId: z.string().optional().describe('New food definition ID'),
    isQuickAdd: z.boolean().optional().describe('Whether this is a quick-add entry'),
    notes: z.string().optional().describe('Optional notes about the meal'),
    photoUrl: z.string().optional().describe('Optional photo URL'),
    householdServingCount: z.number().optional().describe('Household serving count'),
    householdServingName: z.string().optional().describe('Household serving name'),
  },
  async ({ entryId, ...input }) => {
    try {
      const updates: UpdateMealEntryInput = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) (updates as any)[k] = v;
      }
      const entry = await client.updateMealEntry(entryId, updates);
      return text(`Meal updated: **${entry.foodName}** — ${entry.calories} kcal`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'delete_meal_entry',
  'Delete a meal entry',
  {
    entryId: z.string().describe('Meal entry ID'),
  },
  async ({ entryId }) => {
    try {
      await client.deleteMealEntry(entryId);
      return text('Meal entry deleted.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_nutrition_goals',
  'Get the user\'s daily nutrition goals (calories and macros)',
  {},
  async () => {
    try {
      const goals = await client.getNutritionGoals();
      if (!goals) return text('No nutrition goals set yet.');
      return text(`Daily Goals:\n  Calories: ${goals.dailyCalories} kcal\n  Protein: ${goals.proteinGrams}g\n  Carbs: ${goals.carbsGrams}g\n  Fat: ${goals.fatGrams}g`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'set_nutrition_goals',
  'Set daily nutrition goals (calories and macro targets)',
  {
    dailyCalories: z.number().describe('Daily calorie target'),
    proteinGrams: z.number().describe('Daily protein target in grams'),
    carbsGrams: z.number().describe('Daily carbs target in grams'),
    fatGrams: z.number().describe('Daily fat target in grams'),
  },
  async (input) => {
    try {
      const goals = await client.setNutritionGoals(input);
      return text(`Nutrition goals updated:\n  Calories: ${goals.dailyCalories} kcal\n  Protein: ${goals.proteinGrams}g\n  Carbs: ${goals.carbsGrams}g\n  Fat: ${goals.fatGrams}g`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_diet_daily_summary',
  'Get a daily diet summary with totals and meals grouped by type',
  {
    date: z.string().describe('Date to summarize (YYYY-MM-DD)'),
  },
  async ({ date }) => {
    try {
      const summary = await client.getDietDailySummary(date);
      let result = `📊 Diet Summary for ${summary.date}\n`;
      result += `  Total: ${summary.totals.calories} kcal | P: ${summary.totals.protein}g | C: ${summary.totals.carbs}g | F: ${summary.totals.fat}g\n`;
      if (summary.totals.fiber || summary.totals.sugar || summary.totals.sodium) {
        result += `  Micros: Fiber ${summary.totals.fiber}g | Sugar ${summary.totals.sugar}g | Sodium ${summary.totals.sodium}mg\n`;
      }
      result += `  Entries: ${summary.entryCount}\n`;

      for (const [mealType, entries] of Object.entries(summary.meals)) {
        if ((entries as any[]).length > 0) {
          result += `\n  🍽️ ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}:\n`;
          for (const e of entries as any[]) {
            result += `    - ${e.foodName} (${e.servingCount}x) — ${e.calories} kcal\n`;
          }
        }
      }

      return text(result);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'search_foods',
  'Search external food databases (Open Food Facts + USDA) for nutrition data',
  {
    query: z.string().describe('Search query (e.g., "chicken breast", "coca cola")'),
    source: z.enum(['off', 'usda']).optional().describe('Limit to a specific source (default: OFF)'),
    page: z.number().optional().describe('Page number for pagination (default: 1)'),
  },
  async ({ query, source, page }) => {
    try {
      const result = await client.searchFoods(query, source, page);
      const foods = result.foods as any[];
      if (foods.length === 0) return text('No foods found for that query.');

      let output = `Found ${foods.length} results from ${result.source.toUpperCase()}:\n\n`;
      for (const f of foods.slice(0, 10)) {
        const name = f.product_name || f.description || 'Unknown';
        const brand = f.brands || f.brandName || '';
        const cal = f.nutriments?.['energy-kcal_100g'] || '?';
        output += `- **${name}**${brand ? ` (${brand})` : ''} — ${cal} kcal/100g\n`;
      }
      if (foods.length > 10) output += `\n...and ${foods.length - 10} more results.`;

      return text(output);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'lookup_barcode',
  'Look up a product by barcode. Tries Open Food Facts first, then UPC ItemDB as fallback.',
  {
    barcode: z.string().describe('Product barcode (EAN/UPC, 8-14 digits)'),
  },
  async ({ barcode }) => {
    try {
      const result = await client.lookupBarcode(barcode);
      if (!result.product) return text(`No product found for barcode ${barcode}.`);

      const p = result.product as any;
      let output = `**${p.product_name || 'Unknown'}**`;
      if (p.brands) output += ` (${p.brands})`;
      output += `\nBarcode: ${barcode} | Source: ${result.source || 'unknown'}`;

      if (result.needsNutrition) {
        output += `\n\n⚠️ Product identified but nutrition data is not available. User needs to enter nutrition manually.`;
      } else {
        const n = p.nutriments || {};
        if (p.nutriscore_grade) output += ` | Nutri-Score: ${p.nutriscore_grade.toUpperCase()}`;
        output += `\n\nPer 100g:`;
        output += `\n  Calories: ${n['energy-kcal_100g'] ?? '?'} kcal`;
        output += `\n  Protein: ${n.proteins_100g ?? '?'}g`;
        output += `\n  Carbs: ${n.carbohydrates_100g ?? '?'}g`;
        output += `\n  Fat: ${n.fat_100g ?? '?'}g`;
        if (n.fiber_100g !== undefined) output += `\n  Fiber: ${n.fiber_100g}g`;
        if (n.sugars_100g !== undefined) output += `\n  Sugar: ${n.sugars_100g}g`;
      }

      return text(output);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'get_diet_profile',
  'Get user diet profile (TDEE calculation inputs: sex, DOB, height, activity, goal, macro preset)',
  {},
  async () => {
    try {
      const { profile } = await client.getDietProfile();
      if (!profile) return text('No diet profile set up yet. Use set_diet_profile to create one.');

      let output = '**Diet Profile**\n';
      output += `Sex: ${profile.sex}\n`;
      output += `Date of Birth: ${profile.dateOfBirth}\n`;
      output += `Height: ${profile.heightCm} cm\n`;
      output += `Activity Level: ${profile.activityLevel}\n`;
      output += `Weight Goal: ${profile.weightGoal}\n`;
      output += `Macro Preset: ${profile.macroPreset}\n`;
      if (profile.bmr) output += `BMR: ${profile.bmr} kcal\n`;
      if (profile.tdee) output += `TDEE: ${profile.tdee} kcal\n`;
      if (profile.customMacros) {
        output += `Custom Macros: ${profile.customMacros.proteinPct}% protein, ${profile.customMacros.carbsPct}% carbs, ${profile.customMacros.fatPct}% fat\n`;
      }
      if (profile.updatedAt) output += `\nLast updated: ${profile.updatedAt}`;

      return text(output);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'set_diet_profile',
  'Set/update user diet profile for TDEE calculation and goal setup',
  {
    sex: z.enum(['male', 'female']).describe('Biological sex for BMR calculation'),
    dateOfBirth: z.string().describe('Date of birth (YYYY-MM-DD)'),
    heightCm: z.number().positive().describe('Height in centimeters'),
    activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active']).describe('Activity level'),
    weightGoal: z.enum(['lose_fast', 'lose', 'maintain', 'gain', 'gain_fast']).describe('Weight goal'),
    macroPreset: z.enum(['balanced', 'high_protein', 'low_carb', 'low_fat', 'custom']).describe('Macro split preset'),
    customMacros: z.object({
      proteinPct: z.number(),
      carbsPct: z.number(),
      fatPct: z.number(),
    }).optional().describe('Custom macro percentages (required if macroPreset is "custom")'),
    bmr: z.number().optional().describe('Calculated BMR (kcal)'),
    tdee: z.number().optional().describe('Calculated TDEE (kcal)'),
  },
  async (input) => {
    try {
      const { profile } = await client.setDietProfile(input);
      return text(`Diet profile updated successfully.\nActivity: ${profile.activityLevel} | Goal: ${profile.weightGoal} | Preset: ${profile.macroPreset}`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// MEAL TEMPLATES
// ============================================

const mealTemplateItemSchema = z.object({
  foodDefinitionId: z.string().describe('Food definition ID'),
  foodName: z.string().describe('Food name'),
  servingCount: z.number().positive().describe('Number of servings'),
  calories: z.number().min(0).describe('Calories'),
  protein: z.number().min(0).describe('Protein in grams'),
  carbs: z.number().min(0).describe('Carbs in grams'),
  fat: z.number().min(0).describe('Fat in grams'),
});

server.tool(
  'list_meal_templates',
  'List all saved meal templates (reusable food combinations)',
  {},
  async () => {
    try {
      const { templates } = await client.listMealTemplates();
      if (templates.length === 0) return text('No meal templates yet. Create one with create_meal_template.');

      const lines = templates.map((t) => {
        const items = t.items.map((i) => `  - ${i.foodName} (×${i.servingCount})`).join('\n');
        return `**${t.name}** (${t.totalCalories} kcal | P:${t.totalProtein}g C:${t.totalCarbs}g F:${t.totalFat}g)\n${items}`;
      });
      return text(lines.join('\n\n'));
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'create_meal_template',
  'Create a reusable meal template from a list of foods',
  {
    name: z.string().describe('Template name (e.g., "Morning Oatmeal", "Post-Workout Shake")'),
    items: z.array(mealTemplateItemSchema).min(1).describe('Food items in the template'),
  },
  async ({ name, items }) => {
    try {
      const { template } = await client.createMealTemplate({ name, items });
      return text(`Created template "${template.name}" with ${template.items.length} items (${template.totalCalories} kcal total).`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'update_meal_template',
  'Update a meal template name or items',
  {
    id: z.string().describe('Template ID'),
    name: z.string().optional().describe('New template name'),
    items: z.array(mealTemplateItemSchema).min(1).optional().describe('Updated food items'),
  },
  async ({ id, name, items }) => {
    try {
      const input: UpdateMealTemplateInput = {};
      if (name) input.name = name;
      if (items) input.items = items;
      const { template } = await client.updateMealTemplate(id, input);
      return text(`Updated template "${template.name}" (${template.totalCalories} kcal).`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'delete_meal_template',
  'Delete a meal template',
  {
    id: z.string().describe('Template ID'),
  },
  async ({ id }) => {
    try {
      await client.deleteMealTemplate(id);
      return text('Meal template deleted.');
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'log_meal_template',
  'Log all items from a meal template as meal entries for a specific date and meal',
  {
    id: z.string().describe('Template ID'),
    dateString: z.string().describe('Date to log (YYYY-MM-DD)'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']).describe('Meal type'),
  },
  async ({ id, dateString, mealType }) => {
    try {
      const result = await client.logMealTemplate(id, dateString, mealType);
      return text(`Logged ${result.count} items from template to ${mealType} on ${dateString}.`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// COMMUNITY FOODS & TEMPLATES
// ============================================

server.tool(
  'search_community_foods',
  'Search or browse community-contributed food definitions, sorted by popularity',
  {
    search: z.string().optional().describe('Search query to filter community foods'),
    category: z.string().optional().describe('Filter by food category'),
    barcode: z.string().optional().describe('Look up by exact barcode'),
    limit: z.number().optional().describe('Max results (default: 50)'),
  },
  async ({ search, category, barcode, limit }) => {
    try {
      const result = await client.searchCommunityFoods({ search, category, barcode, limit });
      if (result.foods.length === 0) return text('No community foods found.');

      let output = `Found ${result.total} community foods:\n\n`;
      for (const f of result.foods) {
        output += `- **${f.name}**`;
        if (f.brand) output += ` (${f.brand})`;
        output += ` — ${f.calories} kcal/${f.servingSize}${f.servingUnit}`;
        if (f.usageCount) output += ` | Used ${f.usageCount}x`;
        if (f.contributorName) output += ` | by ${f.contributorName}`;
        output += '\n';
      }
      return text(output);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'share_food_to_community',
  'Share a user food definition to the community database so all users can access it',
  {
    foodId: z.string().describe('ID of the food definition to share'),
  },
  async ({ foodId }) => {
    try {
      const food = await client.shareFoodToCommunity(foodId);
      return text(`Shared "${food.name}" to community! Community food ID: ${food.id}`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'search_community_templates',
  'Search or browse community-shared meal templates, sorted by popularity',
  {
    search: z.string().optional().describe('Search query to filter templates'),
    limit: z.number().optional().describe('Max results (default: 50)'),
  },
  async ({ search, limit }) => {
    try {
      const result = await client.searchCommunityTemplates({ search, limit });
      if (result.templates.length === 0) return text('No community meal templates found.');

      let output = `Found ${result.total} community templates:\n\n`;
      for (const t of result.templates) {
        output += `- **${t.name}** — ${Math.round(t.totalCalories)} kcal`;
        output += ` | ${t.items.length} items`;
        if (t.usageCount) output += ` | Used ${t.usageCount}x`;
        if (t.contributorName) output += ` | by ${t.contributorName}`;
        output += `\n  P:${Math.round(t.totalProtein)}g C:${Math.round(t.totalCarbs)}g F:${Math.round(t.totalFat)}g\n`;
      }
      return text(output);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'share_meal_template',
  'Share a user meal template to the community database',
  {
    templateId: z.string().describe('ID of the meal template to share'),
  },
  async ({ templateId }) => {
    try {
      const template = await client.shareMealTemplate(templateId);
      return text(`Shared "${template.name}" to community! Community template ID: ${template.id}`);
    } catch (err) {
      return errText(err);
    }
  }
);

// ============================================
// WATER INTAKE
// ============================================

server.tool(
  'get_water_intake',
  'Get water intake for a specific date',
  {
    date: z.string().describe('Date (YYYY-MM-DD)'),
  },
  async ({ date }) => {
    try {
      const intake = await client.getWaterIntake(date);
      const lines = [
        `Water Intake for ${date}:`,
        `  Amount: ${intake.amountMl}ml (${(intake.amountMl / 1000).toFixed(1)}L)`,
        `  Glasses: ${intake.glasses}`,
      ];
      return text(lines.join('\n'));
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'add_water',
  'Add a glass of water for a specific date (default 250ml)',
  {
    dateString: z.string().describe('Date (YYYY-MM-DD)'),
    amountMl: z.number().optional().describe('Amount in ml (default 250)'),
  },
  async ({ dateString, amountMl }) => {
    try {
      const result = await client.addWater(dateString, amountMl);
      return text(`Added water. Total: ${result.amountMl}ml (${result.glasses} glasses) for ${dateString}.`);
    } catch (err) {
      return errText(err);
    }
  }
);

server.tool(
  'set_water_intake',
  'Set water intake to a specific amount for a date',
  {
    dateString: z.string().describe('Date (YYYY-MM-DD)'),
    amountMl: z.number().describe('Total amount in ml'),
    glasses: z.number().describe('Total number of glasses'),
  },
  async ({ dateString, amountMl, glasses }) => {
    try {
      await client.setWaterIntake({ dateString, amountMl, glasses });
      return text(`Water intake set to ${amountMl}ml (${glasses} glasses) for ${dateString}.`);
    } catch (err) {
      return errText(err);
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
