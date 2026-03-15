/**
 * Trackfusion API Client
 *
 * HTTP client for the Trackfusion REST API.
 * Authenticates via API key (Bearer token).
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 2_000;
const MAX_RETRIES = 1;

export interface TrackfusionClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
}

// ============================================
// PROJECTS & TASKS
// ============================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  color: string;
  isArchived: boolean;
  sharedWith?: string[];
  isOwner?: boolean;
  taskCounts: Record<string, number>;
  overdueCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  tags: Array<{ tagId: string; name: string; color: string }>;
  order: number;
  dueDate?: string;
  dueDateString?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  tags?: Array<{ tagId: string; name: string; color: string }>;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  tags?: Array<{ tagId: string; name: string; color: string }>;
  order?: number;
  dueDate?: string | null;
}

// ============================================
// HABITS
// ============================================

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  goalFrequency: number;
  goalPeriod: string;
  isActive: boolean;
  priority?: number;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  completionDate: string;
  completionDateString: string;
}

export interface HabitAnalytics {
  currentStreak: number;
  longestStreak: number;
  lifetimeCompletions: number;
  completionRate: number;
  last30Days: number[];
  yearlyCompletions: Record<string, number>;
  monthlyCompletions: Record<string, number>;
}

export interface CreateHabitInput {
  name: string;
  goalFrequency: number;
  goalPeriod: string;
  emoji?: string;
  color?: string;
  startDate?: string;
  notes?: string;
  priority?: number;
}

export interface UpdateHabitInput {
  name?: string;
  goalFrequency?: number;
  goalPeriod?: string;
  emoji?: string;
  color?: string;
  isActive?: boolean;
  notes?: string;
  priority?: number;
  endDate?: string | null;
}

// ============================================
// ITEMS
// ============================================

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  purchaseDate: string;
  purchasePrice: number;
  currency: string;
  status: string;
  expectedLifespan?: number;
  notes?: string;
  replacementDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemCategory {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export interface CreateItemInput {
  name: string;
  categoryId: string;
  purchaseDate: string;
  purchasePrice: number;
  currency: string;
  status?: string;
  expectedLifespan?: number;
  notes?: string;
}

export interface UpdateItemInput {
  name?: string;
  categoryId?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency?: string;
  status?: string;
  expectedLifespan?: number;
  notes?: string;
  replacementDate?: string | null;
}

// ============================================
// JOURNAL
// ============================================

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  emoji?: string;
  color?: string;
  mood?: string;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DayEntry {
  id: string;
  date: string;
  notes: Array<{
    id: string;
    text: string;
    color: string;
    emoji: string;
  }>;
}

export interface JournalTodo {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  priority: string;
  dueDate?: string;
  order: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalEntryInput {
  title: string;
  content: string;
  emoji?: string;
  color?: string;
  mood?: string;
  tagIds?: string[];
}

export interface CreateJournalTodoInput {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
}

export interface UpdateJournalTodoInput {
  title?: string;
  description?: string;
  isCompleted?: boolean;
  priority?: string;
  dueDate?: string | null;
  order?: number;
}

// ============================================
// SPENDING
// ============================================

export interface Spending {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  sourceId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  name: string;
  description?: string;
  income: number;
  sourceId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpendingCategory {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  monthlyLimit?: number;
}

export interface SpendingSource {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export interface SpendingAnalytics {
  userId: string;
  date: string;
  totalSpend: number;
  totalIncome: number;
}

export interface CreateSpendingInput {
  description: string;
  amount: number;
  categoryId: string;
  sourceId: string;
  date: string;
}

export interface CreateIncomeInput {
  name: string;
  income: number;
  sourceId: string;
  date: string;
  description?: string;
}

// ============================================
// PEOPLE
// ============================================

export interface Person {
  id: string;
  name: string;
  nickname?: string;
  description?: string;
  birthday?: string;
  location?: string;
  relationshipTypeId: string;
  relationshipTypeName: string;
  priority: number;
  isArchived: boolean;
  interactions: PersonInteraction[];
  connections: PersonConnection[];
  tags: Array<{ tagId: string; tagName: string; categoryName: string; color: string }>;
  pros: string[];
  cons: string[];
  linkedFriendUserId?: string;
  linkedFriendName?: string;
  linkedFriendEmail?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonInteraction {
  id: string;
  typeId: string;
  typeName: string;
  date: string;
  dateString: string;
  note: string;
  sentiment: string;
}

export interface PersonConnection {
  personId: string;
  personName: string;
  relationshipTypeName: string;
}

export interface CreatePersonInput {
  name: string;
  relationshipTypeId: string;
  nickname?: string;
  description?: string;
  birthday?: string;
  location?: string;
  priority?: number;
  linkedFriendUserId?: string;
  linkedFriendName?: string;
  linkedFriendEmail?: string;
}

export interface UpdatePersonInput {
  name?: string;
  nickname?: string;
  description?: string;
  birthday?: string | null;
  location?: string;
  priority?: number;
  isArchived?: boolean;
  relationshipTypeId?: string;
  tags?: Array<{ tagId: string; tagName: string; categoryName: string; color: string }>;
  pros?: string[];
  cons?: string[];
  linkedFriendUserId?: string | null;
  linkedFriendName?: string;
  linkedFriendEmail?: string;
}

export interface AddInteractionInput {
  typeId: string;
  date: string;
  note: string;
  sentiment?: string;
  location?: string;
}

// ============================================
// EXERCISE
// ============================================

export interface WorkoutSession {
  id: string;
  date: string;
  dateString: string;
  name?: string;
  exercises: WorkoutExercise[];
  durationMinutes?: number;
  totalVolume?: number;
  notes?: string;
  energyLevel?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseDefinitionId: string;
  exerciseName: string;
  muscleGroups: string[];
  sets: ExerciseSet[];
  order: number;
  supersetGroupId?: string;
}

export interface ExerciseSet {
  setNumber: number;
  reps: number;
  weight: number;
  isWarmup: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  exercises: Array<{
    exerciseDefinitionId: string;
    exerciseName: string;
    targetSets: number;
    targetReps?: number;
    targetWeight?: number;
    supersetGroupId?: string;
  }>;
  usageCount: number;
  lastUsedAt?: string;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  muscleGroups: string[];
  secondaryMuscles: string[];
  equipment: string;
  isCompound: boolean;
  trackingType?: string;
  isSystem: boolean;
}

export interface PersonalRecord {
  id: string;
  exerciseDefinitionId: string;
  exerciseName: string;
  type: string;
  value: number;
  weight?: number;
  reps?: number;
  date: string;
  dateString: string;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  dateString: string;
  bodyWeight?: number;
  bodyFat?: number;
  [key: string]: unknown;
}

export interface CreateWorkoutSessionInput {
  date: string;
  name?: string;
  exercises: Array<{
    exerciseDefinitionId: string;
    exerciseName?: string;
    muscleGroups?: string[];
    sets: Array<{
      setNumber?: number;
      reps: number;
      weight: number;
      isWarmup?: boolean;
      isDropset?: boolean;
      rpe?: number;
    }>;
    order?: number;
    notes?: string;
  }>;
  durationMinutes?: number;
  notes?: string;
  energyLevel?: number;
  templateId?: string;
}

// ============================================
// PORTFOLIO
// ============================================

export interface InvestmentTransaction {
  id: string;
  type: string;
  assetType: string;
  assetId: string;
  quantity: number;
  pricePerUnit: number;
  amountIn: number;
  amountOut: number;
  fees?: number;
  currency: string;
  date: string;
  description?: string;
  sourceId?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  lastPrice?: number;
  lastPriceUpdate?: string;
  currency: string;
}

export interface PriceHistoryEntry {
  id: string;
  date: string;
  price: number;
  volume?: number;
  currency: string;
}

export interface PortfolioSummary {
  summary: {
    totalValue: number;
    totalInvested: number;
    totalPnl: number;
    totalPnlPercent: number;
    allocationByType: Record<string, number>;
    holdingCount: number;
  };
  holdings: Array<{
    assetId: string;
    symbol: string;
    assetName: string;
    assetType: string;
    quantity: number;
    currentPrice: number;
    currentValue: number;
    totalInvested: number;
    pnl: number;
    pnlPercent: number;
  }>;
}

// ============================================
// DIET & NUTRITION
// ============================================

export interface FoodDefinition {
  id: string;
  userId: string | null;
  name: string;
  nameNormalized: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  barcode?: string;
  category?: string;
  householdServingName?: string;
  householdServingGrams?: number;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFoodInput {
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  barcode?: string;
  category?: string;
  householdServingName?: string;
  householdServingGrams?: number;
}

export interface UpdateFoodInput {
  name?: string;
  brand?: string;
  servingSize?: number;
  servingUnit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  barcode?: string;
  category?: string;
  householdServingName?: string;
  householdServingGrams?: number;
}

export interface MealEntry {
  id: string;
  userId: string;
  foodDefinitionId?: string;
  foodName: string;
  mealType: string;
  servingCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dateString: string;
  isQuickAdd: boolean;
  notes?: string;
  photoUrl?: string;
  householdServingCount?: number;
  householdServingName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMealEntryInput {
  foodDefinitionId?: string;
  foodName: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  servingCount: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  dateString: string;
  isQuickAdd?: boolean;
  notes?: string;
  photoUrl?: string;
  householdServingCount?: number;
  householdServingName?: string;
}

export interface UpdateMealEntryInput {
  foodDefinitionId?: string;
  foodName?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  servingCount?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  dateString?: string;
  isQuickAdd?: boolean;
  notes?: string;
  photoUrl?: string;
  householdServingCount?: number;
  householdServingName?: string;
}

export interface NutritionGoals {
  id: string;
  userId: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  updatedAt?: string;
}

export interface DailySummary {
  date: string;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
  meals: Record<string, MealEntry[]>;
  entryCount: number;
}

export interface WaterIntake {
  userId?: string;
  dateString: string;
  amountMl: number;
  glasses: number;
  updatedAt?: string;
}

export interface SetWaterIntakeInput {
  dateString: string;
  amountMl: number;
  glasses: number;
}

export interface MealTemplateItem {
  foodDefinitionId: string;
  foodName: string;
  servingCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  items: MealTemplateItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMealTemplateInput {
  name: string;
  items: MealTemplateItem[];
}

export interface UpdateMealTemplateInput {
  name?: string;
  items?: MealTemplateItem[];
}

export interface CommunityFood extends FoodDefinition {
  isCommunity: boolean;
  contributorId?: string;
  contributorName?: string | null;
  usageCount?: number;
}

export interface CommunityMealTemplate extends MealTemplate {
  isCommunity: boolean;
  contributorId?: string;
  contributorName?: string | null;
  usageCount?: number;
}

export interface DietProfile {
  id: string;
  userId: string;
  sex: 'male' | 'female';
  dateOfBirth: string;
  heightCm: number;
  activityLevel: string;
  weightGoal: string;
  macroPreset: string;
  customMacros?: { proteinPct: number; carbsPct: number; fatPct: number };
  bmr?: number;
  tdee?: number;
  updatedAt?: string;
}

export interface SetDietProfileInput {
  sex: 'male' | 'female';
  dateOfBirth: string;
  heightCm: number;
  activityLevel: string;
  weightGoal: string;
  macroPreset: string;
  customMacros?: { proteinPct: number; carbsPct: number; fatPct: number };
  bmr?: number;
  tdee?: number;
}

// ============================================
// FRIENDS
// ============================================

export interface Friend {
  id: string;
  friendUserId: string;
  friendName: string;
  friendEmail: string;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  direction: string;
  userId: string;
  displayName: string;
  email: string;
  createdAt: string;
}

// ============================================
// CLIENT
// ============================================

export class TrackfusionClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: TrackfusionClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, fetchOptions);

        // Retry on 503 (cold start) — but not on other errors
        if (res.status === 503 && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json() as Promise<T>;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on non-503 errors (auth failures, 404s, etc.)
        if (lastError.name !== 'AbortError' && attempt < MAX_RETRIES) {
          // Only retry if it was a network-level error
          if (lastError.message.includes('fetch failed') || lastError.message.includes('ECONNREFUSED')) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
        }
        throw lastError;
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  private buildQs(params: Record<string, string | number | boolean | undefined>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  }

  // ---------- Projects ----------

  async listProjects(includeArchived = false): Promise<Project[]> {
    const qs = includeArchived ? '?includeArchived=true' : '';
    const data = await this.request<{ projects: Project[] }>(`/projects${qs}`);
    return data.projects;
  }

  async listTasks(projectId: string, status?: string): Promise<Task[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await this.request<{ tasks: Task[] }>(`/projects/${projectId}/tasks${qs}`);
    return data.tasks;
  }

  async getTask(taskId: string): Promise<Task> {
    const data = await this.request<{ task: Task }>(`/tasks/${taskId}`);
    return data.task;
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<Task> {
    const data = await this.request<{ task: Task }>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.task;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
    const data = await this.request<{ task: Task }>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.task;
  }

  // ---------- Habits ----------

  async listHabits(active?: boolean): Promise<Habit[]> {
    const qs = active !== undefined ? `?active=${active}` : '';
    const data = await this.request<{ habits: Habit[] }>(`/habits${qs}`);
    return data.habits;
  }

  async createHabit(input: CreateHabitInput): Promise<Habit> {
    const data = await this.request<{ habit: Habit }>('/habits', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.habit;
  }

  async updateHabit(habitId: string, input: UpdateHabitInput): Promise<Habit> {
    const data = await this.request<{ habit: Habit }>(`/habits/${habitId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.habit;
  }

  async listHabitEntries(habitId: string, from?: string, to?: string): Promise<HabitEntry[]> {
    const qs = this.buildQs({ from, to });
    const data = await this.request<{ entries: HabitEntry[] }>(`/habits/${habitId}/entries${qs}`);
    return data.entries;
  }

  async toggleHabitEntry(habitId: string, date: string): Promise<{ toggled: string; date: string; entryId?: string }> {
    return this.request<{ toggled: string; date: string; entryId?: string }>(`/habits/${habitId}/entries`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  async getHabitAnalytics(habitId: string): Promise<HabitAnalytics | null> {
    const data = await this.request<{ analytics: HabitAnalytics | null }>(`/habits/${habitId}/analytics`);
    return data.analytics;
  }

  // ---------- Items ----------

  async listItems(status?: string, categoryId?: string): Promise<Item[]> {
    const qs = this.buildQs({ status, categoryId });
    const data = await this.request<{ items: Item[] }>(`/items${qs}`);
    return data.items;
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    const data = await this.request<{ item: Item }>('/items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.item;
  }

  async updateItem(itemId: string, input: UpdateItemInput): Promise<Item> {
    const data = await this.request<{ item: Item }>(`/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.item;
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.request(`/items/${itemId}`, { method: 'DELETE' });
  }

  async listItemCategories(): Promise<ItemCategory[]> {
    const data = await this.request<{ categories: ItemCategory[] }>('/item-categories');
    return data.categories;
  }

  // ---------- Journal ----------

  async listJournalEntries(from?: string, to?: string, limit?: number): Promise<JournalEntry[]> {
    const qs = this.buildQs({ from, to, limit });
    const data = await this.request<{ entries: JournalEntry[] }>(`/journal-entries${qs}`);
    return data.entries;
  }

  async createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
    const data = await this.request<{ entry: JournalEntry }>('/journal-entries', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.entry;
  }

  async getDayEntry(dateString: string): Promise<DayEntry | null> {
    const data = await this.request<{ dayEntry: DayEntry | null }>(`/day-entries/${dateString}`);
    return data.dayEntry;
  }

  async listJournalTodos(completed?: boolean): Promise<JournalTodo[]> {
    const qs = completed !== undefined ? `?completed=${completed}` : '';
    const data = await this.request<{ todos: JournalTodo[] }>(`/journal-todos${qs}`);
    return data.todos;
  }

  async createJournalTodo(input: CreateJournalTodoInput): Promise<JournalTodo> {
    const data = await this.request<{ todo: JournalTodo }>('/journal-todos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.todo;
  }

  async updateJournalTodo(todoId: string, input: UpdateJournalTodoInput): Promise<JournalTodo> {
    const data = await this.request<{ todo: JournalTodo }>(`/journal-todos/${todoId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.todo;
  }

  // ---------- Spending ----------

  async listSpendings(opts?: { from?: string; to?: string; categoryId?: string; sourceId?: string; limit?: number }): Promise<Spending[]> {
    const qs = this.buildQs(opts || {});
    const data = await this.request<{ spendings: Spending[] }>(`/spendings${qs}`);
    return data.spendings;
  }

  async createSpending(input: CreateSpendingInput): Promise<Spending> {
    const data = await this.request<{ spending: Spending }>('/spendings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.spending;
  }

  async updateSpending(spendingId: string, input: Partial<CreateSpendingInput>): Promise<Spending> {
    const data = await this.request<{ spending: Spending }>(`/spendings/${spendingId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.spending;
  }

  async deleteSpending(spendingId: string): Promise<void> {
    await this.request(`/spendings/${spendingId}`, { method: 'DELETE' });
  }

  async listIncomes(from?: string, to?: string): Promise<Income[]> {
    const qs = this.buildQs({ from, to });
    const data = await this.request<{ incomes: Income[] }>(`/incomes${qs}`);
    return data.incomes;
  }

  async createIncome(input: CreateIncomeInput): Promise<Income> {
    const data = await this.request<{ income: Income }>('/incomes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.income;
  }

  async listSpendingCategories(): Promise<SpendingCategory[]> {
    const data = await this.request<{ categories: SpendingCategory[] }>('/spending-categories');
    return data.categories;
  }

  async listSpendingSources(): Promise<SpendingSource[]> {
    const data = await this.request<{ sources: SpendingSource[] }>('/spending-sources');
    return data.sources;
  }

  async getSpendingAnalytics(yearMonth: string): Promise<SpendingAnalytics | null> {
    const data = await this.request<{ analytics: SpendingAnalytics | null }>(`/spending-analytics/${yearMonth}`);
    return data.analytics;
  }

  // ---------- People ----------

  async listPeople(opts?: { search?: string; relationshipTypeId?: string; archived?: string }): Promise<Person[]> {
    const qs = this.buildQs(opts || {});
    const data = await this.request<{ people: Person[] }>(`/people${qs}`);
    return data.people;
  }

  async createPerson(input: CreatePersonInput): Promise<Person> {
    const data = await this.request<{ person: Person }>('/people', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.person;
  }

  async updatePerson(personId: string, input: UpdatePersonInput): Promise<Person> {
    const data = await this.request<{ person: Person }>(`/people/${personId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.person;
  }

  async addInteraction(personId: string, input: AddInteractionInput): Promise<PersonInteraction> {
    const data = await this.request<{ interaction: PersonInteraction }>(`/people/${personId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.interaction;
  }

  // ---------- Exercise ----------

  async listWorkoutSessions(from?: string, to?: string, limit?: number): Promise<WorkoutSession[]> {
    const qs = this.buildQs({ from, to, limit });
    const data = await this.request<{ sessions: WorkoutSession[] }>(`/workout-sessions${qs}`);
    return data.sessions;
  }

  async createWorkoutSession(input: CreateWorkoutSessionInput): Promise<WorkoutSession> {
    const data = await this.request<{ session: WorkoutSession }>('/workout-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.session;
  }

  async listWorkoutTemplates(): Promise<WorkoutTemplate[]> {
    const data = await this.request<{ templates: WorkoutTemplate[] }>('/workout-templates');
    return data.templates;
  }

  async listExerciseDefinitions(): Promise<ExerciseDefinition[]> {
    const data = await this.request<{ exercises: ExerciseDefinition[] }>('/exercise-definitions');
    return data.exercises;
  }

  async getPersonalRecords(exerciseId?: string): Promise<PersonalRecord[]> {
    const qs = exerciseId ? `?exerciseId=${encodeURIComponent(exerciseId)}` : '';
    const data = await this.request<{ records: PersonalRecord[] }>(`/personal-records${qs}`);
    return data.records;
  }

  async listBodyMeasurements(from?: string, to?: string): Promise<BodyMeasurement[]> {
    const qs = this.buildQs({ from, to });
    const data = await this.request<{ measurements: BodyMeasurement[] }>(`/body-measurements${qs}`);
    return data.measurements;
  }

  // ---------- Portfolio ----------

  async listInvestmentTransactions(opts?: { assetType?: string; assetId?: string; from?: string; to?: string; limit?: number }): Promise<InvestmentTransaction[]> {
    const qs = this.buildQs(opts || {});
    const data = await this.request<{ transactions: InvestmentTransaction[] }>(`/investment-transactions${qs}`);
    return data.transactions;
  }

  async listAssets(assetType?: string, search?: string): Promise<Asset[]> {
    const qs = this.buildQs({ assetType, search });
    const data = await this.request<{ assets: Asset[] }>(`/assets${qs}`);
    return data.assets;
  }

  async getAssetPriceHistory(assetId: string, from?: string, to?: string, limit?: number): Promise<{ asset: Asset; prices: PriceHistoryEntry[] }> {
    const qs = this.buildQs({ from, to, limit });
    return this.request<{ asset: Asset; prices: PriceHistoryEntry[] }>(`/assets/${assetId}/price-history${qs}`);
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    return this.request<PortfolioSummary>('/portfolio-summary');
  }

  // ---------- Friends ----------

  async listFriends(): Promise<Friend[]> {
    const data = await this.request<{ friends: Friend[] }>('/friends');
    return data.friends;
  }

  async listFriendRequests(): Promise<FriendRequest[]> {
    const data = await this.request<{ requests: FriendRequest[] }>('/friend-requests');
    return data.requests;
  }

  async sendFriendRequest(email: string): Promise<{ friendship: { id: string } }> {
    return this.request<{ friendship: { id: string } }>('/friend-requests', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async respondToFriendRequest(id: string, action: 'accept' | 'reject'): Promise<void> {
    await this.request(`/friend-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  }

  async deleteFriend(id: string): Promise<void> {
    await this.request(`/friends/${id}`, { method: 'DELETE' });
  }

  // ---------- Project Sharing ----------

  async shareProject(projectId: string, friendUserId: string): Promise<void> {
    await this.request(`/projects/${projectId}/sharing`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'add', friendUserId }),
    });
  }

  async unshareProject(projectId: string, friendUserId: string): Promise<void> {
    await this.request(`/projects/${projectId}/sharing`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'remove', friendUserId }),
    });
  }

  // ---------- Diet & Nutrition ----------

  async listFoodDefinitions(search?: string, category?: string): Promise<FoodDefinition[]> {
    const qs = this.buildQs({ search, category });
    const data = await this.request<{ foods: FoodDefinition[] }>(`/food-definitions${qs}`);
    return data.foods;
  }

  async createFoodDefinition(input: CreateFoodInput): Promise<FoodDefinition> {
    const data = await this.request<{ food: FoodDefinition }>('/food-definitions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.food;
  }

  async updateFoodDefinition(id: string, input: UpdateFoodInput): Promise<FoodDefinition> {
    const data = await this.request<{ food: FoodDefinition }>(`/food-definitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.food;
  }

  async deleteFoodDefinition(id: string): Promise<void> {
    await this.request(`/food-definitions/${id}`, { method: 'DELETE' });
  }

  async listMealEntries(opts?: { date?: string; from?: string; to?: string; mealType?: string; limit?: number }): Promise<MealEntry[]> {
    const qs = this.buildQs(opts || {});
    const data = await this.request<{ entries: MealEntry[] }>(`/meal-entries${qs}`);
    return data.entries;
  }

  async createMealEntry(input: CreateMealEntryInput): Promise<MealEntry> {
    const data = await this.request<{ entry: MealEntry }>('/meal-entries', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.entry;
  }

  async updateMealEntry(id: string, input: UpdateMealEntryInput): Promise<MealEntry> {
    const data = await this.request<{ entry: MealEntry }>(`/meal-entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return data.entry;
  }

  async deleteMealEntry(id: string): Promise<void> {
    await this.request(`/meal-entries/${id}`, { method: 'DELETE' });
  }

  async getNutritionGoals(): Promise<NutritionGoals | null> {
    const data = await this.request<{ goals: NutritionGoals | null }>('/nutrition-goals');
    return data.goals;
  }

  async setNutritionGoals(input: { dailyCalories: number; proteinGrams: number; carbsGrams: number; fatGrams: number }): Promise<NutritionGoals> {
    const data = await this.request<{ goals: NutritionGoals }>('/nutrition-goals', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return data.goals;
  }

  async getDietProfile(): Promise<{ profile: DietProfile | null }> {
    return this.request('/diet-profile');
  }

  async setDietProfile(data: SetDietProfileInput): Promise<{ profile: DietProfile }> {
    return this.request('/diet-profile', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getDietDailySummary(date: string): Promise<DailySummary> {
    return this.request<DailySummary>(`/diet-daily-summary?date=${encodeURIComponent(date)}`);
  }

  // Food Search (External APIs)
  async searchFoods(query: string, source?: 'off' | 'usda', page?: number): Promise<{ foods: unknown[]; source: string }> {
    const params = new URLSearchParams({ q: query });
    if (source) params.set('source', source);
    if (page) params.set('page', String(page));
    return this.request(`/food-search?${params.toString()}`);
  }

  async lookupBarcode(barcode: string): Promise<{ product: unknown | null; source?: string; needsNutrition?: boolean }> {
    return this.request(`/food-barcode/${encodeURIComponent(barcode)}`);
  }

  // Meal Templates
  async listMealTemplates(): Promise<{ templates: MealTemplate[] }> {
    return this.request('/meal-templates');
  }

  async createMealTemplate(input: CreateMealTemplateInput): Promise<{ template: MealTemplate }> {
    return this.request('/meal-templates', { method: 'POST', body: JSON.stringify(input) });
  }

  async updateMealTemplate(id: string, input: UpdateMealTemplateInput): Promise<{ template: MealTemplate }> {
    return this.request(`/meal-templates/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  async deleteMealTemplate(id: string): Promise<{ success: boolean }> {
    return this.request(`/meal-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async logMealTemplate(id: string, dateString: string, mealType: string): Promise<{ entries: MealEntry[]; count: number }> {
    return this.request(`/meal-templates/${encodeURIComponent(id)}/log`, {
      method: 'POST',
      body: JSON.stringify({ dateString, mealType }),
    });
  }

  // ============================================
  // COMMUNITY FOODS & TEMPLATES
  // ============================================

  async shareFoodToCommunity(foodId: string): Promise<CommunityFood> {
    const data = await this.request<{ food: CommunityFood }>(`/food-definitions/${encodeURIComponent(foodId)}/share`, {
      method: 'POST',
    });
    return data.food;
  }

  async searchCommunityFoods(opts?: { search?: string; category?: string; barcode?: string; limit?: number }): Promise<{ foods: CommunityFood[]; total: number }> {
    const qs = this.buildQs(opts || {});
    return this.request(`/community-foods${qs}`);
  }

  async shareMealTemplate(templateId: string): Promise<CommunityMealTemplate> {
    const data = await this.request<{ template: CommunityMealTemplate }>(`/meal-templates/${encodeURIComponent(templateId)}/share`, {
      method: 'POST',
    });
    return data.template;
  }

  async searchCommunityTemplates(opts?: { search?: string; limit?: number }): Promise<{ templates: CommunityMealTemplate[]; total: number }> {
    const qs = this.buildQs(opts || {});
    return this.request(`/community-meal-templates${qs}`);
  }

  // ============================================
  // WATER INTAKE
  // ============================================

  async getWaterIntake(date: string): Promise<WaterIntake> {
    return this.request(`/water-intake?date=${encodeURIComponent(date)}`);
  }

  async setWaterIntake(data: SetWaterIntakeInput): Promise<WaterIntake> {
    return this.request('/water-intake', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async addWater(dateString: string, amountMl: number = 250): Promise<WaterIntake> {
    return this.request('/water-intake/add', {
      method: 'POST',
      body: JSON.stringify({ dateString, amountMl }),
    });
  }
}
