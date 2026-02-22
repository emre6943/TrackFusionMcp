/**
 * Tests for MCP tool output formatting.
 *
 * We mock the client methods and verify the formatting logic
 * that the tool handlers use.
 */

import { jest } from '@jest/globals';
import { TrackfusionClient } from '../client.js';

const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: jest.fn().mockResolvedValue(data),
  };
}

describe('Tool output formatting', () => {
  let client: TrackfusionClient;

  beforeEach(() => {
    client = new TrackfusionClient({
      apiKey: 'tf_test',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
    });
    mockFetch.mockReset();
  });

  describe('list_projects formatting', () => {
    it('should format projects with completion percentage', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        projects: [{
          id: 'p1',
          name: 'My Project',
          emoji: '📋',
          taskCounts: { backlog: 0, todo: 2, 'in-progress': 1, testing: 0, done: 3 },
          lastActivityAt: '2026-02-17T10:00:00Z',
        }],
      }));

      const projects = await client.listProjects();
      const p = projects[0];
      const total = Object.values(p.taskCounts).reduce((s, n) => s + n, 0);
      const done = p.taskCounts['done'] || 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      expect(total).toBe(6);
      expect(done).toBe(3);
      expect(pct).toBe(50);
    });

    it('should handle empty projects', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ projects: [] }));
      const projects = await client.listProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('list_tasks formatting', () => {
    it('should return tasks with tags and due dates', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        tasks: [{
          id: 't1',
          title: 'Fix bug',
          status: 'todo',
          priority: 'high',
          tags: [{ tagId: 'tag1', name: 'bug', color: '#ff0000' }],
          dueDate: '2026-02-20T00:00:00Z',
          dueDateString: '2026-02-20',
          order: 0,
        }],
      }));

      const tasks = await client.listTasks('p1');
      const t = tasks[0];

      expect(t.tags).toHaveLength(1);
      expect(t.tags[0].name).toBe('bug');
      expect(t.dueDateString).toBe('2026-02-20');
    });

    it('should return tasks without tags', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        tasks: [{
          id: 't2',
          title: 'Simple task',
          status: 'in-progress',
          priority: 'medium',
          tags: [],
          order: 1,
        }],
      }));

      const tasks = await client.listTasks('p1');
      expect(tasks[0].tags).toEqual([]);
    });
  });

  describe('get_task formatting', () => {
    it('should return full task details', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: {
          id: 't1',
          projectId: 'p1',
          title: 'Detailed Task',
          description: 'This is a detailed description',
          status: 'testing',
          priority: 'urgent',
          tags: [{ tagId: 'tag1', name: 'critical', color: '#ff0000' }],
          order: 0,
          dueDate: '2026-03-01T00:00:00Z',
          dueDateString: '2026-03-01',
          completedAt: null,
          createdAt: '2026-02-17T10:00:00Z',
          updatedAt: '2026-02-17T12:00:00Z',
        },
      }));

      const task = await client.getTask('t1');

      expect(task.title).toBe('Detailed Task');
      expect(task.description).toBe('This is a detailed description');
      expect(task.status).toBe('testing');
      expect(task.priority).toBe('urgent');
      expect(task.projectId).toBe('p1');
    });

    it('should handle task without description or due date', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: {
          id: 't2',
          projectId: 'p1',
          title: 'Minimal Task',
          status: 'backlog',
          priority: 'low',
          tags: [],
          order: 0,
          createdAt: '2026-02-17T10:00:00Z',
          updatedAt: '2026-02-17T10:00:00Z',
        },
      }));

      const task = await client.getTask('t2');

      expect(task.description).toBeUndefined();
      expect(task.dueDate).toBeUndefined();
      expect(task.completedAt).toBeUndefined();
    });
  });

  describe('create_task', () => {
    it('should create a task with all fields', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: {
          id: 'new-1',
          title: 'New Feature',
          status: 'todo',
          priority: 'high',
          projectId: 'p1',
        },
      }));

      const task = await client.createTask('p1', {
        title: 'New Feature',
        description: 'Build the thing',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-03-15',
      });

      expect(task.id).toBe('new-1');
      expect(task.title).toBe('New Feature');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        title: 'New Feature',
        description: 'Build the thing',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-03-15',
      });
    });

    it('should create a task with minimal fields', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: { id: 'new-2', title: 'Quick', status: 'todo', priority: 'medium' },
      }));

      await client.createTask('p1', { title: 'Quick' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({ title: 'Quick' });
    });
  });

  describe('update_task', () => {
    it('should update status', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: { id: 't1', title: 'Task', status: 'done', priority: 'medium' },
      }));

      const task = await client.updateTask('t1', { status: 'done' });

      expect(task.status).toBe('done');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({ status: 'done' });
    });

    it('should update multiple fields', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: { id: 't1', title: 'New Title', status: 'in-progress', priority: 'urgent' },
      }));

      await client.updateTask('t1', {
        title: 'New Title',
        priority: 'urgent',
        description: 'Updated desc',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        title: 'New Title',
        priority: 'urgent',
        description: 'Updated desc',
      });
    });

    it('should clear due date with null', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        task: { id: 't1', title: 'Task', status: 'todo', priority: 'medium' },
      }));

      await client.updateTask('t1', { dueDate: null });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.dueDate).toBeNull();
    });
  });

  // ---------- New module formatting tests ----------

  describe('habits formatting', () => {
    it('should format habit list with goals', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        habits: [{
          id: 'h1', name: 'Exercise', emoji: '🏋️', isActive: true,
          goalFrequency: 3, goalPeriod: 'week', priority: 1,
          startDate: '2026-01-01T00:00:00Z',
        }],
      }));

      const habits = await client.listHabits(true);
      expect(habits[0].name).toBe('Exercise');
      expect(habits[0].goalFrequency).toBe(3);
    });
  });

  describe('items formatting', () => {
    it('should format item list with price and status', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        items: [{
          id: 'i1', name: 'MacBook Pro', status: 'active',
          purchasePrice: 2499, currency: 'EUR',
          purchaseDate: '2025-06-15T00:00:00Z',
        }],
      }));

      const items = await client.listItems('active');
      expect(items[0].purchasePrice).toBe(2499);
      expect(items[0].status).toBe('active');
    });
  });

  describe('journal formatting', () => {
    it('should format journal entries', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        entries: [{
          id: 'j1', title: 'Great Day', content: '<p>Had fun</p>',
          emoji: '😊', mood: 'happy',
          createdAt: '2026-02-22T10:00:00Z',
        }],
      }));

      const entries = await client.listJournalEntries();
      expect(entries[0].title).toBe('Great Day');
      expect(entries[0].mood).toBe('happy');
    });

    it('should format todos with completion status', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        todos: [
          { id: 'td1', title: 'Buy groceries', isCompleted: false, priority: 'high' },
          { id: 'td2', title: 'Call dentist', isCompleted: true, priority: 'medium' },
        ],
      }));

      const todos = await client.listJournalTodos();
      expect(todos[0].isCompleted).toBe(false);
      expect(todos[1].isCompleted).toBe(true);
    });
  });

  describe('spending formatting', () => {
    it('should format spendings with amounts', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        spendings: [{
          id: 's1', name: 'Groceries', amount: 85.50,
          date: '2026-02-22T00:00:00Z',
        }],
      }));

      const spendings = await client.listSpendings();
      expect(spendings[0].amount).toBe(85.50);
    });
  });

  describe('people formatting', () => {
    it('should format people with relationship and interactions', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        people: [{
          id: 'p1', name: 'Alice', relationshipTypeName: 'Close Friend',
          interactions: [
            { id: 'int1', typeName: 'Met in person', dateString: '2026-02-20', note: 'Coffee' },
          ],
          connections: [{ personId: 'p2', personName: 'Bob' }],
          lastContactedAt: '2026-02-20T00:00:00Z',
        }],
      }));

      const people = await client.listPeople();
      expect(people[0].interactions).toHaveLength(1);
      expect(people[0].connections).toHaveLength(1);
    });
  });

  describe('exercise formatting', () => {
    it('should format workout sessions with exercises', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        sessions: [{
          id: 'ws1', dateString: '2026-02-22', name: 'Push Day',
          exercises: [
            { id: 'e1', exerciseName: 'Bench Press', sets: [{ reps: 10, weight: 80 }] },
            { id: 'e2', exerciseName: 'Shoulder Press', sets: [{ reps: 12, weight: 30 }] },
          ],
          totalVolume: 1160, durationMinutes: 60,
        }],
      }));

      const sessions = await client.listWorkoutSessions();
      expect(sessions[0].exercises).toHaveLength(2);
      expect(sessions[0].totalVolume).toBe(1160);
    });
  });

  describe('portfolio formatting', () => {
    it('should format portfolio summary', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        summary: {
          totalValue: 150000, totalInvested: 100000,
          totalPnl: 50000, totalPnlPercent: 50,
          allocationByType: { crypto: 90000, stock: 60000 },
          holdingCount: 8,
        },
        holdings: [
          { symbol: 'BTC', assetName: 'Bitcoin', quantity: 1.5, currentPrice: 60000, currentValue: 90000, pnl: 40000, pnlPercent: 80 },
        ],
      }));

      const result = await client.getPortfolioSummary();
      expect(result.summary.totalPnlPercent).toBe(50);
      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].symbol).toBe('BTC');
    });
  });
});
