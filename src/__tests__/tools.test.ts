/**
 * Tests for MCP tool handlers.
 *
 * We import the module, mock the client, and call tools via the server's
 * internal handler map. Since McpServer doesn't expose handlers directly,
 * we test by mocking the client methods and verifying tool output formatting.
 */

import { jest } from '@jest/globals';
import { TrackfusionClient } from '../client.js';

// We'll test the tool logic by directly calling client methods and verifying
// the formatting logic matches what the tools produce.

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
});
