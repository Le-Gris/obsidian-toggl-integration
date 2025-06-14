import type { PluginSettings } from "lib/config/PluginSettings";
import type {
  SearchTimeEntriesResponseItem,
  TimeEntryStart,
  TimeEntry,
  ProjectsSummaryResponseItem,
  ProjectsResponseItem,
  TagsResponseItem,
  SummaryReportResponse,
  DetailedReportResponseItem,
  ClientsResponseItem,
  ProjectId,
  TagId,
  ClientId,
  SummaryTimeChart,
} from "lib/model/Report-v3";
import type { TogglWorkspace } from "lib/model/TogglWorkspace";
import type { ISODate } from "lib/reports/ReportQuery";
import { settingsStore } from "lib/util/stores";
import moment from "moment";
import { Notice } from "obsidian";

import { ApiQueue } from "./ApiQueue";
import { createClient, TogglApiClient } from "./TogglClient";

type ReportOptions = {
  start_date: ISODate;
  end_date: ISODate;
  project_ids?: ProjectId[];
  tag_ids?: TagId[];
  client_ids?: ClientId[];
};

/** Wrapper class for performing common operations on the Toggl API. */
export default class TogglAPI {
  private _api: TogglApiClient;
  private _settings: PluginSettings;
  private _queue = new ApiQueue();

  constructor() {
    settingsStore.subscribe((val: PluginSettings) => (this._settings = val));
  }

  /**
   * Must be called after constructor and before use of the API.
   */
  public async setToken(apiToken: string) {
    this._api = createClient(apiToken);
    try {
      await this.testConnection();
    } catch {
      throw "Cannot connect to Toggl API.";
    }
  }

  /**
   * @throws an Error when the Toggl Track API cannot be reached.
   */
  public async testConnection() {
    await this._api.getWorkspaces();
  }

  /** @returns list of the user's workspaces. */
  public async getWorkspaces(): Promise<TogglWorkspace[]> {
    const response = await this._api.getWorkspaces().catch(handleError);

    return response.map(
      (w: any) =>
        ({
          id: (w.id as number).toString(),
          name: w.name,
        } as TogglWorkspace),
    );
  }

  /** @returns list of the user's clients. */
  public async getClients(): Promise<ClientsResponseItem[]> {
    const clients = await this._api
      .getClients(parseInt(this._settings.workspace.id))
      .catch(handleError);

    // Transform to match expected interface
    return clients.map((client) => ({
      ...client,
      wid:
        client.wid ||
        client.workspace_id ||
        parseInt(this._settings.workspace.id),
    })) as ClientsResponseItem[];
  }

  /**
   * @returns list of the user's projects for the configured Toggl workspace.
   * NOTE: this makes an async call to the Toggl API. To get cached projects,
   * use the computed property cachedProjects instead.
   */
  public async getProjects(): Promise<ProjectsResponseItem[]> {
    const projects = await this._api
      .getProjects(parseInt(this._settings.workspace.id))
      .catch(handleError);

    // Transform to match expected interface and filter active projects
    return projects
      .filter((p: any) => p.active)
      .map((project) => ({
        ...project,
        actual_hours: project.actual_hours || 0,
        cid: project.cid || project.client_id,
        rate_last_updated: project.rate_last_updated || null,
        server_deleted_at: project.server_deleted_at || null,
        wid: project.wid || project.workspace_id,
      })) as ProjectsResponseItem[];
  }

  /**
   * @returns list of the user's tags for the configured Toggl workspace.
   * NOTE: this makes an async call to the Toggl API. To get cached tags,
   * use the computed property cachedTags instead.
   */
  public async getTags(): Promise<TagsResponseItem[]> {
    const tags = await this._api
      .getTags(parseInt(this._settings.workspace.id))
      .catch(handleError);
    return tags as TagsResponseItem[];
  }

