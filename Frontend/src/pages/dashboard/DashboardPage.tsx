import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import logo from "../../assets/taskflow-logo.png";
import "./DashboardPage.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

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
  projects: { total: number; active: number; completed: number; archived: number };
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
  user: User;
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
  updatedAt: string;
  project: { id: string; name: string; status: string };
}

interface ProjectTask extends Omit<Task, "project"> {
  createdBy: User;
  assignedTo: User | null;
  project: Task["project"];
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: User | null;
  project: { id: string; name: string };
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

interface Invitation {
  id: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  project: { id: string; name: string; status: string; description: string | null };
  invitedBy: User;
}

interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

type View = "overview" | "projects" | "tasks" | "activity" | "members" | "notifications" | "invitations";
type TaskFilter = "ALL" | Task["status"];

const EMPTY_SUMMARY: DashboardSummary = {
  projects: { total: 0, active: 0, completed: 0, archived: 0 },
  tasks: { total: 0, todo: 0, inProgress: 0, inReview: 0, completed: 0, overdue: 0 },
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Request failed (${response.status})`);
  }
  return result.data;
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  return labels[status] || status.replaceAll("_", " ");
}

function readableAction(action: string) {
  return action.toLowerCase().replaceAll("_", " ");
}

function priorityLabel(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function Avatar({ user, size = "md" }: { user: Pick<User, "name" | "avatarUrl">; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`tf-avatar tf-avatar-${size}`} title={user.name}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user.name)}
    </span>
  );
}

export default function DashboardPage() {
  const [view, setView] = useState<View>("overview");
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [projects, setProjects] = useState<Project[]>([]);
  // "tasks" is intentionally the personal assigned-to-me feed.
  // "projectTasks" contains every task in every project the user belongs to.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<SearchUserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [projectTab, setProjectTab] = useState<"projects" | "members">("projects");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("ALL");
  const [taskScope, setTaskScope] = useState<"PROJECT" | "MINE">("PROJECT");
  const [taskProjectFilter, setTaskProjectFilter] = useState("ALL");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [invitationActionId, setInvitationActionId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    const requests = await Promise.allSettled([
      apiRequest<User>("/auth/me"),
      apiRequest<DashboardSummary>("/dashboard/summary"),
      apiRequest<Project[]>("/project/projects"),
      apiRequest<Task[]>("/tasks/"),
      apiRequest<{ totalActivities: number; activities: ActivityItem[] }>("/dashboard/recent-activity"),
      apiRequest<NotificationItem[]>("/notifications/"),
      apiRequest<{ TotalInvitations: number; invitations: Invitation[] }>("/invitation/invitations"),
    ]);

    const errors: string[] = [];
    const [userResult, summaryResult, projectResult, taskResult, activityResult, notificationResult, invitationResult] = requests;

    if (userResult.status === "fulfilled") setUser(userResult.value);
    else setPageError(userResult.reason instanceof Error ? userResult.reason.message : "Could not verify your session.");

    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    else errors.push("Dashboard summary could not be loaded.");
    if (projectResult.status === "fulfilled") {
      const projectList = projectResult.value;
      setProjects(projectList);

      // The personal /tasks endpoint only returns tasks assigned to the
      // current user. Load each member-visible project task board as well,
      // so the dashboard can show the team's complete project workload.
      const projectTaskResults = await Promise.allSettled(
        projectList.map(async (project) => {
          const projectTasks = await apiRequest<Omit<ProjectTask, "project">[]>(
            `/tasks/project/${project.id}/tasks`,
          );
          return projectTasks.map((task) => ({
            ...task,
            project: {
              id: project.id,
              name: project.name,
              status: project.status,
            },
          }));
        }),
      );

      const allProjectTasks: ProjectTask[] = [];
      let projectTaskLoadFailed = false;
      projectTaskResults.forEach((result) => {
        if (result.status === "fulfilled") allProjectTasks.push(...result.value);
        else projectTaskLoadFailed = true;
      });
      allProjectTasks.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setProjectTasks(allProjectTasks);
      if (projectTaskLoadFailed) errors.push("Some project task boards could not be loaded.");
    } else {
      setProjects([]);
      setProjectTasks([]);
      errors.push("Projects could not be loaded.");
    }

    if (taskResult.status === "fulfilled") setTasks(taskResult.value);
    else errors.push("Your assigned tasks could not be loaded.");
    if (activityResult.status === "fulfilled") setActivities(activityResult.value.activities || []);
    else errors.push("Recent activity could not be loaded.");
    if (notificationResult.status === "fulfilled") setNotifications(notificationResult.value);
    else errors.push("Notifications could not be loaded.");
    if (invitationResult.status === "fulfilled") setInvitations(invitationResult.value.invitations || []);
    else errors.push("Invitations could not be loaded.");

    setSectionErrors(errors);
    setLoading(false);
  }, []);

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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchUsers([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await apiRequest<SearchUserResult[]>(`/user/search?q=${encodeURIComponent(query)}`);
        if (!cancelled) setSearchUsers(result);
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
    return query.length >= 2 ? projects.filter((project) => project.name.toLowerCase().includes(query)).slice(0, 5) : [];
  }, [projects, searchQuery]);

  const matchingTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query.length >= 2
      ? projectTasks
          .filter((task) => `${task.title} ${task.project.name}`.toLowerCase().includes(query))
          .slice(0, 5)
      : [];
  }, [projectTasks, searchQuery]);

  const collaborators = useMemo(() => {
    const people = new Map<string, { user: User; projectNames: Set<string> }>();
    projects.forEach((project) => {
      project.members?.forEach((member) => {
        if (member.user.id === user?.id) return;
        const existing = people.get(member.user.id);
        if (existing) existing.projectNames.add(project.name);
        else people.set(member.user.id, { user: member.user, projectNames: new Set([project.name]) });
      });
    });
    return Array.from(people.values()).sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [projects, user?.id]);

  // Project members can collaborate on tasks, but creating tasks is limited
  // to owners and admins. The backend enforces the same rule independently.
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "ACTIVE"),
    [projects],
  );
  const taskCreationProjects = useMemo(
    () => activeProjects.filter((project) =>
      project.members.some(
        (member) =>
          member.user.id === user?.id &&
          (member.role === "OWNER" || member.role === "ADMIN"),
      ),
    ),
    [activeProjects, user?.id],
  );
  const canCreateTask = taskCreationProjects.length > 0;
  const selectedTaskProject = taskCreationProjects.find((project) => project.id === taskProjectId);

  const visibleProjectTasks = useMemo(
    () => projectTasks.filter((task) =>
      taskProjectFilter === "ALL" || task.project.id === taskProjectFilter,
    ),
    [projectTasks, taskProjectFilter],
  );

  const filteredProjectTasks = useMemo(
    () => visibleProjectTasks.filter((task) =>
      taskFilter === "ALL" || task.status === taskFilter,
    ),
    [visibleProjectTasks, taskFilter],
  );

  const filteredMyTasks = useMemo(
    () => tasks.filter((task) => taskFilter === "ALL" || task.status === taskFilter),
    [tasks, taskFilter],
  );

  const canCompleteProjectTask = useCallback((task: ProjectTask) => {
    const project = projects.find((item) => item.id === task.project.id);
    const membership = project?.members.find((member) => member.user.id === user?.id);
    return (
      task.assignedTo?.id === user?.id ||
      task.createdBy.id === user?.id ||
      membership?.role === "OWNER" ||
      membership?.role === "ADMIN"
    );
  }, [projects, user?.id]);

  const weeklyProgress = useMemo(() => {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() - mondayOffset);

    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateKey = date.toDateString();
      const count = projectTasks.filter((task) => task.status === "COMPLETED" && new Date(task.updatedAt).toDateString() === dateKey).length;
      return { label: date.toLocaleDateString(undefined, { weekday: "short" }), count, date };
    });
  }, [projectTasks]);

  const maxWeeklyCount = Math.max(1, ...weeklyProgress.map((day) => day.count));
  const completedThisWeek = weeklyProgress.reduce((total, day) => total + day.count, 0);
  const unreadNotifications = notifications.filter((item) => !item.readAt).length;
  const upcomingTasks = projectTasks.filter((task) => {
    if (!task.dueDate || task.status === "COMPLETED") return false;
    const due = new Date(task.dueDate);
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    return due >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && due <= end;
  });

  const taskStatusRows = [
    { label: "To do", count: summary.tasks.todo, key: "todo" },
    { label: "In progress", count: summary.tasks.inProgress, key: "progress" },
    { label: "In review", count: summary.tasks.inReview, key: "review" },
    { label: "Completed", count: summary.tasks.completed, key: "completed" },
  ];
  const pageCopy: Record<View, { title: string; description: string }> = {
    overview: { title: "Overview", description: "A clear view of what’s moving across your workspace." },
    projects: { title: "Projects", description: "The workspaces you’re part of, all in one place." },
    tasks: { title: "Tasks", description: "Shared project work and the tasks assigned directly to you." },
    activity: { title: "Activity", description: "The latest updates recorded across your projects." },
    members: { title: "Members", description: "People collaborating with you across TaskFlow." },
    notifications: { title: "Notifications", description: "Updates and reminders from your workspace." },
    invitations: { title: "Invitations", description: "Project invitations waiting for your response." },
  };

  const openView = (nextView: View) => {
    setView(nextView);
    setMobileNavOpen(false);
    setSearchOpen(false);
  };

  const openCreateTask = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskProjectId(taskCreationProjects[0]?.id || "");
    setTaskPriority("MEDIUM");
    setTaskDueDate("");
    setTaskAssigneeId(user?.id || "");
    setTaskFormError("");
    setShowCreateTask(true);
  };

  const closeCreateTask = () => {
    if (creatingTask) return;
    setShowCreateTask(false);
    setTaskFormError("");
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedTitle = taskTitle.trim();
    if (!normalizedTitle) {
      setTaskFormError("Task title is required.");
      return;
    }
    if (normalizedTitle.length > 160) {
      setTaskFormError("Task title cannot exceed 160 characters.");
      return;
    }
    if (!taskProjectId || !taskCreationProjects.some((project) => project.id === taskProjectId)) {
      setTaskFormError("Choose an active project where you are an owner or admin.");
      return;
    }

    const projectName = selectedTaskProject?.name || "your project";
    setCreatingTask(true);
    setTaskFormError("");
    setPageError("");
    setPageNotice("");

    try {
      await apiRequest<Task>(`/tasks/project/${taskProjectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: normalizedTitle,
          description: taskDescription.trim() || undefined,
          assignedToId: taskAssigneeId || null,
          priority: taskPriority,
          dueDate: taskDueDate ? new Date(`${taskDueDate}T00:00:00.000Z`).toISOString() : null,
        }),
      });

      setShowCreateTask(false);
      setPageNotice(`“${normalizedTitle}” was created in ${projectName}.`);
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate("");
      await refreshDashboard();
    } catch (error) {
      setTaskFormError(error instanceof Error ? error.message : "Could not create task.");
    } finally {
      setCreatingTask(false);
    }
  };

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
        body: JSON.stringify({ name: projectName.trim(), description: projectDescription.trim() || undefined }),
      });
      setProjectName("");
      setProjectDescription("");
      setShowCreateProject(false);
      await refreshDashboard();
    } catch (error) {
      setProjectFormError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      await apiRequest<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      await refreshDashboard();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not update task.");
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest<{ count: number }>("/notifications/readAll", { method: "PATCH" });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not update notifications.");
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await apiRequest<NotificationItem>(`/notifications/${notificationId}/read`, { method: "PATCH" });
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readAt: item.readAt || new Date().toISOString() } : item));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not update notification.");
    }
  };

  const handleInvitation = async (invitationId: string, action: "accept" | "decline") => {
    setInvitationActionId(invitationId);
    try {
      await apiRequest(`/invitation/invitations/${invitationId}/${action}`, { method: "POST" });
      await refreshDashboard();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : `Could not ${action} invitation.`);
    } finally {
      setInvitationActionId(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiRequest<{ message: string }>("/auth/logout-user", { method: "POST" });
      window.location.assign("/login");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not log out.");
      setLoggingOut(false);
    }
  };

  const closeCreateModal = () => {
    if (creatingProject) return;
    setShowCreateProject(false);
    setProjectFormError("");
  };

  if (loading) {
    return (
      <main className="tf-dashboard tf-dashboard-loading">
        <div className="tf-loading-card">
          <span className="tf-loading-mark"><img src={logo} alt="" /></span>
          <span className="tf-loading-line" />
          <p>Preparing your workspace…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="tf-dashboard">
      <div className={`tf-app-frame ${mobileNavOpen ? "tf-mobile-nav-open" : ""}`}>
        {mobileNavOpen && <button className="tf-mobile-overlay" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
        <aside className="tf-rail" aria-label="Workspace shortcuts">
          <button className="tf-rail-brand" onClick={() => openView("overview")} aria-label="TaskFlow overview">
            <img src={logo} alt="TaskFlow" />
          </button>
          <div className="tf-rail-divider" />
          <nav className="tf-rail-nav" aria-label="Main sections">
            <button className={view === "overview" ? "active" : ""} onClick={() => openView("overview")} title="Overview" aria-label="Overview"><LayoutDashboard size={18} /></button>
            <button className={view === "projects" ? "active" : ""} onClick={() => openView("projects")} title="Projects" aria-label="Projects"><FolderKanban size={18} /></button>
            <button className={view === "tasks" ? "active" : ""} onClick={() => openView("tasks")} title="My tasks" aria-label="My tasks"><ListTodo size={18} /></button>
            <button className={view === "activity" ? "active" : ""} onClick={() => openView("activity")} title="Activity" aria-label="Activity"><Activity size={18} /></button>
            <button className={view === "members" ? "active" : ""} onClick={() => openView("members")} title="Members" aria-label="Members"><Users size={18} /></button>
            <button className={view === "invitations" ? "active" : ""} onClick={() => openView("invitations")} title="Invitations" aria-label="Invitations"><Mail size={18} />{invitations.length > 0 && <i />}</button>
            <button className={view === "notifications" ? "active" : ""} onClick={() => openView("notifications")} title="Notifications" aria-label="Notifications"><Bell size={18} />{unreadNotifications > 0 && <i />}</button>
          </nav>
          <div className="tf-rail-bottom">
            <button onClick={() => setShowCreateProject(true)} title="Create project" aria-label="Create project"><Plus size={19} /></button>
            <button onClick={() => void handleLogout()} disabled={loggingOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </aside>

        <div className="tf-app-main">
          <header className="tf-topbar">
            <button className="tf-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <button className="tf-brand-wordmark" onClick={() => openView("overview")}>
              <img src={logo} alt="" />
              <span>TaskFlow</span>
            </button>
            <nav className="tf-top-nav" aria-label="Workspace navigation">
              {(["overview", "projects", "tasks", "activity", "members"] as View[]).map((item) => (
                <button key={item} className={view === item ? "active" : ""} onClick={() => openView(item)}>
                  {item === "overview" ? "Overview" : item === "tasks" ? "Tasks" : item === "activity" ? "Activity" : item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </nav>
            <div className="tf-topbar-actions">
              <div className="tf-search-wrap">
                <div className="tf-search-box">
                  <Search size={15} />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}
                    placeholder="Search or ask TaskFlow..."
                    aria-label="Search projects, tasks and people"
                  />
                  <kbd>⌘ K</kbd>
                </div>
                {searchOpen && searchQuery.trim().length >= 2 && (
                  <>
                    <button className="tf-search-dismiss" aria-label="Close search results" onClick={() => setSearchOpen(false)} />
                    <div className="tf-search-results">
                      {searchLoading && <div className="tf-search-empty">Searching your workspace…</div>}
                      {!searchLoading && matchingProjects.length === 0 && matchingTasks.length === 0 && searchUsers.length === 0 && <div className="tf-search-empty">No matching projects, tasks or people.</div>}
                      {matchingProjects.length > 0 && <div className="tf-search-group"><span>PROJECTS</span>{matchingProjects.map((project) => <button key={project.id} onClick={() => { openView("projects"); setSearchQuery(""); }}><FolderKanban size={15} /><span><strong>{project.name}</strong><small>Project</small></span></button>)}</div>}
                      {matchingTasks.length > 0 && <div className="tf-search-group"><span>TASKS</span>{matchingTasks.map((task) => <button key={task.id} onClick={() => { setTaskScope("PROJECT"); setTaskProjectFilter(task.project.id); setTaskFilter("ALL"); openView("tasks"); setSearchQuery(""); }}><ListTodo size={15} /><span><strong>{task.title}</strong><small>{task.project.name}</small></span></button>)}</div>}
                      {searchUsers.length > 0 && <div className="tf-search-group"><span>PEOPLE</span>{searchUsers.map((person) => <button key={person.id} onClick={() => { void navigator.clipboard?.writeText(person.id); openView("members"); }} title="Copy user ID"><Users size={15} /><span><strong>{person.name}</strong><small>{person.email} · copy user ID</small></span></button>)}</div>}
                    </div>
                  </>
                )}
              </div>
              <button className="tf-top-icon" onClick={() => void refreshDashboard()} disabled={refreshing} aria-label="Refresh dashboard" title="Refresh"><RefreshCw size={16} className={refreshing ? "tf-spin" : ""} /></button>
              <button className="tf-top-icon tf-bell-button" onClick={() => openView("notifications")} aria-label="Open notifications" title="Notifications"><Bell size={17} />{unreadNotifications > 0 && <i />}</button>
              <div className="tf-user-chip" title={user?.email || "TaskFlow account"}>
                {user ? <Avatar user={user} /> : <span className="tf-avatar">TF</span>}
                <span>{user?.name?.split(" ")[0] || "Account"}</span>
                <ChevronDown size={14} />
              </div>
            </div>
          </header>

          <div className="tf-content">
            <div className="tf-page-heading">
              <div>
                <div className="tf-eyebrow"><span /> WORKSPACE</div>
                <h1>{pageCopy[view].title}</h1>
                <p>{view === "overview" && user?.name ? `Welcome back, ${user.name.split(" ")[0]}. ` : ""}{pageCopy[view].description}</p>
              </div>
              <div className="tf-heading-actions">
                <button className="tf-secondary-button" onClick={() => void refreshDashboard()} disabled={refreshing}>
                  <RefreshCw size={15} className={refreshing ? "tf-spin" : ""} /> {refreshing ? "Refreshing" : "Refresh"}
                </button>
                {canCreateTask && <button className="tf-primary-button" onClick={openCreateTask}><Plus size={16} /> New task</button>}
                <button className="tf-secondary-button" onClick={() => setShowCreateProject(true)}><FolderKanban size={15} /> New project</button>
              </div>
            </div>

            {pageError && <div className="tf-alert"><AlertCircle size={16} /><span>{pageError}</span><button onClick={() => setPageError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
            {pageNotice && <div className="tf-success-alert" role="status"><CheckCircle2 size={16} /><span>{pageNotice}</span><button onClick={() => setPageNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}
            {sectionErrors.length > 0 && <div className="tf-soft-alert"><AlertCircle size={15} /><span>Some workspace information is unavailable: {sectionErrors.join(" ")}</span></div>}

            {view === "overview" && (
              <div className="tf-overview-grid">
                <div className="tf-overview-primary">
                  <section className="tf-metric-grid" aria-label="Workspace statistics">
                    <article className="tf-metric-card">
                      <div className="tf-metric-top"><span className="tf-metric-icon blue"><CheckCircle2 size={17} /></span><span>Tasks completed</span></div>
                      <strong>{summary.tasks.completed}</strong>
                      <small><b>{summary.tasks.total}</b> tasks across your projects</small>
                    </article>
                    <article className="tf-metric-card">
                      <div className="tf-metric-top"><span className="tf-metric-icon violet"><Users size={17} /></span><span>Collaborators</span></div>
                      <strong>{collaborators.length}</strong>
                      <small>People in your project teams</small>
                    </article>
                    <article className="tf-metric-card">
                      <div className="tf-metric-top"><span className="tf-metric-icon amber"><CalendarDays size={17} /></span><span>Upcoming</span></div>
                      <strong>{upcomingTasks.length}</strong>
                      <small>Project tasks due in 7 days</small>
                    </article>
                  </section>

                  <section className="tf-panel tf-chart-panel">
                    <div className="tf-panel-heading">
                      <div><h2>Task activity</h2><p>Completed tasks by weekday, based on their last update</p></div>
                      <span className="tf-period-pill"><CalendarDays size={13} /> This week <ChevronDown size={13} /></span>
                    </div>
                    <div className="tf-chart-wrap">
                      <div className="tf-chart-y"><span>{maxWeeklyCount}</span><span>{Math.ceil(maxWeeklyCount / 2)}</span><span>0</span></div>
                      <div className="tf-chart">
                        <div className="tf-chart-gridlines"><i /><i /><i /></div>
                        {weeklyProgress.map((day, index) => (
                          <div className="tf-chart-day" key={day.label} title={`${day.count} task(s) last updated on ${day.date.toLocaleDateString()}`}>
                            <div className="tf-chart-track"><span className={index === Math.min(4, Math.max(0, new Date().getDay() - 1)) ? "current" : ""} style={{ height: `${day.count ? Math.max(9, (day.count / maxWeeklyCount) * 100) : 3}%` }} /></div>
                            <small>{day.label}</small>
                          </div>
                        ))}
                        <div className="tf-chart-callout"><span /> <strong>{completedThisWeek}</strong><span>completed this week</span></div>
                      </div>
                    </div>
                    <div className="tf-chart-footnote"><span><i className="tf-dot-blue" /> Completed tasks</span><small>Task API exposes last-updated time, not a separate completion timestamp.</small></div>
                  </section>

                  <section className="tf-panel tf-projects-panel">
                    <div className="tf-panel-heading tf-project-heading">
                      <div><h2>Your workspace</h2><p>Projects and people you work with</p></div>
                      <div className="tf-tabs" role="tablist" aria-label="Workspace view">
                        <button role="tab" aria-selected={projectTab === "projects"} className={projectTab === "projects" ? "active" : ""} onClick={() => setProjectTab("projects")}>Projects</button>
                        <button role="tab" aria-selected={projectTab === "members"} className={projectTab === "members" ? "active" : ""} onClick={() => setProjectTab("members")}>Members</button>
                      </div>
                    </div>
                    {projectTab === "projects" ? (
                      projects.length === 0 ? <div className="tf-empty-state"><span className="tf-empty-icon"><FolderKanban size={20} /></span><strong>Your first project starts here</strong><p>Create a project to bring tasks and teammates together.</p><button className="tf-primary-button tf-small-button" onClick={() => setShowCreateProject(true)}><Plus size={14} /> Create project</button></div> :
                      <div className="tf-project-list">{projects.slice(0, 4).map((project) => (
                        <article className="tf-project-row" key={project.id}>
                          <span className="tf-project-mark"><FolderKanban size={16} /></span>
                          <div className="tf-project-copy"><strong>{project.name}</strong><small>{project.description?.trim() || "No description added"}</small></div>
                          <div className="tf-project-avatars">{project.members.slice(0, 3).map((member) => <Avatar key={member.user.id} user={member.user} size="sm" />)}{project.members.length > 3 && <span className="tf-avatar tf-avatar-sm tf-avatar-extra">+{project.members.length - 3}</span>}</div>
                          <span className={`tf-status-pill ${project.status.toLowerCase()}`}>{statusLabel(project.status)}</span>
                          <small className="tf-project-date">{formatDate(project.updatedAt)}</small>
                        </article>
                      ))}</div>
                    ) : (
                      collaborators.length === 0 ? <div className="tf-empty-state"><span className="tf-empty-icon"><Users size={20} /></span><strong>Your team will show up here</strong><p>Invite teammates through a project to start collaborating.</p></div> :
                      <div className="tf-member-list">{collaborators.slice(0, 4).map((person) => <div className="tf-member-row" key={person.user.id}><Avatar user={person.user} /><span><strong>{person.user.name}</strong><small>{person.user.email}</small></span><small className="tf-member-project-count">{person.projectNames.size} {person.projectNames.size === 1 ? "project" : "projects"}</small></div>)}</div>
                    )}
                    {projects.length > 0 && <button className="tf-panel-link" onClick={() => openView(projectTab === "projects" ? "projects" : "members")}>View all {projectTab} <ArrowRight size={14} /></button>}
                  </section>

                  <section className="tf-panel tf-shared-tasks-panel">
                    <div className="tf-panel-heading">
                      <div><h2>Project tasks</h2><p>Work in progress across all your project teams</p></div>
                      <span className="tf-count-pill">{projectTasks.length} tasks</span>
                    </div>
                    {projectTasks.length === 0 ? (
                      <div className="tf-empty-inline"><ListTodo size={17} /><span>No project tasks yet. Tasks created by your team will appear here.</span></div>
                    ) : (
                      <div className="tf-shared-task-list">
                        {projectTasks.slice(0, 5).map((task) => (
                          <article className="tf-shared-task-row" key={task.id}>
                            <span className={`tf-priority-dot ${task.priority.toLowerCase()}`} />
                            <div className="tf-shared-task-copy">
                              <strong>{task.title}</strong>
                              <small>{task.project.name} · {task.assignedTo ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}</small>
                            </div>
                            <span className={`tf-status-pill task-${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span>
                            <small className="tf-shared-task-date">{task.dueDate ? formatDate(task.dueDate) : "No due date"}</small>
                          </article>
                        ))}
                      </div>
                    )}
                    {projectTasks.length > 0 && <button className="tf-panel-link" onClick={() => { setTaskScope("PROJECT"); setTaskProjectFilter("ALL"); openView("tasks"); }}>View all project tasks <ArrowRight size={14} /></button>}
                  </section>
                </div>

                <aside className="tf-overview-aside">
                  <section className="tf-panel tf-quick-panel">
                    <div className="tf-quick-intro"><div><span className="tf-eyebrow"><Sparkles size={12} /> GET MOVING</span><h2>Start your next step</h2><p>Pick up where your team left off.</p></div><span className="tf-quick-spark"><Sparkles size={20} /></span></div>
                    <div className="tf-quick-list">
                      {canCreateTask
                        ? <button onClick={openCreateTask}><span className="tf-quick-icon blue"><ListTodo size={16} /></span><span><strong>Create a task</strong><small>Add work to an existing project</small></span><ChevronRight size={16} /></button>
                        : <div className="tf-quick-permission-note">Task creation is available to project owners and admins.</div>}
                      <button onClick={() => setShowCreateProject(true)}><span className="tf-quick-icon violet"><Plus size={16} /></span><span><strong>Create a project</strong><small>Set up a new team workspace</small></span><ChevronRight size={16} /></button>
                      <button onClick={() => openView("tasks")}><span className="tf-quick-icon amber"><ListTodo size={16} /></span><span><strong>Review my tasks</strong><small>{tasks.length} assigned to you</small></span><ChevronRight size={16} /></button>
                      <button onClick={() => openView("invitations")}><span className="tf-quick-icon amber"><Mail size={16} /></span><span><strong>Project invitations</strong><small>{invitations.length} waiting for a response</small></span><ChevronRight size={16} /></button>
                      <button onClick={() => openView("activity")}><span className="tf-quick-icon green"><Activity size={16} /></span><span><strong>See team activity</strong><small>Latest project updates</small></span><ChevronRight size={16} /></button>
                    </div>
                  </section>

                  <section className="tf-panel tf-breakdown-panel">
                    <div className="tf-panel-heading"><div><h2>Task breakdown</h2><p>Across all projects you belong to</p></div><button className="tf-panel-icon-button" onClick={() => openView("tasks")} aria-label="View tasks"><SlidersHorizontal size={15} /></button></div>
                    <div className="tf-breakdown-total"><strong>{summary.tasks.total}</strong><span>total tasks</span></div>
                    <div className="tf-breakdown-bars">{taskStatusRows.map((row) => <span key={row.key} className={row.key} style={{ width: `${summary.tasks.total ? (row.count / summary.tasks.total) * 100 : 0}%` }} />)}</div>
                    <div className="tf-breakdown-list">{taskStatusRows.map((row) => <div key={row.key}><span><i className={row.key} />{row.label}</span><strong>{row.count}</strong></div>)}</div>
                    {summary.tasks.overdue > 0 && <div className="tf-overdue-note"><Clock3 size={14} /> {summary.tasks.overdue} overdue {summary.tasks.overdue === 1 ? "task needs" : "tasks need"} attention</div>}
                  </section>

                  <section className="tf-panel tf-my-tasks-panel">
                    <div className="tf-panel-heading">
                      <div><h2>My tasks</h2><p>Tasks assigned directly to you</p></div>
                      <span className="tf-count-pill">{tasks.length}</span>
                    </div>
                    {tasks.length === 0 ? (
                      <div className="tf-empty-inline"><CheckCircle2 size={17} /><span>Nothing assigned to you yet. You can still follow your team's project tasks.</span></div>
                    ) : (
                      <div className="tf-my-task-preview-list">
                        {tasks.slice(0, 4).map((task) => (
                          <article className="tf-my-task-preview-row" key={task.id}>
                            <span className={`tf-priority-dot ${task.priority.toLowerCase()}`} />
                            <div className="tf-my-task-preview-copy">
                              <strong>{task.title}</strong>
                              <small>{task.project.name}</small>
                            </div>
                            <span className={`tf-status-pill task-${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span>
                            {task.status !== "COMPLETED" && (
                              <button className="tf-complete-button" onClick={() => void handleCompleteTask(task.id)} disabled={completingTaskId === task.id}>
                                {completingTaskId === task.id ? "Saving…" : <><Check size={13} /> Complete</>}
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                    <button className="tf-panel-link" onClick={() => { setTaskScope("MINE"); setTaskFilter("ALL"); openView("tasks"); }}>Open my tasks <ArrowRight size={14} /></button>
                  </section>

                  <section className="tf-panel tf-inbox-panel">
                    <div className="tf-panel-heading"><div><h2>Your inbox</h2><p>Messages and invitations</p></div><Inbox size={17} /></div>
                    <button className="tf-inbox-row" onClick={() => openView("notifications")}><span className="tf-inbox-icon"><Bell size={15} /></span><span><strong>Notifications</strong><small>{unreadNotifications} unread</small></span><ChevronRight size={15} /></button>
                    <button className="tf-inbox-row" onClick={() => openView("invitations")}><span className="tf-inbox-icon"><Mail size={15} /></span><span><strong>Invitations</strong><small>{invitations.length} pending</small></span><ChevronRight size={15} /></button>
                  </section>
                </aside>
              </div>
            )}

            {view === "projects" && (
              <section className="tf-panel tf-full-panel">
                <div className="tf-panel-heading"><div><h2>All projects</h2><p>{projects.length} project{projects.length === 1 ? "" : "s"} you belong to</p></div><button className="tf-primary-button tf-small-button" onClick={() => setShowCreateProject(true)}><Plus size={14} /> New project</button></div>
                {projects.length === 0 ? <div className="tf-empty-state"><strong>No projects yet</strong><p>Create your first project to get started.</p></div> : <div className="tf-project-list tf-project-list-expanded">{projects.map((project) => <article className="tf-project-row" key={project.id}><span className="tf-project-mark"><FolderKanban size={16} /></span><div className="tf-project-copy"><strong>{project.name}</strong><small>{project.description?.trim() || "No description added"}</small></div><div className="tf-project-avatars">{project.members.slice(0, 4).map((member) => <Avatar key={member.user.id} user={member.user} size="sm" />)}</div><span className={`tf-status-pill ${project.status.toLowerCase()}`}>{statusLabel(project.status)}</span><small className="tf-project-date">Updated {formatDate(project.updatedAt)}</small></article>)}</div>}
              </section>
            )}

            {view === "tasks" && (
              <section className="tf-panel tf-full-panel">
                <div className="tf-panel-heading">
                  <div><h2>{taskScope === "PROJECT" ? "Project tasks" : "My tasks"}</h2><p>{taskScope === "PROJECT" ? "All tasks in projects you belong to, including work assigned to teammates." : "Only tasks assigned directly to your account."}</p></div>
                  <span className="tf-count-pill">{taskScope === "PROJECT" ? projectTasks.length : tasks.length} tasks</span>
                </div>

                <div className="tf-task-scope-tabs" role="tablist" aria-label="Task scope">
                  <button role="tab" aria-selected={taskScope === "PROJECT"} className={taskScope === "PROJECT" ? "active" : ""} onClick={() => { setTaskScope("PROJECT"); setTaskProjectFilter("ALL"); setTaskFilter("ALL"); }}>
                    <Users size={14} /> Project tasks <span>{projectTasks.length}</span>
                  </button>
                  <button role="tab" aria-selected={taskScope === "MINE"} className={taskScope === "MINE" ? "active" : ""} onClick={() => { setTaskScope("MINE"); setTaskFilter("ALL"); }}>
                    <CheckCircle2 size={14} /> Assigned to me <span>{tasks.length}</span>
                  </button>
                </div>

                <div className="tf-filter-row">
                  <span><SlidersHorizontal size={14} /> Filter</span>
                  {taskScope === "PROJECT" && (
                    <label className="tf-project-task-filter">
                      <span>Project</span>
                      <select value={taskProjectFilter} onChange={(event) => setTaskProjectFilter(event.target.value)}>
                        <option value="ALL">All projects</option>
                        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                    </label>
                  )}
                  {(["ALL", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] as TaskFilter[]).map((filter) => (
                    <button key={filter} className={taskFilter === filter ? "active" : ""} onClick={() => setTaskFilter(filter)}>
                      {filter === "ALL" ? "All statuses" : statusLabel(filter)}
                    </button>
                  ))}
                </div>

                {taskScope === "PROJECT" ? (
                  filteredProjectTasks.length === 0 ? (
                    <div className="tf-empty-state"><span className="tf-empty-icon"><ListTodo size={20} /></span><strong>No project tasks in this view</strong><p>Tasks created in your projects will appear here for the whole team to follow.</p></div>
                  ) : (
                    <div className="tf-task-list">
                      {filteredProjectTasks.map((task) => (
                        <article className="tf-task-row" key={task.id}>
                          <span className={`tf-priority-dot ${task.priority.toLowerCase()}`} />
                          <div className="tf-task-copy">
                            <strong>{task.title}</strong>
                            <small>{task.project.name} · {task.assignedTo ? `Assigned to ${task.assignedTo.name}` : "Unassigned"} · Created by {task.createdBy.name}</small>
                          </div>
                          <span className={`tf-status-pill task-${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span>
                          <span className={`tf-priority-label ${task.priority.toLowerCase()}`}>{priorityLabel(task.priority)}</span>
                          <span className="tf-task-due">{task.dueDate ? <><CalendarDays size={13} /> {formatDate(task.dueDate)}</> : "No due date"}</span>
                          {task.status !== "COMPLETED" && canCompleteProjectTask(task) && (
                            <button className="tf-complete-button" onClick={() => void handleCompleteTask(task.id)} disabled={completingTaskId === task.id}>
                              {completingTaskId === task.id ? "Saving…" : <><Check size={13} /> Complete</>}
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  )
                ) : (
                  filteredMyTasks.length === 0 ? (
                    <div className="tf-empty-state"><span className="tf-empty-icon"><CheckCircle2 size={20} /></span><strong>No tasks assigned to you in this view</strong><p>Tasks assigned to your account will appear here. You can still see all team work under Project tasks.</p></div>
                  ) : (
                    <div className="tf-task-list">
                      {filteredMyTasks.map((task) => (
                        <article className="tf-task-row" key={task.id}>
                          <span className={`tf-priority-dot ${task.priority.toLowerCase()}`} />
                          <div className="tf-task-copy"><strong>{task.title}</strong><small>{task.project.name}</small></div>
                          <span className={`tf-status-pill task-${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span>
                          <span className={`tf-priority-label ${task.priority.toLowerCase()}`}>{priorityLabel(task.priority)}</span>
                          <span className="tf-task-due">{task.dueDate ? <><CalendarDays size={13} /> {formatDate(task.dueDate)}</> : "No due date"}</span>
                          {task.status !== "COMPLETED" && <button className="tf-complete-button" onClick={() => void handleCompleteTask(task.id)} disabled={completingTaskId === task.id}>{completingTaskId === task.id ? "Saving…" : <><Check size={13} /> Complete</>}</button>}
                        </article>
                      ))}
                    </div>
                  )
                )}
              </section>
            )}

            {view === "activity" && (
              <section className="tf-panel tf-full-panel">
                <div className="tf-panel-heading"><div><h2>Recent activity</h2><p>Latest 10 updates returned by your dashboard activity endpoint</p></div><span className="tf-count-pill">{activities.length} updates</span></div>
                {activities.length === 0 ? <div className="tf-empty-state"><span className="tf-empty-icon"><Activity size={20} /></span><strong>No activity yet</strong><p>Updates from your projects will appear here.</p></div> : <div className="tf-activity-list">{activities.map((item) => <article className="tf-activity-row" key={item.id}><Avatar user={item.actor || { name: "TaskFlow member", avatarUrl: null }} /><div className="tf-activity-copy"><strong>{item.actor?.name || "A team member"} <span>{readableAction(item.action)}</span></strong><small>in <b>{item.project.name}</b></small></div><time>{timeAgo(item.createdAt)}</time></article>)}</div>}
              </section>
            )}

            {view === "members" && (
              <section className="tf-panel tf-full-panel">
                <div className="tf-panel-heading"><div><h2>People in your workspace</h2><p>Unique teammates across your projects</p></div><span className="tf-count-pill">{collaborators.length} people</span></div>
                {collaborators.length === 0 ? <div className="tf-empty-state"><span className="tf-empty-icon"><Users size={20} /></span><strong>No collaborators yet</strong><p>People become visible here when they join one of your projects.</p></div> : <div className="tf-member-grid">{collaborators.map((person) => <article className="tf-member-card" key={person.user.id}><Avatar user={person.user} size="lg" /><div><strong>{person.user.name}</strong><small>{person.user.email}</small></div><span>{person.projectNames.size} {person.projectNames.size === 1 ? "project" : "projects"}</span></article>)}</div>}
              </section>
            )}

            {view === "notifications" && (
              <section className="tf-panel tf-full-panel">
                <div className="tf-panel-heading"><div><h2>Notifications</h2><p>Your latest updates from TaskFlow</p></div>{unreadNotifications > 0 && <button className="tf-secondary-button tf-small-button" onClick={() => void handleMarkAllRead()}>Mark all read</button>}</div>
                {notifications.length === 0 ? <div className="tf-empty-state"><span className="tf-empty-icon"><Bell size={20} /></span><strong>You’re all caught up</strong><p>New notifications will appear here.</p></div> : <div className="tf-notification-list">{notifications.map((notification) => <article className={`tf-notification-row ${notification.readAt ? "is-read" : "is-unread"}`} key={notification.id}><span className="tf-notification-indicator" /><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{timeAgo(notification.createdAt)}</small></div>{!notification.readAt && <button className="tf-mark-read" onClick={() => void handleMarkRead(notification.id)}>Mark read</button>}</article>)}</div>}
              </section>
            )}

            {view === "invitations" && (
              <section className="tf-panel tf-full-panel">
                <div className="tf-panel-heading"><div><h2>Project invitations</h2><p>Invitations addressed to your account</p></div><span className="tf-count-pill">{invitations.length} pending</span></div>
                {invitations.length === 0 ? <div className="tf-empty-state"><span className="tf-empty-icon"><Mail size={20} /></span><strong>No pending invitations</strong><p>You’ll see new project invitations here.</p></div> : <div className="tf-invitation-list">{invitations.map((invitation) => <article className="tf-invitation-row" key={invitation.id}><span className="tf-project-mark"><FolderKanban size={16} /></span><div className="tf-invitation-copy"><strong>{invitation.project.name}</strong><small>Invited by {invitation.invitedBy.name} · expires {formatDate(invitation.expiresAt)}</small></div><div className="tf-invitation-actions"><button className="tf-secondary-button tf-small-button" onClick={() => void handleInvitation(invitation.id, "decline")} disabled={invitationActionId === invitation.id}>Decline</button><button className="tf-primary-button tf-small-button" onClick={() => void handleInvitation(invitation.id, "accept")} disabled={invitationActionId === invitation.id}>{invitationActionId === invitation.id ? "Saving…" : "Accept"}</button></div></article>)}</div>}
              </section>
            )}

            <footer className="tf-footer"><span>© {new Date().getFullYear()} TaskFlow</span><span>Make teamwork feel effortless.</span><button onClick={() => void handleLogout()} disabled={loggingOut}><LogOut size={14} /> {loggingOut ? "Signing out…" : "Sign out"}</button></footer>
          </div>
        </div>
      </div>


      {showCreateTask && (
        <div className="tf-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateTask(); }}>
          <form className="tf-create-modal tf-task-modal" onSubmit={handleCreateTask}>
            <div className="tf-modal-header">
              <div>
                <span className="tf-modal-icon"><ListTodo size={17} /></span>
                <div><h2>Create a task</h2><p>Add a clear next step to one of your project workspaces.</p></div>
              </div>
              <button type="button" className="tf-modal-close" aria-label="Close" onClick={closeCreateTask}><X size={18} /></button>
            </div>

            {taskCreationProjects.length === 0 ? (
              <div className="tf-task-no-project">
                <span className="tf-empty-icon"><FolderKanban size={20} /></span>
                <strong>No project where you can create tasks</strong>
                <p>Only project owners and admins can create tasks. Ask an owner to promote your role, or choose a project where you already have admin access.</p>
              </div>
            ) : (
              <>
                <div className="tf-task-fields-grid">
                  <div className="tf-task-field tf-task-field-wide">
                    <label htmlFor="task-project">Project <span>Required</span></label>
                    <select
                      id="task-project"
                      value={taskProjectId}
                      onChange={(event) => {
                        setTaskProjectId(event.target.value);
                        setTaskAssigneeId(user?.id || "");
                      }}
                      required
                    >
                      <option value="">Select an existing project</option>
                      {taskCreationProjects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                    <small className="tf-task-field-hint">Choose where this task belongs. Completed and archived projects are not available.</small>
                  </div>

                  <div className="tf-task-field">
                    <label htmlFor="task-title">Task title <span>Required</span></label>
                    <input
                      id="task-title"
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      placeholder="e.g. Design the onboarding flow"
                      maxLength={160}
                      autoFocus
                      required
                    />
                    <small className="tf-task-field-hint">{taskTitle.trim().length}/160 characters</small>
                  </div>

                  <div className="tf-task-field">
                    <label htmlFor="task-priority">Priority</label>
                    <select id="task-priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task["priority"])}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <small className="tf-task-field-hint">Set the urgency for your team.</small>
                  </div>

                  <div className="tf-task-field">
                    <label htmlFor="task-assignee">Assign to</label>
                    <select id="task-assignee" value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)}>
                      <option value="">Unassigned</option>
                      {(selectedTaskProject?.members || []).map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.name}{member.user.id === user?.id ? " (you)" : ""} · {member.role.toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <small className="tf-task-field-hint">Only members of the selected project can be assigned.</small>
                  </div>

                  <div className="tf-task-field">
                    <label htmlFor="task-due-date">Due date <span>Optional</span></label>
                    <input id="task-due-date" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
                    <small className="tf-task-field-hint">You can leave this blank.</small>
                  </div>

                  <div className="tf-task-field tf-task-field-wide">
                    <label htmlFor="task-description">Description <span>Optional</span></label>
                    <textarea id="task-description" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Add context, acceptance criteria or useful notes…" rows={3} />
                  </div>
                </div>
                <p className="tf-task-start-status"><CheckCircle2 size={14} /> New tasks start with <strong>To do</strong>. Assigning it to yourself adds it to your My tasks list.</p>
              </>
            )}

            {taskFormError && <p className="tf-form-error"><AlertCircle size={14} /> {taskFormError}</p>}
            <div className="tf-modal-actions">
              <button type="button" className="tf-secondary-button" onClick={closeCreateTask} disabled={creatingTask}>Cancel</button>
              {taskCreationProjects.length > 0 && <button type="submit" className="tf-primary-button" disabled={creatingTask || !taskProjectId}>{creatingTask ? "Creating…" : <><Plus size={15} /> Create task</>}</button>}
            </div>
          </form>
        </div>
      )}

      {showCreateProject && (
        <div className="tf-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateModal(); }}>
          <form className="tf-create-modal" onSubmit={handleCreateProject}>
            <div className="tf-modal-header"><div><span className="tf-modal-icon"><Plus size={17} /></span><div><h2>Create a project</h2><p>Give your team a place to organize work.</p></div></div><button type="button" className="tf-modal-close" aria-label="Close" onClick={closeCreateModal}><X size={18} /></button></div>
            <label htmlFor="project-name">Project name</label>
            <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Website redesign" maxLength={120} autoFocus />
            <label htmlFor="project-description">Description <span>Optional</span></label>
            <textarea id="project-description" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What is this project about?" rows={3} />
            {projectFormError && <p className="tf-form-error"><AlertCircle size={14} /> {projectFormError}</p>}
            <div className="tf-modal-actions"><button type="button" className="tf-secondary-button" onClick={closeCreateModal} disabled={creatingProject}>Cancel</button><button type="submit" className="tf-primary-button" disabled={creatingProject}>{creatingProject ? "Creating…" : <><Plus size={15} /> Create project</>}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
