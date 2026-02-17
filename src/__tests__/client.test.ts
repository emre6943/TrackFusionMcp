import { jest } from '@jest/globals';
import { TrackfusionClient } from '../client.js';

// Mock global fetch
const mockFetch = jest.fn() as jest.Mock;
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
  };
}

describe('TrackfusionClient', () => {
  let client: TrackfusionClient;

  beforeEach(() => {
    client = new TrackfusionClient({
      apiKey: 'tf_test_key',
      baseUrl: 'https://api.example.com/',
      timeoutMs: 5000,
    });
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should strip trailing slash from baseUrl', () => {
      // Verify by making a request and checking the URL
      mockFetch.mockResolvedValue(jsonResponse({ projects: [] }));
      client.listProjects();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/projects',
        expect.anything()
      );
    });
  });

  describe('request headers', () => {
    it('should send Authorization and Content-Type headers', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ projects: [] }));
      await client.listProjects();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer tf_test_key',
        'Content-Type': 'application/json',
      });
    });

    it('should include AbortSignal for timeout', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ projects: [] }));
      await client.listProjects();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response with error body', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Invalid API key' }, 401));

      await expect(client.listProjects()).rejects.toThrow('Invalid API key');
    });

    it('should throw with status text when body has no error field', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(client.listProjects()).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should throw when json parsing fails on error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('parse error')),
      });

      await expect(client.listProjects()).rejects.toThrow('HTTP 500');
    });
  });

  describe('retry logic', () => {
    it('should retry once on 503', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({ projects: [] }));

      const result = await client.listProjects();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });

    it('should not retry on 401', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401));

      await expect(client.listProjects()).rejects.toThrow('Unauthorized');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Not found' }, 404));

      await expect(client.listProjects()).rejects.toThrow('Not found');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('listProjects', () => {
    it('should fetch projects without archived by default', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        projects: [{ id: 'p1', name: 'Project 1' }],
      }));

      const result = await client.listProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/projects',
        expect.anything()
      );
      expect(result).toEqual([{ id: 'p1', name: 'Project 1' }]);
    });

    it('should include archived when requested', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ projects: [] }));

      await client.listProjects(true);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/projects?includeArchived=true',
        expect.anything()
      );
    });
  });

  describe('listTasks', () => {
    it('should fetch tasks for a project', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        tasks: [{ id: 't1', title: 'Task 1' }],
      }));

      const result = await client.listTasks('proj-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/projects/proj-1/tasks',
        expect.anything()
      );
      expect(result).toEqual([{ id: 't1', title: 'Task 1' }]);
    });

    it('should include status filter', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ tasks: [] }));

      await client.listTasks('proj-1', 'todo,in-progress');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/projects/proj-1/tasks?status=todo%2Cin-progress',
        expect.anything()
      );
    });
  });

  describe('getTask', () => {
    it('should fetch a single task', async () => {
      const task = { id: 't1', title: 'My Task', status: 'todo' };
      mockFetch.mockResolvedValue(jsonResponse({ task }));

      const result = await client.getTask('t1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks/t1',
        expect.anything()
      );
      expect(result).toEqual(task);
    });
  });

  describe('createTask', () => {
    it('should POST to create a task', async () => {
      const task = { id: 'new-1', title: 'New Task', status: 'todo' };
      mockFetch.mockResolvedValue(jsonResponse({ task }));

      const result = await client.createTask('proj-1', {
        title: 'New Task',
        priority: 'high',
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/projects/proj-1/tasks');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ title: 'New Task', priority: 'high' });
      expect(result).toEqual(task);
    });
  });

  describe('updateTask', () => {
    it('should PATCH to update a task', async () => {
      const task = { id: 't1', title: 'Updated', status: 'done' };
      mockFetch.mockResolvedValue(jsonResponse({ task }));

      const result = await client.updateTask('t1', {
        status: 'done',
        title: 'Updated',
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/tasks/t1');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ status: 'done', title: 'Updated' });
      expect(result).toEqual(task);
    });

    it('should send null dueDate to clear it', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ task: { id: 't1' } }));

      await client.updateTask('t1', { dueDate: null });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ dueDate: null });
    });
  });
});
