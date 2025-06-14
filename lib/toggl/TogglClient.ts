import { requestUrl } from "obsidian";

const TOGGL_API_BASE = "https://api.track.toggl.com/api/v9";

export interface TogglClientOptions {
  apiToken: string;
  headers?: Record<string, string>;
}

export interface TogglWorkspace {
  id: number;
  name: string;
  premium: boolean;
  admin: boolean;
  default_hourly_rate: number;
  default_currency: string;
  only_admins_may_create_projects: boolean;
  only_admins_see_billable_rates: boolean;
  only_admins_see_team_dashboard: boolean;
  projects_billable_by_default: boolean;
  rounding: number;
  rounding_minutes: number;
  api_token: string;
  at: string;
  ical_enabled: boolean;
}

export interface TogglTimeEntry {
  id: number;
  workspace_id: number;
  project_id?: number | null;
  task_id?: number;
  billable: boolean;
  start: string;
  stop?: Date | null;
  duration: number;
  description?: string;
  tags?: string[] | null;
  tag_ids?: number[] | null;
  duronly?: boolean;
  at: string;
  server_deleted_at?: Date | null;
  user_id: number;
  uid?: number;
  wid?: number;
  pid?: number;
}

export interface TogglProject {
  id: number;
  workspace_id: number;
  wid: number;
  client_id?: number;
  cid?: number;
  name: string;
  is_private: boolean;
  active: boolean;
  at: string;
  created_at: string;
  server_deleted_at?: Date | null;
  color: string;
  billable?: boolean;
  template?: boolean;
  auto_estimates?: boolean;
  estimated_hours?: number;
  rate?: number | null;
  rate_last_updated?: Date | null;
  currency?: string;
  recurring?: boolean;
  recurring_parameters?: any;
  current_period?: any;
  fixed_fee?: number;
  permissions?: string;
  actual_hours?: number;
}

export interface TogglClient {
  id: number;
  workspace_id: number;
  wid: number;
  name: string;
  archived: boolean;
  at: string;
  creator_id?: number;
  permissions?: string;
}

export interface TogglTag {
  id: number;
  workspace_id: number;
  name: string;
  at: string;
}

export class TogglApiClient {
  private apiToken: string;
  private headers: Record<string, string>;

  constructor(options: TogglClientOptions) {
    this.apiToken = options.apiToken;
    this.headers = {
      Authorization: `Basic ${btoa(this.apiToken + ":api_token")}`,
      "Content-Type": "application/json",
      "User-Agent":
        "Toggl Integration for Obsidian (https://github.com/mcndt/obsidian-toggl-integration)",
      ...options.headers,
    };
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: any,
  ): Promise<T> {
    const url = `${TOGGL_API_BASE}${endpoint}`;

    try {
      const response = await requestUrl({
        body: body ? JSON.stringify(body) : undefined,
        headers: this.headers,
        method,
        url,
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.text}`);
      }

      return response.json;
    } catch (error) {
      console.error(`Toggl API request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  // Workspaces
  async getWorkspaces(): Promise<TogglWorkspace[]> {
    return this.request<TogglWorkspace[]>("/workspaces");
  }

  // Current user
  async getCurrentUser(): Promise<any> {
    return this.request<any>("/me");
  }

  // Time entries
  async getCurrentTimeEntry(): Promise<TogglTimeEntry | null> {
    return this.request<TogglTimeEntry | null>("/me/time_entries/current");
  }

  async getTimeEntries(
    startDate?: string,
    endDate?: string,
  ): Promise<TogglTimeEntry[]> {
    let endpoint = "/me/time_entries";
    const params = new URLSearchParams();

    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return this.request<TogglTimeEntry[]>(endpoint);
  }

  async createTimeEntry(
    workspaceId: number,
    timeEntry: Partial<TogglTimeEntry>,
  ): Promise<TogglTimeEntry> {
    return this.request<TogglTimeEntry>(
      `/workspaces/${workspaceId}/time_entries`,
      "POST",
      { time_entry: timeEntry },
    );
  }

  async updateTimeEntry(
    workspaceId: number,
    timeEntryId: number,
    timeEntry: Partial<TogglTimeEntry>,
  ): Promise<TogglTimeEntry> {
    return this.request<TogglTimeEntry>(
      `/workspaces/${workspaceId}/time_entries/${timeEntryId}`,
      "PUT",
      { time_entry: timeEntry },
    );
  }

  async stopTimeEntry(
    workspaceId: number,
    timeEntryId: number,
  ): Promise<TogglTimeEntry> {
    return this.request<TogglTimeEntry>(
      `/workspaces/${workspaceId}/time_entries/${timeEntryId}/stop`,
      "PATCH",
    );
  }

  async deleteTimeEntry(
    workspaceId: number,
    timeEntryId: number,
  ): Promise<void> {
    return this.request<void>(
      `/workspaces/${workspaceId}/time_entries/${timeEntryId}`,
      "DELETE",
    );
  }

  // Projects
  async getProjects(workspaceId?: number): Promise<TogglProject[]> {
    const endpoint = workspaceId
      ? `/workspaces/${workspaceId}/projects`
      : "/me/projects";
    return this.request<TogglProject[]>(endpoint);
  }

  async createProject(
    workspaceId: number,
    project: Partial<TogglProject>,
  ): Promise<TogglProject> {
    return this.request<TogglProject>(
      `/workspaces/${workspaceId}/projects`,
      "POST",
      { project },
    );
  }

  // Clients
  async getClients(workspaceId?: number): Promise<TogglClient[]> {
    const endpoint = workspaceId
      ? `/workspaces/${workspaceId}/clients`
      : "/me/clients";
    return this.request<TogglClient[]>(endpoint);
  }

  // Tags
  async getTags(workspaceId: number): Promise<TogglTag[]> {
    return this.request<TogglTag[]>(`/workspaces/${workspaceId}/tags`);
  }

  // Reports (using the Reports API)
  async getDetailedReport(
    workspaceId: number,
    options: {
      start_date: string;
      end_date: string;
      project_ids?: number[];
      client_ids?: number[];
      tag_ids?: number[];
    },
  ): Promise<any> {
    const reportUrl = `https://api.track.toggl.com/reports/api/v3/workspace/${workspaceId}/reports/detailed`;

    try {
      const response = await requestUrl({
        body: JSON.stringify(options),
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        method: "POST",
        url: reportUrl,
      });

      return response.json;
    } catch (error) {
      console.error("Detailed report request failed", error);
      throw error;
    }
  }

  async getSummaryReport(
    workspaceId: number,
    options: {
      start_date: string;
      end_date: string;
      project_ids?: number[];
      client_ids?: number[];
      tag_ids?: number[];
    },
  ): Promise<any> {
    const reportUrl = `https://api.track.toggl.com/reports/api/v3/workspace/${workspaceId}/reports/summary`;

    try {
      const response = await requestUrl({
        body: JSON.stringify(options),
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        method: "POST",
        url: reportUrl,
      });

      return response.json;
    } catch (error) {
      console.error("Summary report request failed", error);
      throw error;
    }
  }
}

export function createClient(apiToken: string): TogglApiClient {
  return new TogglApiClient({
    apiToken,
    headers: {
      "User-Agent":
        "Toggl Integration for Obsidian (https://github.com/mcndt/obsidian-toggl-integration)",
    },
  });
}