  /**
   * @returns list of recent time entries for the user's workspace.
   */
  public async getRecentTimeEntries(): Promise<
    SearchTimeEntriesResponseItem[]
  > {
    const startDate = moment().subtract(9, "day").format("YYYY-MM-DD");
    const endDate = moment().format("YYYY-MM-DD");

    const response = await this._api
      .getTimeEntries(startDate, endDate)
      .catch(handleError);

    // Group time entries by user and project to match the old API format
    const groupedEntries: { [key: string]: any[] } = {};

    response.forEach((entry: any) => {
      const key = `${entry.user_id}_${entry.project_id || "no_project"}_${
        entry.description || "no_desc"
      }`;
      if (!groupedEntries[key]) {
        groupedEntries[key] = [];
      }
      groupedEntries[key].push({
        at: entry.at,
        id: entry.id,
        seconds: entry.duration > 0 ? entry.duration : 0,
        start: entry.start,
        stop: entry.stop || entry.start,
      });
    });

    // Convert to the expected SearchTimeEntriesResponseItem format
    return Object.keys(groupedEntries)
      .filter((key) => groupedEntries[key].length > 0)
      .map((key, index) => {
        const entries = groupedEntries[key];
        const firstEntry = response.find((e) =>
          entries.some((entry) => entry.id === e.id),
        );

        return {
          description: firstEntry?.description || "",

          hourly_rate_in_cents: null as null,
          // API v9 doesn't return username directly
          project_id: firstEntry?.project_id || null,
          row_number: index + 1,
          tag_ids: (firstEntry?.tag_ids || []).map(String),
          task_id: null as null,
          time_entries: entries,
          user_id: firstEntry?.user_id || 0,
          username: "User",
        };
      }) as SearchTimeEntriesResponseItem[];
  }

  /**
   * Fetches a report for the current day according to the Toggl Track Report API.
   * @returns a {@link Report} object containing the report data as defined by
   * the track report API
   * (see https://github.com/toggl/toggl_api_docs/blob/master/reports.md).
   *
   * NOTE: this method is used to fetch the latest summary at key events. To
   *       access the latest report, subscribe to the store {@link dailyReport}
   */
  public async getDailySummary(): Promise<ProjectsSummaryResponseItem[]> {
    const today = moment().format("YYYY-MM-DD");
    const workspaceId = parseInt(this._settings.workspace.id);

    try {
      const response = await this._api
        .getSummaryReport(workspaceId, {
          end_date: today,
          start_date: today,
        })
        .catch(handleError);

      // Transform the response to match the expected format
      if (response.groups) {
        return response.groups.map((group: any) => ({
          id: group.id,
          name: group.name,
          seconds: group.seconds,
          // Add other fields as needed
        }));
      }

      return [];
    } catch (error) {
      console.error("Error fetching daily summary:", error);
      return [];
    }
  }

  /**
   * Gets a Toggl Summary Report between start_date and end_date date.
   * @param start_date ISO-formatted date string of the first day of the summary range (inclusive).
   * @param end_date ISO-formatted date string of the last day of the summary range (inclusive).
   * @returns The report.
   */
  public async getSummary(options: ReportOptions) {
    const workspaceId = parseInt(this._settings.workspace.id);
    const response = await this._api
      .getSummaryReport(workspaceId, options)
      .catch(handleError);
    return response as SummaryReportResponse;
  }

  public async getSummaryTimeChart(options: ReportOptions) {
    const workspaceId = parseInt(this._settings.workspace.id);

    try {
      const response = await this._api
        .getSummaryReport(workspaceId, {
          ...options,
        })
        .catch(handleError);

      // Transform the response to match the expected SummaryTimeChart format
      return {
        graph: response.graph || [],
        resolution: getResolutionFromDateRange(
          options.start_date,
          options.end_date,
        ),
        total_seconds: response.total_seconds || 0,
        ...response,
      } as SummaryTimeChart;
    } catch (error) {
      console.error("Error fetching summary time chart:", error);
      throw error;
    }
  }

