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

export interface Project {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  color: string;
  isArchived: boolean;
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
}
