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

    it('should include linked friend name in output', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        people: [{
          id: 'p1', name: 'Alice', relationshipTypeName: 'Close Friend',
          interactions: [],
          connections: [],
          linkedFriendUserId: 'uid-1',
          linkedFriendName: 'Jane Doe',
          linkedFriendEmail: 'jane@example.com',
        }],
      }));

      const people = await client.listPeople();
      expect(people[0].linkedFriendName).toBe('Jane Doe');

      // Verify the formatting logic includes linked info
      const p = people[0];
      const linked = p.linkedFriendName ? ` | Linked: ${p.linkedFriendName}` : '';
      expect(linked).toBe(' | Linked: Jane Doe');
    });

    it('should not include linked text when no friend linked', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        people: [{
          id: 'p2', name: 'Bob', relationshipTypeName: 'Colleague',
          interactions: [],
          connections: [],
        }],
      }));

      const people = await client.listPeople();
      const p = people[0];
      const linked = p.linkedFriendName ? ` | Linked: ${p.linkedFriendName}` : '';
      expect(linked).toBe('');
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
          { assetId: 'btc-id', symbol: 'BTC', assetName: 'Bitcoin', quantity: 1.5, currentPrice: 60000, currentValue: 90000, pnl: 40000, pnlPercent: 80 },
        ],
      }));

      const result = await client.getPortfolioSummary();
      expect(result.summary.totalPnlPercent).toBe(50);
      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].symbol).toBe('BTC');
    });
  });

  // ---------- Friends formatting ----------

  describe('list_friends formatting', () => {
    it('should format friends with name and email', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        friends: [
          { id: 'f1', friendUserId: 'u2', friendName: 'Alice Smith', friendEmail: 'alice@example.com', createdAt: '2026-01-15T00:00:00Z' },
          { id: 'f2', friendUserId: 'u3', friendName: 'Bob Jones', friendEmail: 'bob@example.com', createdAt: '2026-02-01T00:00:00Z' },
        ],
      }));

      const friends = await client.listFriends();

      expect(friends).toHaveLength(2);
      expect(friends[0].friendName).toBe('Alice Smith');
      expect(friends[0].friendEmail).toBe('alice@example.com');
      expect(friends[0].friendUserId).toBe('u2');
      expect(friends[1].friendName).toBe('Bob Jones');
    });

    it('should handle empty friends list', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ friends: [] }));

      const friends = await client.listFriends();
      expect(friends).toEqual([]);
    });
  });

  describe('list_friend_requests formatting', () => {
    it('should format requests with direction', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        requests: [
          { id: 'fr1', direction: 'incoming', userId: 'u5', displayName: 'Eve', email: 'eve@example.com', createdAt: '2026-02-20T00:00:00Z' },
          { id: 'fr2', direction: 'outgoing', userId: 'u6', displayName: 'Frank', email: 'frank@example.com', createdAt: '2026-02-21T00:00:00Z' },
        ],
      }));

      const requests = await client.listFriendRequests();

      expect(requests).toHaveLength(2);
      expect(requests[0].direction).toBe('incoming');
      expect(requests[0].displayName).toBe('Eve');
      expect(requests[0].email).toBe('eve@example.com');
      expect(requests[1].direction).toBe('outgoing');
      expect(requests[1].displayName).toBe('Frank');
    });

    it('should handle empty requests list', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ requests: [] }));

      const requests = await client.listFriendRequests();
      expect(requests).toEqual([]);
    });
  });

  // ---------- Community Foods & Templates ----------

  describe('search_community_foods formatting', () => {
    it('should format community foods with contributor and usage', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        foods: [
          { id: 'cf1', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, isCommunity: true, contributorName: 'Alice', usageCount: 42 },
          { id: 'cf2', name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 1.8, isCommunity: true, contributorName: null, usageCount: 15 },
        ],
        total: 2,
      }));

      const result = await client.searchCommunityFoods({ search: 'chicken' });

      expect(result.foods).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.foods[0].name).toBe('Chicken Breast');
      expect(result.foods[0].isCommunity).toBe(true);
      expect(result.foods[0].contributorName).toBe('Alice');
      expect(result.foods[0].usageCount).toBe(42);
    });

    it('should handle empty community foods', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ foods: [], total: 0 }));

      const result = await client.searchCommunityFoods();
      expect(result.foods).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('share_food_to_community formatting', () => {
    it('should return shared food with community flag', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        food: { id: 'cf1', name: 'Oatmeal', isCommunity: true, contributorName: 'Bob', usageCount: 0, calories: 150, protein: 5, carbs: 27, fat: 2.5 },
      }));

      const food = await client.shareFoodToCommunity('f1');

      expect(food.name).toBe('Oatmeal');
      expect(food.isCommunity).toBe(true);
      expect(food.contributorName).toBe('Bob');
    });
  });

  describe('search_community_templates formatting', () => {
    it('should format community templates with totals', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        templates: [{
          id: 'ct1', name: 'Bulking Breakfast', isCommunity: true,
          contributorName: 'Charlie', usageCount: 28,
          items: [
            { foodName: 'Eggs', servingCount: 3, calories: 210, protein: 18, carbs: 1.5, fat: 15 },
            { foodName: 'Toast', servingCount: 2, calories: 160, protein: 6, carbs: 30, fat: 2 },
          ],
          totalCalories: 370, totalProtein: 24, totalCarbs: 31.5, totalFat: 17,
          createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z',
        }],
        total: 1,
      }));

      const result = await client.searchCommunityTemplates({ search: 'breakfast' });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe('Bulking Breakfast');
      expect(result.templates[0].isCommunity).toBe(true);
      expect(result.templates[0].contributorName).toBe('Charlie');
      expect(result.templates[0].totalCalories).toBe(370);
      expect(result.total).toBe(1);
    });

    it('should handle empty community templates', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ templates: [], total: 0 }));

      const result = await client.searchCommunityTemplates();
      expect(result.templates).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('share_meal_template formatting', () => {
    it('should return shared template with community flag', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        template: {
          id: 'ct1', name: 'Post-Workout', isCommunity: true,
          contributorName: 'Dave', usageCount: 0,
          items: [{ foodName: 'Protein Shake', servingCount: 1, calories: 200, protein: 40, carbs: 5, fat: 2 }],
          totalCalories: 200, totalProtein: 40, totalCarbs: 5, totalFat: 2,
          createdAt: '2026-03-14T00:00:00Z', updatedAt: '2026-03-14T00:00:00Z',
        },
      }));

      const template = await client.shareMealTemplate('mt1');

      expect(template.name).toBe('Post-Workout');
      expect(template.isCommunity).toBe(true);
      expect(template.contributorName).toBe('Dave');
      expect(template.usageCount).toBe(0);
    });
  });

  describe('lookup_barcode formatting', () => {
    it('should include needsNutrition warning when product lacks nutrition data', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        product: { product_name: 'Mystery Bar', brands: 'SnackCo' },
        source: 'upc_itemdb',
        needsNutrition: true,
      }));

      const result = await client.lookupBarcode('1234567890');

      expect(result.product).toBeTruthy();
      expect(result.needsNutrition).toBe(true);

      // Verify the formatting logic that the tool handler uses
      const p = result.product as { product_name?: string; brands?: string };
      let output = `**${p.product_name || 'Unknown'}**`;
      if (p.brands) output += ` (${p.brands})`;
      output += `\nBarcode: 1234567890 | Source: ${result.source || 'unknown'}`;

      if (result.needsNutrition) {
        output += `\n\n⚠️ Product identified but nutrition data is not available. User needs to enter nutrition manually.`;
      }

      expect(output).toContain('Mystery Bar');
      expect(output).toContain('SnackCo');
      expect(output).toContain('nutrition data is not available');
      expect(output).toContain('enter nutrition manually');
      expect(output).not.toContain('Per 100g');
    });

    it('should show nutrition data when needsNutrition is false', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        product: {
          product_name: 'Oat Milk',
          brands: 'Oatly',
          nutriments: {
            'energy-kcal_100g': 45,
            proteins_100g: 1,
            carbohydrates_100g: 6.5,
            fat_100g: 1.5,
          },
        },
        source: 'off',
      }));

      const result = await client.lookupBarcode('9876543210');

      expect(result.product).toBeTruthy();
      expect(result.needsNutrition).toBeUndefined();

      // Verify formatting does NOT include the warning
      const p = result.product as { product_name?: string; brands?: string; nutriments?: Record<string, number> };
      let output = `**${p.product_name || 'Unknown'}**`;
      if (p.brands) output += ` (${p.brands})`;
      output += `\nBarcode: 9876543210 | Source: ${result.source || 'unknown'}`;

      if (result.needsNutrition) {
        output += `\n\n⚠️ Product identified but nutrition data is not available.`;
      } else {
        const n = p.nutriments || {};
        output += `\n\nPer 100g:`;
        output += `\n  Calories: ${n['energy-kcal_100g'] ?? '?'} kcal`;
      }

      expect(output).toContain('Per 100g');
      expect(output).toContain('45 kcal');
      expect(output).not.toContain('nutrition data is not available');
    });
  });

  describe('list_projects shared status', () => {
    it('should include sharedWith and isOwner fields', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        projects: [{
          id: 'p1',
          name: 'Shared Project',
          emoji: '📋',
          sharedWith: ['user-2', 'user-3'],
          isOwner: true,
          taskCounts: { backlog: 0, todo: 1, 'in-progress': 0, testing: 0, done: 2 },
          lastActivityAt: '2026-02-22T10:00:00Z',
        }],
      }));

      const projects = await client.listProjects();
      const p = projects[0];

      expect(p.sharedWith).toEqual(['user-2', 'user-3']);
      expect(p.isOwner).toBe(true);
    });

    it('should handle projects without sharing fields', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        projects: [{
          id: 'p2',
          name: 'Private Project',
          emoji: '🔒',
          taskCounts: { backlog: 0, todo: 0, 'in-progress': 0, testing: 0, done: 0 },
          lastActivityAt: '2026-02-22T10:00:00Z',
        }],
      }));

      const projects = await client.listProjects();
      const p = projects[0];

      expect(p.sharedWith).toBeUndefined();
      expect(p.isOwner).toBeUndefined();
    });
  });
});
