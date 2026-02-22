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

  // ---------- Projects ----------

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

  // ---------- Habits ----------

  describe('listHabits', () => {
    it('should fetch all habits by default', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        habits: [{ id: 'h1', name: 'Exercise', isActive: true }],
      }));

      const result = await client.listHabits();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/habits',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by active status', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ habits: [] }));

      await client.listHabits(true);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/habits?active=true',
        expect.anything()
      );
    });
  });

  describe('createHabit', () => {
    it('should POST to create a habit', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        habit: { id: 'h1', name: 'Read', goalFrequency: 1, goalPeriod: 'day' },
      }));

      const result = await client.createHabit({
        name: 'Read',
        goalFrequency: 1,
        goalPeriod: 'week',
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/habits');
      expect(options.method).toBe('POST');
      expect(result.name).toBe('Read');
    });
  });

  describe('toggleHabitEntry', () => {
    it('should POST to toggle a habit entry', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ toggled: 'on', date: '2026-02-22' }));

      const result = await client.toggleHabitEntry('h1', '2026-02-22');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/habits/h1/entries');
      expect(options.method).toBe('POST');
      expect(result.toggled).toBe('on');
    });
  });

  describe('getHabitAnalytics', () => {
    it('should fetch habit analytics', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        analytics: { currentStreak: 5, longestStreak: 10, completionRate: 0.8 },
      }));

      const result = await client.getHabitAnalytics('h1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/habits/h1/analytics',
        expect.anything()
      );
      expect(result?.currentStreak).toBe(5);
    });

    it('should return null when no analytics exist', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ analytics: null }));

      const result = await client.getHabitAnalytics('h1');
      expect(result).toBeNull();
    });
  });

  // ---------- Items ----------

  describe('listItems', () => {
    it('should fetch items with optional filters', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        items: [{ id: 'i1', name: 'Laptop', status: 'active' }],
      }));

      const result = await client.listItems('active');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/items?status=active',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createItem', () => {
    it('should POST to create an item', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        item: { id: 'i1', name: 'Phone', purchasePrice: 999 },
      }));

      const result = await client.createItem({
        name: 'Phone',
        categoryId: 'c1',
        purchaseDate: '2026-01-15',
        purchasePrice: 999,
        currency: 'EUR',
      });

      expect(result.name).toBe('Phone');
    });
  });

  describe('deleteItem', () => {
    it('should DELETE an item', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ success: true }));

      await client.deleteItem('i1');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/items/i1');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('listItemCategories', () => {
    it('should fetch item categories', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        categories: [{ id: 'c1', name: 'Electronics' }],
      }));

      const result = await client.listItemCategories();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Electronics');
    });
  });

  // ---------- Journal ----------

  describe('listJournalEntries', () => {
    it('should fetch journal entries with date filters', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        entries: [{ id: 'j1', title: 'My Day' }],
      }));

      const result = await client.listJournalEntries('2026-02-01', '2026-02-28');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/journal-entries?from=2026-02-01&to=2026-02-28',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getDayEntry', () => {
    it('should fetch a day entry', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        dayEntry: { id: 'uid_2026-02-22', date: '2026-02-22', notes: [] },
      }));

      const result = await client.getDayEntry('2026-02-22');
      expect(result?.date).toBe('2026-02-22');
    });

    it('should return null when no day entry exists', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ dayEntry: null }));

      const result = await client.getDayEntry('2026-01-01');
      expect(result).toBeNull();
    });
  });

  describe('listJournalTodos', () => {
    it('should fetch pending todos', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        todos: [{ id: 'td1', title: 'Buy milk', isCompleted: false }],
      }));

      const result = await client.listJournalTodos(false);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/journal-todos?completed=false',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  // ---------- Spending ----------

  describe('listSpendings', () => {
    it('should fetch spendings with filters', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        spendings: [{ id: 's1', description: 'Groceries', amount: 50 }],
      }));

      const result = await client.listSpendings({ from: '2026-02-01', categoryId: 'cat1' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/spendings?from=2026-02-01&categoryId=cat1',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createSpending', () => {
    it('should POST to create a spending', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        spending: { id: 's1', description: 'Coffee', amount: 5 },
      }));

      const result = await client.createSpending({
        description: 'Coffee',
        amount: 5,
        categoryId: 'c1',
        sourceId: 'src1',
        date: '2026-02-22',
      });

      expect(result.description).toBe('Coffee');
    });
  });

  describe('deleteSpending', () => {
    it('should DELETE a spending', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ success: true }));

      await client.deleteSpending('s1');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/spendings/s1');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('listIncomes', () => {
    it('should fetch incomes', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        incomes: [{ id: 'inc1', name: 'Salary', income: 5000 }],
      }));

      const result = await client.listIncomes('2026-02-01', '2026-02-28');
      expect(result).toHaveLength(1);
    });
  });

  describe('listSpendingCategories', () => {
    it('should fetch spending categories', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        categories: [{ id: 'c1', name: 'Food', emoji: '🍕' }],
      }));

      const result = await client.listSpendingCategories();
      expect(result[0].name).toBe('Food');
    });
  });

  describe('listSpendingSources', () => {
    it('should fetch spending sources', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        sources: [{ id: 'src1', name: 'Credit Card' }],
      }));

      const result = await client.listSpendingSources();
      expect(result[0].name).toBe('Credit Card');
    });
  });

  describe('getSpendingAnalytics', () => {
    it('should fetch spending analytics', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        analytics: { totalSpend: 1500, totalIncome: 5000 },
      }));

      const result = await client.getSpendingAnalytics('2026-02');
      expect(result?.totalSpend).toBe(1500);
    });
  });

  // ---------- People ----------

  describe('listPeople', () => {
    it('should fetch people with search', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        people: [{ id: 'p1', name: 'Alice' }],
      }));

      const result = await client.listPeople({ search: 'ali' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/people?search=ali',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createPerson', () => {
    it('should POST to create a person', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        person: { id: 'p1', name: 'Bob', relationshipTypeName: 'Friend' },
      }));

      const result = await client.createPerson({
        name: 'Bob',
        relationshipTypeId: 'rt1',
      });

      expect(result.name).toBe('Bob');
    });
  });

  describe('addInteraction', () => {
    it('should POST to add an interaction', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        interaction: { id: 'int-1', typeName: 'Met in person', dateString: '2026-02-22', note: 'Had coffee' },
      }));

      const result = await client.addInteraction('p1', {
        typeId: 'it1',
        date: '2026-02-22',
        note: 'Had coffee',
      });

      expect(result.typeName).toBe('Met in person');
    });
  });

  // ---------- Exercise ----------

  describe('listWorkoutSessions', () => {
    it('should fetch workout sessions', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        sessions: [{ id: 'ws1', dateString: '2026-02-22', exercises: [] }],
      }));

      const result = await client.listWorkoutSessions('2026-02-01');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/workout-sessions?from=2026-02-01',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createWorkoutSession', () => {
    it('should POST to create a workout session', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        session: { id: 'ws1', dateString: '2026-02-22', exercises: [], totalVolume: 5000 },
      }));

      const result = await client.createWorkoutSession({
        date: '2026-02-22',
        exercises: [{
          exerciseDefinitionId: 'ex1',
          sets: [{ reps: 10, weight: 50 }],
        }],
      });

      expect(result.id).toBe('ws1');
    });
  });

  describe('listWorkoutTemplates', () => {
    it('should fetch workout templates', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        templates: [{ id: 'wt1', name: 'Push Day' }],
      }));

      const result = await client.listWorkoutTemplates();
      expect(result[0].name).toBe('Push Day');
    });
  });

  describe('listExerciseDefinitions', () => {
    it('should fetch exercise definitions', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        exercises: [{ id: 'ed1', name: 'Bench Press', muscleGroups: ['chest'] }],
      }));

      const result = await client.listExerciseDefinitions();
      expect(result[0].name).toBe('Bench Press');
    });
  });

  describe('getPersonalRecords', () => {
    it('should fetch personal records with exercise filter', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        records: [{ id: 'pr1', exerciseName: 'Squat', type: 'max-weight', value: 140 }],
      }));

      const result = await client.getPersonalRecords('ed1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/personal-records?exerciseId=ed1',
        expect.anything()
      );
      expect(result[0].value).toBe(140);
    });
  });

  // ---------- Portfolio ----------

  describe('listInvestmentTransactions', () => {
    it('should fetch transactions with filters', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        transactions: [{ id: 'tx1', assetId: 'btc-id', type: 'buy', quantity: 0.5 }],
      }));

      const result = await client.listInvestmentTransactions({ assetId: 'btc-id' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/investment-transactions?assetId=btc-id',
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('listAssets', () => {
    it('should fetch assets with type filter', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        assets: [{ id: 'a1', symbol: 'BTC', name: 'Bitcoin' }],
      }));

      const result = await client.listAssets('crypto');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/assets?assetType=crypto',
        expect.anything()
      );
      expect(result[0].symbol).toBe('BTC');
    });
  });

  describe('getAssetPriceHistory', () => {
    it('should fetch price history', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        asset: { id: 'a1', symbol: 'BTC', name: 'Bitcoin' },
        prices: [{ id: '2026-02-22', price: 50000 }],
      }));

      const result = await client.getAssetPriceHistory('a1', '2026-02-01');

      expect(result.asset.symbol).toBe('BTC');
      expect(result.prices).toHaveLength(1);
    });
  });

  describe('getPortfolioSummary', () => {
    it('should fetch portfolio summary', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        summary: {
          totalValue: 100000,
          totalInvested: 80000,
          totalPnl: 20000,
          totalPnlPercent: 25,
          allocationByType: { crypto: 60000, stock: 40000 },
          holdingCount: 5,
        },
        holdings: [],
      }));

      const result = await client.getPortfolioSummary();

      expect(result.summary.totalValue).toBe(100000);
      expect(result.summary.holdingCount).toBe(5);
    });
  });
});
