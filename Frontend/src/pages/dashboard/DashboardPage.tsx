import { useCallback, useEffect, useMemo, useState } from "react";
import logo from '../../assets/taskflow-logo.png'
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
  AlertCircle,
  Inbox,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import "./DashboardPage.css";

// Keep the API base URL consistent with the rest of the frontend.
// With the Vite proxy configured, the default /api path works locally.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);

// These types mirror the response fields selected by the TaskFlow backend.
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface DashboardSummary {
  projects: {
    total: number;
    active: number;
    completed: number;
    archived: number;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    completed: number;
    overdue: number;
  };
}

interface ProjectMember {
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  updatedAt: string;
  members: ProjectMember[];
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  createdAt: string;
  updatedAt: string; // Added: used by the weekly task progress chart
  project: {
    id: string;
    name: string;
    status: string;
  };
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  project: { id: string; name: string };
}

interface ActivityResponse {
  totalActivities: number;
  activities: ActivityItem[];
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  relatedProject: { id: string; name: string } | null;
  relatedTask: { id: string; title: string; projectId: string } | null;
  relatedInvitation: {
    id: string;
    status: string;
    expiresAt: string;
    project: { id: string; name: string };
  } | null;
}

interface InvitationResponse {
  TotalInvitations: number;
  invitations: Array<{
    id: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    project: {
      id: string;
      name: string;
      status: string;
      description: string | null;
    };
    invitedBy: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }>;
}

interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface DashboardPageProps {
  // Optional callback lets your router handle navigation when you wire routes.
  onNavigate?: (path: string) => void;
}