  /**
   * Gets a Toggl Detailed Report between start_date and end_date date.
   * Makes multiple HTTP requests until all pages of the paginated result are
   * gathered, then returns the combined report as a single object.
   * @param start_date ISO-formatted date string of the first day of the summary range (inclusive).
   * @param end_date ISO-formatted date string of the last day of the summary range (inclusive).
   * @returns The time entries on the specified page.
   */
  public async getDetailedReport(
    options: ReportOptions,
  ): Promise<DetailedReportResponseItem[]> {
    const workspaceId = parseInt(this._settings.workspace.id);

    const response = await this._queue.queue<any>(() =>
      this._api.getDetailedReport(workspaceId, options),
    );

    // Transform the response to match the expected format
    if (Array.isArray(response)) {
      return response;
    } else if (response && Array.isArray(response.data)) {
      return response.data;
    } else if (
      response &&
      response.results &&
      Array.isArray(response.results)
    ) {
      return response.results;
    } else {
      return [];
    }
  }

  /**
   * Starts a new timer on Toggl Track with the given
   * description and project.
   * @param entry the description and project to start a timer on.
   */
  public async startTimer(entry: TimeEntryStart): Promise<TimeEntry> {
    const workspaceId = parseInt(this._settings.workspace.id);

    const timeEntry = {
      billable: entry.billable || false,
      created_with: "Toggl Track for Obsidian",
      description: entry.description,
      duration: -moment().unix(),
      project_id: entry.project_id,
      // Negative duration for running timer
      start: moment().format(),

      stop: null as null,
      tags: entry.tags || [],
      workspace_id: workspaceId,
    };

    const result = await this._api
      .createTimeEntry(workspaceId, timeEntry)
      .catch(handleError);

    // Transform the result to match the expected TimeEntry format
    return {
      ...entry,
      at: result.at,
      duration: result.duration,
      id: result.id,
      project_id: result.project_id,
      server_deleted_at: result.server_deleted_at,
      start: result.start,
      stop: result.stop,
      tag_ids: result.tag_ids || [],
      tags: result.tags || [],
      user_id: result.user_id,
      workspace_id: result.workspace_id,
    } as TimeEntry;
  }

  /**
   * Stops the currently running timer.
   */
  public async stopTimer(entry: TimeEntry): Promise<TimeEntry> {
    const workspaceId = parseInt(this._settings.workspace.id);
    const result = await this._api
      .stopTimeEntry(workspaceId, entry.id)
      .catch(handleError);

    // Transform the result to match the expected TimeEntry format
    return {
      ...entry,
      at: result.at,
      duration: result.duration,
      id: result.id,
      project_id: result.project_id,
      server_deleted_at: result.server_deleted_at,
      start: result.start,
      stop: result.stop,
      tag_ids: result.tag_ids || [],
      tags: result.tags || [],
      user_id: result.user_id,
      workspace_id: result.workspace_id,
    } as TimeEntry;
  }

  /**
   * Returns the currently running timer, if any.
   */
  public async getCurrentTimer(): Promise<TimeEntry | null> {
    const result = await this._api.getCurrentTimeEntry();

    if (!result) {
      return null;
    }

    // Transform the result to match the expected TimeEntry format
    return {
      at: result.at,
      description: result.description || "",
      duration: result.duration,
      id: result.id,
      project_id: result.project_id,
      server_deleted_at: result.server_deleted_at,
      start: result.start,
      stop: result.stop,
      tag_ids: result.tag_ids || [],
      tags: result.tags || [],
      user_id: result.user_id,
      workspace_id: result.workspace_id,
    } as TimeEntry;
  }
}

// Helper function to determine resolution from date range
function getResolutionFromDateRange(
  startDate: string,
  endDate: string,
): string {
  const start = moment(startDate);
  const end = moment(endDate);
  const diffDays = end.diff(start, "days");

  if (diffDays <= 1) {
    return "hour";
  } else if (diffDays <= 7) {
    return "day";
  } else if (diffDays <= 31) {
    return "day";
  } else {
    return "month";
  }
}

const handleError = (error: unknown) => {
  console.error("Toggl API error: ", error);
  new Notice("Error communicating with Toggl API: " + error);
  throw error;
};