// Read and validate the standard { success, message, data } API envelope.
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // Send the HTTP-only JWT cookie with API requests.
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const result = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Request failed (${response.status})`);
  }

  return result.data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function timeAgo(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function readableAction(action: string) {
  return action.toLowerCase().replaceAll("_", " ");
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    COMPLETED: "Completed",
    ARCHIVED: "Archived",
    TODO: "To do",
    IN_PROGRESS: "In progress",
    IN_REVIEW: "In review",
  };
  return labels[status] || status;
}

const EMPTY_SUMMARY: DashboardSummary = {
  projects: { total: 0, active: 0, completed: 0, archived: 0 },
  tasks: {
    total: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    completed: 0,
    overdue: 0,
  },
};

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [invitations, setInvitations] = useState<
    InvitationResponse["invitations"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<SearchUserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState("");
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigate = useCallback(
    (path: string) => {
      if (onNavigate) onNavigate(path);
      else window.location.assign(path);
    },
    [onNavigate],
  );

  // Fetch dashboard data first. State is updated only after the network
  // requests settle, so calling this from the mount effect does not cause a
  // synchronous state update inside that effect.
  const loadDashboard = useCallback(async () => {
    const requests = await Promise.allSettled([
      apiRequest<User>("/auth/me"),
      apiRequest<DashboardSummary>("/dashboard/summary"),
      apiRequest<Project[]>("/project/projects"),
      apiRequest<Task[]>("/tasks/"),
      apiRequest<ActivityResponse>("/dashboard/recent-activity"),
      apiRequest<NotificationItem[]>("/notifications/"),
      apiRequest<InvitationResponse>("/invitation/invitations"),
    ]);

    const errors: string[] = [];
    const [
      userResult,
      summaryResult,
      projectResult,
      taskResult,
      activityResult,
      notificationResult,
      invitationResult,
    ] = requests;

    if (userResult.status === "fulfilled") setUser(userResult.value);
    else {
      setPageError(
        userResult.reason instanceof Error
          ? userResult.reason.message
          : "Could not verify your session.",
      );
    }

    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    else errors.push("Dashboard summary could not be loaded.");

    if (projectResult.status === "fulfilled") setProjects(projectResult.value);
    else errors.push("Projects could not be loaded.");

    if (taskResult.status === "fulfilled") setTasks(taskResult.value);
    else errors.push("Your assigned tasks could not be loaded.");

    if (activityResult.status === "fulfilled")
      setActivities(activityResult.value.activities || []);
    else errors.push("Recent activity could not be loaded.");

    if (notificationResult.status === "fulfilled")
      setNotifications(notificationResult.value);
    else errors.push("Notifications could not be loaded.");

    if (invitationResult.status === "fulfilled")
      setInvitations(invitationResult.value.invitations || []);
    else errors.push("Invitations could not be loaded.");

    setSectionErrors(errors);
    setLoading(false);
  }, []);

  // Refresh is triggered by user actions, not by the mount effect. It can
  // safely update the refresh indicator immediately before reloading data.
  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setPageError("");
    setSectionErrors([]);

    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard]);

  // Load dashboard data when the dashboard page first opens.
  useEffect(() => {
    // Schedule the initial request outside the synchronous effect execution.
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    // Clear the scheduled request if the component unmounts.
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  // Search users through the existing authenticated /users/search?q= endpoint.
  // Projects and tasks are filtered locally because they are already loaded on this page.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const users = await apiRequest<SearchUserResult[]>(
          `/user/search?q=${encodeURIComponent(query)}`,
        );
        if (!cancelled) setSearchUsers(users);
      } catch {
        if (!cancelled) setSearchUsers([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const matchingProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query.length >= 2
      ? projects
          .filter((project) => project.name.toLowerCase().includes(query))
          .slice(0, 5)
      : [];
  }, [projects, searchQuery]);

  const matchingTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query.length >= 2
      ? tasks
          .filter((task) =>
            `${task.title} ${task.project.name}`.toLowerCase().includes(query),
          )
          .slice(0, 5)
      : [];
  }, [tasks, searchQuery]);

  // The chart groups completed tasks by updatedAt weekday. The task API exposes
  // updatedAt but not a dedicated completedAt timestamp, so the tooltip makes that basis clear.
  const weeklyTaskProgress = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() - mondayOffset);
    const days = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        date,
        count: 0,
      };
    });
    tasks
      .filter((task) => task.status === "COMPLETED")
      .forEach((task) => {
        const updated = new Date(task.updatedAt);
        const index = Math.floor(
          (new Date(
            updated.getFullYear(),
            updated.getMonth(),
            updated.getDate(),
          ).getTime() -
            monday.getTime()) /
            86400000,
        );
        if (index >= 0 && index < 5) days[index].count += 1;
      });
    return days;
  }, [tasks]);

  const maxWeeklyCount = Math.max(
    1,
    ...weeklyTaskProgress.map((day) => day.count),
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const taskStatusRows = useMemo(
    () => [
      { label: "To do", count: summary.tasks.todo, className: "todo" },
      {
        label: "In progress",
        count: summary.tasks.inProgress,
        className: "progress",
      },
      {
        label: "In review",
        count: summary.tasks.inReview,
        className: "review",
      },
      {
        label: "Completed",
        count: summary.tasks.completed,
        className: "completed",
      },
    ],
    [summary],
  );

  // Create a project using the existing project creation endpoint.
  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectName.trim()) {
      setProjectFormError("Project name is required.");
      return;
    }

    setCreatingProject(true);
    setProjectFormError("");

    try {
      await apiRequest<Project>("/project/create", {
        method: "POST",
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim() || undefined,
        }),
      });
      setProjectName("");
      setProjectDescription("");
      setShowCreateProject(false);
      await refreshDashboard();
    } catch (error) {
      setProjectFormError(
        error instanceof Error ? error.message : "Could not create project.",
      );
    } finally {
      setCreatingProject(false);
    }
  };

  // Assignees are allowed by the backend to complete only their assigned task.
  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      await apiRequest<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      await refreshDashboard();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not update task.",
      );
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest<{ count: number }>("/notifications/readAll", {
        method: "PATCH",
      });
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update notifications.",
      );
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiRequest<{ message: string }>("/auth/logout-user", {
        method: "POST",
      });
      navigate("/login");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Could not log out.",
      );
      setLoggingOut(false);
    }
  };

  const displayedProjects = projects.slice(0, 4);
  const displayedTasks = tasks.slice(0, 5);
  const displayedActivities = activities.slice(0, 5);
  const displayedNotifications = notifications.slice(0, 4);

  if (loading) {
    return (
      <main className="tf-dashboard tf-dashboard-loading">
        <div className="tf-loading-card">
          <div className="tf-loading-mark">
            <span />
          </div>
          <p>Preparing your workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`tf-dashboard ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      {/* Mobile overlay closes the compact sidebar when tapped. */}
      {mobileNavOpen && (
        <button
          className="tf-mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`tf-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <a
          className="tf-brand"
          href="/dashboard"
          aria-label="TaskFlow dashboard"
        >
          <img src={logo} alt="TaskFlow" />
          <span>TaskFlow</span>
        </a>

        <button
          className="tf-sidebar-collapse-button"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>

        <div className="tf-workspace-switcher">
          <div className="tf-workspace-icon">T</div>
          <div className="tf-workspace-copy">
            <strong>TaskFlow workspace</strong>
            <span>Project collaboration</span>
          </div>
        </div>

        <div className="tf-nav-label">WORKSPACE</div>
        <nav className="tf-nav" aria-label="Main navigation">
          <button
            className="tf-nav-item active"
            onClick={() => navigate("/dashboard")}
          >
            <LayoutDashboard size={18} /> <span>Overview</span>
          </button>
          <button className="tf-nav-item" onClick={() => navigate("/projects")}>
            <FolderKanban size={18} /> <span>Projects</span>
          </button>
          <button className="tf-nav-item" onClick={() => navigate("/tasks")}>
            <ClipboardList size={18} /> <span>My tasks</span>
            <span className="tf-nav-count">{tasks.length}</span>
          </button>
          <button
            className="tf-nav-item"
            onClick={() => navigate("/invitations")}
          >
            <Users size={18} /> <span>Invitations</span>
            {invitations.length > 0 && (
              <span className="tf-nav-count">{invitations.length}</span>
            )}
          </button>
          <button
            className="tf-nav-item"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={18} /> <span>Notifications</span>
            {unreadNotifications > 0 && <span className="tf-nav-dot" />}
          </button>
        </nav>

        <div className="tf-nav-label tf-nav-label-spaced">PERSONAL</div>
        <nav className="tf-nav" aria-label="Personal navigation">
          <button className="tf-nav-item" onClick={() => navigate("/activity")}>
            <Activity size={18} /> <span>Activity</span>
          </button>
          <button className="tf-nav-item" onClick={() => navigate("/settings")}>
            <Settings size={18} /> <span>Settings</span>
          </button>
        </nav>

        <div className="tf-sidebar-bottom">
          <div className="tf-help-card">
            <div className="tf-help-icon">
              <CircleHelp size={17} />
            </div>
            <div>
              <strong>Need a hand?</strong>
              <span>Explore the workspace</span>
            </div>
            <ArrowRight size={15} />
          </div>
          <button
            className="tf-profile-button"
            onClick={() => navigate("/settings")}
          >
            <span className="tf-avatar">
              {user ? getInitials(user.name) : "TF"}
            </span>
            <span className="tf-profile-copy">
              <strong>{user?.name || "Your account"}</strong>
              <small>{user?.email || "TaskFlow workspace"}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <section className="tf-main-shell">
        <header className="tf-topbar">
          <div className="tf-topbar-left">
            <button
              className="tf-icon-button tf-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <div className="tf-breadcrumb">
              <span>Workspace</span>
              <span className="tf-breadcrumb-separator">/</span>
              <strong>Overview</strong>
            </div>
          </div>
          <div className="tf-topbar-right">
            <div className="tf-global-search-wrap">
              <div className="tf-global-search">
                <Search size={16} />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSearchOpen(false);
                  }}
                  placeholder="Search tasks, projects, people..."
                  aria-label="Search tasks, projects and users"
                />
                <kbd>⌘ K</kbd>
              </div>
              {searchOpen && searchQuery.trim().length >= 2 && (
                <div className="tf-search-results">
                  {searchLoading && (
                    <div className="tf-search-empty">Searching workspace…</div>
                  )}
                  {!searchLoading &&
                    matchingProjects.length === 0 &&
                    matchingTasks.length === 0 &&
                    searchUsers.length === 0 && (
                      <div className="tf-search-empty">
                        No matching tasks, projects or people.
                      </div>
                    )}
                  {matchingProjects.length > 0 && (
                    <div className="tf-search-group">
                      <span>PROJECTS</span>
                      {matchingProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery("");
                            navigate(`/projects/${project.id}`);
                          }}
                        >
                          <FolderKanban size={15} />
                          <span>
                            <strong>{project.name}</strong>
                            <small>Project</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchingTasks.length > 0 && (
                    <div className="tf-search-group">
                      <span>TASKS</span>
                      {matchingTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery("");
                            navigate(`/tasks/${task.id}`);
                          }}
                        >
                          <ClipboardList size={15} />
                          <span>
                            <strong>{task.title}</strong>
                            <small>{task.project.name}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchUsers.length > 0 && (
                    <div className="tf-search-group">
                      <span>PEOPLE</span>
                      {searchUsers.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => {
                            void navigator.clipboard?.writeText(person.id);
                            setSearchOpen(false);
                          }}
                          title="Click to copy user ID"
                        >
                          <UserRound size={15} />
                          <span>
                            <strong>{person.name}</strong>
                            <small>{person.email} · click to copy ID</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className="tf-icon-button tf-notification-button"
              aria-label="Open notifications"
              onClick={() => navigate("/notifications")}
            >
              <Bell size={18} />
              {unreadNotifications > 0 && <i />}
            </button>
            <button
              className="tf-top-avatar"
              onClick={() => navigate("/settings")}
              aria-label="Open profile"
            >
              {user ? getInitials(user.name) : "TF"}
            </button>
          </div>
        </header>

        <div className="tf-content">
          <div className="tf-page-heading">
            <div>
              <div className="tf-eyebrow">
                <Sparkles size={13} /> YOUR WORKSPACE AT A GLANCE
              </div>
              <h1>Overview</h1>
              <p>
                Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
                Here's what's happening with your team.
              </p>
            </div>
            <div className="tf-heading-actions">
              <button
                className="tf-secondary-button"
                onClick={() => void refreshDashboard()}
                disabled={refreshing}
              >
                <Activity size={15} /> {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <button
                className="tf-primary-button"
                onClick={() => setShowCreateProject(true)}
              >
                <Plus size={17} /> New project
              </button>
            </div>
          </div>

          {pageError && (
            <div className="tf-alert">
              <AlertCircle size={17} />
              <span>{pageError}</span>
              <button
                onClick={() => setPageError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {sectionErrors.length > 0 && (
            <div className="tf-subtle-warning">
              <AlertCircle size={15} /> Some dashboard sections could not load:{" "}
              {sectionErrors.join(" ")}
            </div>
          )}

          <div className="tf-stat-grid">
            <article className="tf-stat-card">
              <div className="tf-stat-top">
                <span className="tf-stat-icon blue">
                  <FolderKanban size={18} />
                </span>
                <span className="tf-stat-caption">ALL WORKSPACES</span>
              </div>
              <div className="tf-stat-value">{summary.projects.total}</div>
              <div className="tf-stat-bottom">
                <strong>{summary.projects.active} active</strong>
                <span>Projects you belong to</span>
              </div>
            </article>
            <article className="tf-stat-card">
              <div className="tf-stat-top">
                <span className="tf-stat-icon teal">
                  <CheckCircle2 size={18} />
                </span>
                <span className="tf-stat-caption">PROJECTS FINISHED</span>
              </div>
              <div className="tf-stat-value">{summary.projects.completed}</div>
              <div className="tf-stat-bottom">
                <strong>Completed</strong>
                <span>Projects marked complete</span>
              </div>
            </article>
            <article className="tf-stat-card">
              <div className="tf-stat-top">
                <span className="tf-stat-icon violet">
                  <ClipboardList size={18} />
                </span>
                <span className="tf-stat-caption">TASKS IN PROJECTS</span>
              </div>
              <div className="tf-stat-value">{summary.tasks.total}</div>
              <div className="tf-stat-bottom">
                <strong>{summary.tasks.completed} completed</strong>
                <span>Across your projects</span>
              </div>
            </article>
            <article className="tf-stat-card">
              <div className="tf-stat-top">
                <span className="tf-stat-icon amber">
                  <Clock3 size={18} />
                </span>
                <span className="tf-stat-caption">NEEDS ATTENTION</span>
              </div>
              <div className="tf-stat-value">{summary.tasks.overdue}</div>
              <div className="tf-stat-bottom">
                <strong
                  className={summary.tasks.overdue > 0 ? "tf-danger-text" : ""}
                >
                  {summary.tasks.overdue > 0
                    ? "Overdue tasks"
                    : "You're on track"}
                </strong>
                <span>Past due and not completed</span>
              </div>
            </article>
          </div>

          <div className="tf-dashboard-grid">
            <div className="tf-main-column">
              <section className="tf-panel tf-progress-panel">
                <div className="tf-panel-header">
                  <div>
                    <h2>Task progress</h2>
                    <p>A live snapshot of task status across your projects</p>
                  </div>
                  <button
                    className="tf-text-link"
                    onClick={() => navigate("/tasks")}
                  >
                    View tasks <ArrowRight size={14} />
                  </button>
                </div>
                <div
                  className="tf-progress-chart"
                  aria-label="Your completed tasks grouped by weekday based on their last update date"
                >
                  <div className="tf-chart-y-label">
                    <span>{maxWeeklyCount}</span>
                    <span>{Math.ceil(maxWeeklyCount / 2)}</span>
                    <span>0</span>
                  </div>
                  <div className="tf-chart-bars">
                    {weeklyTaskProgress.map((day, index) => (
                      <div
                        className="tf-chart-day"
                        key={day.label}
                        title={`${day.count} completed task(s), grouped by last update date`}
                      >
                        <div className="tf-chart-bar-track">
                          <span
                            className={
                              index === Math.max(0, new Date().getDay() - 1)
                                ? "is-current-day"
                                : ""
                            }
                            style={{
                              height: `${day.count ? Math.max(10, (day.count / maxWeeklyCount) * 100) : 3}%`,
                            }}
                          />
                        </div>
                        <small>{day.label}</small>
                      </div>
                    ))}
                  </div>
                  <div className="tf-chart-summary">
                    <strong>
                      {weeklyTaskProgress.reduce(
                        (total, day) => total + day.count,
                        0,
                      )}
                    </strong>
                    <span>completed tasks</span>
                    <small>This week · grouped by last update</small>
                  </div>
                </div>
                <div className="tf-progress-legend">
                  {taskStatusRows.map((row) => (
                    <span key={row.className}>
                      <i className={row.className} />
                      {row.label}
                      <strong>{row.count}</strong>
                    </span>
                  ))}
                </div>
              </section>

              <section className="tf-panel tf-projects-panel">
                <div className="tf-panel-header">
                  <div>
                    <h2>Projects</h2>
                    <p>Your recently updated workspaces</p>
                  </div>
                  <button
                    className="tf-text-link"
                    onClick={() => navigate("/projects")}
                  >
                    All projects <ArrowRight size={14} />
                  </button>
                </div>
                {displayedProjects.length === 0 ? (
                  <div className="tf-empty-state">
                    <span className="tf-empty-icon">
                      <FolderKanban size={20} />
                    </span>
                    <strong>No projects yet</strong>
                    <p>
                      Create your first project to start organizing work with
                      your team.
                    </p>
                    <button
                      className="tf-primary-button small"
                      onClick={() => setShowCreateProject(true)}
                    >
                      <Plus size={15} /> Create project
                    </button>
                  </div>
                ) : (
                  <div className="tf-project-list">
                    {displayedProjects.map((project) => (
                      <button
                        className="tf-project-row"
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <span className="tf-project-symbol">
                          <FolderKanban size={18} />
                        </span>
                        <span className="tf-project-main">
                          <strong>{project.name}</strong>
                          <small>
                            {project.description?.trim() ||
                              "No project description"}
                          </small>
                        </span>
                        <span
                          className={`tf-project-status ${project.status.toLowerCase()}`}
                        >
                          {statusLabel(project.status)}
                        </span>
                        <span className="tf-project-members">
                          <Users size={14} /> {project.members?.length ?? 0}
                        </span>
                        <span className="tf-project-updated">
                          {formatDate(project.updatedAt)}
                        </span>
                        <ArrowRight className="tf-project-arrow" size={15} />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="tf-panel tf-activity-panel">
                <div className="tf-panel-header">
                  <div>
                    <h2>Recent activity</h2>
                    <p>The latest updates from your projects</p>
                  </div>
                  <button
                    className="tf-text-link"
                    onClick={() => navigate("/activity")}
                  >
                    View activity <ArrowRight size={14} />
                  </button>
                </div>
                {displayedActivities.length === 0 ? (
                  <div className="tf-empty-inline">
                    <Activity size={18} />
                    <span>No activity has been recorded yet.</span>
                  </div>
                ) : (
                  <div className="tf-activity-list">
                    {displayedActivities.map((item) => (
                      <div className="tf-activity-row" key={item.id}>
                        <span className="tf-activity-avatar">
                          {item.actor ? getInitials(item.actor.name) : "?"}
                        </span>
                        <div className="tf-activity-description">
                          <strong>{item.actor?.name || "A team member"}</strong>
                          <span>{readableAction(item.action)}</span>
                          <small>
                            in <b>{item.project.name}</b>
                          </small>
                        </div>
                        <time>{timeAgo(item.createdAt)}</time>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="tf-right-column">
              <section className="tf-panel tf-my-tasks-panel">
                <div className="tf-panel-header compact">
                  <div>
                    <h2>My tasks</h2>
                    <p>Tasks assigned to you</p>
                  </div>
                  <span className="tf-count-pill">{tasks.length}</span>
                </div>
                {displayedTasks.length === 0 ? (
                  <div className="tf-empty-inline">
                    <CheckCircle2 size={18} />
                    <span>No tasks are currently assigned to you.</span>
                  </div>
                ) : (
                  <div className="tf-my-task-list">
                    {displayedTasks.map((task) => (
                      <div className="tf-my-task-row" key={task.id}>
                        <button
                          className="tf-task-title-button"
                          onClick={() => navigate(`/tasks/${task.id}`)}
                        >
                          <span
                            className={`tf-task-priority-dot ${task.priority.toLowerCase()}`}
                          />
                          <span>
                            <strong>{task.title}</strong>
                            <small>{task.project.name}</small>
                          </span>
                        </button>
                        <div className="tf-task-meta">
                          <span
                            className={`tf-task-status ${task.status.toLowerCase()}`}
                          >
                            {statusLabel(task.status)}
                          </span>
                          {task.dueDate && (
                            <time>
                              <CalendarDays size={12} />{" "}
                              {formatDate(task.dueDate)}
                            </time>
                          )}
                        </div>
                        {task.status !== "COMPLETED" && (
                          <button
                            className="tf-complete-task"
                            onClick={() => void handleCompleteTask(task.id)}
                            disabled={completingTaskId === task.id}
                          >
                            {completingTaskId === task.id ? (
                              "Saving…"
                            ) : (
                              <>
                                <Check size={13} /> Complete
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="tf-panel-footer-link"
                  onClick={() => navigate("/tasks")}
                >
                  Open task list <ArrowRight size={14} />
                </button>
              </section>

              <section className="tf-panel tf-invitations-panel">
                <div className="tf-panel-header compact">
                  <div>
                    <h2>Invitations</h2>
                    <p>Projects waiting for your response</p>
                  </div>
                  <span className="tf-count-pill blue-count">
                    {invitations.length}
                  </span>
                </div>
                {invitations.length === 0 ? (
                  <div className="tf-empty-inline">
                    <Inbox size={18} />
                    <span>No pending invitations.</span>
                  </div>
                ) : (
                  <div className="tf-invitation-list">
                    {invitations.slice(0, 3).map((invite) => (
                      <div className="tf-invitation-row" key={invite.id}>
                        <span className="tf-invite-avatar">
                          {getInitials(invite.project.name)}
                        </span>
                        <span>
                          <strong>{invite.project.name}</strong>
                          <small>From {invite.invitedBy.name}</small>
                        </span>
                        <span className="tf-invite-expiry">
                          Until {formatDate(invite.expiresAt)}
                        </span>
                      </div>
                    ))}
                    <button
                      className="tf-panel-footer-link"
                      onClick={() => navigate("/invitations")}
                    >
                      Review invitations <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </section>

              <section className="tf-panel tf-notifications-panel">
                <div className="tf-panel-header compact">
                  <div>
                    <h2>Notifications</h2>
                    <p>Your latest updates</p>
                  </div>
                  {unreadNotifications > 0 && (
                    <button
                      className="tf-mini-link"
                      onClick={() => void handleMarkAllRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {displayedNotifications.length === 0 ? (
                  <div className="tf-empty-inline">
                    <Bell size={18} />
                    <span>You're all caught up.</span>
                  </div>
                ) : (
                  <div className="tf-notification-list">
                    {displayedNotifications.map((notification) => (
                      <button
                        className={`tf-notification-row ${notification.readAt ? "is-read" : "is-unread"}`}
                        key={notification.id}
                        onClick={() => navigate("/notifications")}
                      >
                        <span className="tf-notification-indicator" />
                        <span>
                          <strong>{notification.title}</strong>
                          <small>{notification.message}</small>
                          <time>{timeAgo(notification.createdAt)}</time>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="tf-encouragement-card">
                <div className="tf-encouragement-icon">
                  <Sparkles size={19} />
                </div>
                <strong>Small steps add up.</strong>
                <p>Keep your projects moving forward, one task at a time.</p>
                <span>
                  <ArrowDownRight size={16} /> Stay focused
                </span>
              </div>
            </aside>
          </div>

          <footer className="tf-footer">
            <span>© {new Date().getFullYear()} TaskFlow</span>
            <span>Make teamwork feel effortless.</span>
            <button onClick={() => void handleLogout()} disabled={loggingOut}>
              <LogOut size={14} /> {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </footer>
        </div>
      </section>

      {/* Project creation uses the same POST endpoint as the backend API. */}
      {showCreateProject && (
        <div
          className="tf-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setShowCreateProject(false);
          }}
        >
          <form className="tf-create-modal" onSubmit={handleCreateProject}>
            <div className="tf-modal-header">
              <div>
                <span className="tf-modal-icon">
                  <Plus size={18} />
                </span>
                <div>
                  <h2>Create a project</h2>
                  <p>Give your team a place to organize work.</p>
                </div>
              </div>
              <button
                type="button"
                className="tf-icon-button"
                aria-label="Close"
                onClick={() => setShowCreateProject(false)}
              >
                <X size={18} />
              </button>
            </div>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="e.g. Website redesign"
              maxLength={120}
              autoFocus
            />
            <label htmlFor="project-description">
              Description <span>Optional</span>
            </label>
            <textarea
              id="project-description"
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="What is this project about?"
              rows={3}
            />
            {projectFormError && (
              <p className="tf-form-error">
                <AlertCircle size={14} /> {projectFormError}
              </p>
            )}
            <div className="tf-modal-actions">
              <button
                type="button"
                className="tf-secondary-button"
                onClick={() => setShowCreateProject(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="tf-primary-button"
                disabled={creatingProject}
              >
                {creatingProject ? (
                  "Creating…"
                ) : (
                  <>
                    <Plus size={16} /> Create project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
