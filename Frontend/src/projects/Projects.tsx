import { useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock3,
  FolderKanban, ListTodo, Pencil, Plus, ShieldCheck, Trash2, Users, X,
} from "lucide-react";
import "./Projects.css";

export interface User { id: string; name: string; email: string; avatarUrl: string | null; }
export interface ProjectMember { role: "OWNER" | "ADMIN" | "MEMBER"; user: User; }
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  updatedAt: string;
  members: ProjectMember[];
}
export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: User | null;
  project: { id: string; name: string; status: string };
}
export interface ProjectUpdatePayload { name: string; description: string; }

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}
export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Active", COMPLETED: "Completed", ARCHIVED: "Archived",
    TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review",
  };
  return labels[status] || status.replaceAll("_", " ");
}
function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}
export function Avatar({ user, size = "md" }: { user: Pick<User, "name" | "avatarUrl">; size?: "sm" | "md" | "lg" }) {
  return <span className={`tf-avatar tf-avatar-${size}`} title={user.name}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user.name)}</span>;
}

interface ProjectsProps {
  projects: Project[];
  currentUserId: string;
  onCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  onUpdateProject: (projectId: string, payload: ProjectUpdatePayload) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export default function Projects({ projects, currentUserId, onCreateProject, onSelectProject, onUpdateProject, onDeleteProject }: ProjectsProps) {
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleteStep, setDeleteStep] = useState<"name" | "confirm">("name");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const startEditing = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditError("");
  };
  const closeEditing = () => {
    if (savingProject) return;
    setEditingProject(null);
    setEditError("");
  };
  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProject) return;
    if (!editName.trim()) { setEditError("Project name is required."); return; }
    if (editName.trim().length > 120) { setEditError("Project name cannot exceed 120 characters."); return; }
    setSavingProject(true);
    setEditError("");
    try {
      await onUpdateProject(editingProject.id, { name: editName.trim(), description: editDescription.trim() });
      setEditingProject(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not update this project.");
    } finally {
      setSavingProject(false);
    }
  };
  const startDeleting = (project: Project) => {
    setDeletingProject(project);
    setDeleteName("");
    setDeleteStep("name");
    setDeleteError("");
  };
  const closeDeleting = () => {
    if (deleting) return;
    setDeletingProject(null);
    setDeleteName("");
    setDeleteStep("name");
    setDeleteError("");
  };
  const confirmDelete = async () => {
    if (!deletingProject || deleteStep !== "confirm") return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteProject(deletingProject.id);
      setDeletingProject(null);
      setDeleteName("");
      setDeleteStep("name");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="tf-panel tf-full-panel">
        <div className="tf-panel-heading">
          <div><h2>All projects</h2><p>{projects.length} project{projects.length === 1 ? "" : "s"} you belong to</p></div>
          <button className="tf-primary-button tf-small-button" onClick={onCreateProject}><Plus size={14} /> New project</button>
        </div>
        {projects.length === 0 ? (
          <div className="tf-empty-state"><strong>No projects yet</strong><p>Create your first project to get started.</p></div>
        ) : (
          <div className="tf-project-list tf-project-list-expanded">
            {projects.map((project) => {
              const membership = project.members.find((member) => member.user.id === currentUserId);
              const canManage = membership?.role === "OWNER" || membership?.role === "ADMIN";
              const canDelete = membership?.role === "OWNER";
              return (
                <article className="tf-project-row" key={project.id}>
                  <button className="tf-project-row-open" type="button" onClick={() => onSelectProject(project.id)} aria-label={`Open project ${project.name}`}>
                    <span className="tf-project-mark"><FolderKanban size={16} /></span>
                    <span className="tf-project-copy"><strong>{project.name}</strong><small>{project.description?.trim() || "No description added"}</small></span>
                    <span className="tf-project-avatars">
                      {project.members.slice(0, 4).map((member) => <Avatar key={member.user.id} user={member.user} size="sm" />)}
                      {project.members.length > 4 && <span className="tf-avatar tf-avatar-sm tf-avatar-extra">+{project.members.length - 4}</span>}
                    </span>
                    <span className={`tf-status-pill ${project.status.toLowerCase()}`}>{statusLabel(project.status)}</span>
                    <small className="tf-project-date">Updated {formatDate(project.updatedAt)}</small>
                    <ArrowRight size={15} className="tf-project-open-arrow" />
                  </button>
                  {(canManage || canDelete) && (
                    <div className="tf-project-row-actions" aria-label={`Actions for ${project.name}`}>
                      {canManage && <button type="button" onClick={() => startEditing(project)} aria-label={`Edit ${project.name}`} title="Edit project"><Pencil size={14} /></button>}
                      {canDelete && <button type="button" className="danger" onClick={() => startDeleting(project)} aria-label={`Delete ${project.name}`} title="Delete project"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editingProject && (
        <div className="tf-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditing(); }}>
          <form className="tf-create-modal tf-project-modal" onSubmit={submitEdit}>
            <div className="tf-modal-header">
              <div><span className="tf-modal-icon"><Pencil size={17} /></span><div><h2>Edit project</h2><p>Update the project name and description.</p></div></div>
              <button type="button" className="tf-modal-close" aria-label="Close" onClick={closeEditing}><X size={18} /></button>
            </div>
            <label htmlFor="edit-project-name">Project name</label>
            <input id="edit-project-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} required autoFocus />
            <label htmlFor="edit-project-description">Description <span>Optional</span></label>
            <textarea id="edit-project-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={4} placeholder="What is this project about?" />
            {editError && <p className="tf-form-error"><AlertTriangle size={14} /> {editError}</p>}
            <div className="tf-modal-actions">
              <button type="button" className="tf-secondary-button" onClick={closeEditing} disabled={savingProject}>Cancel</button>
              <button type="submit" className="tf-primary-button" disabled={savingProject}>{savingProject ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}

      {deletingProject && (
        <div className="tf-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleting(); }}>
          <section className="tf-create-modal tf-project-modal tf-delete-project-modal" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
            <div className="tf-modal-header">
              <div><span className="tf-modal-icon danger"><AlertTriangle size={17} /></span><div><h2 id="delete-project-title">Delete project</h2><p>This is a permanent action.</p></div></div>
              <button type="button" className="tf-modal-close" aria-label="Close" onClick={closeDeleting}><X size={18} /></button>
            </div>
            {deleteStep === "name" ? (
              <>
                <p className="tf-delete-project-copy">To continue, type the project name exactly as shown:<strong>{deletingProject.name}</strong></p>
                <label htmlFor="confirm-project-name">Project name confirmation</label>
                <input id="confirm-project-name" value={deleteName} onChange={(event) => setDeleteName(event.target.value)} placeholder="Type the project name" autoComplete="off" autoFocus />
                <div className="tf-delete-project-warning"><AlertTriangle size={15} /> You will not be able to undo this deletion.</div>
                {deleteError && <p className="tf-form-error"><AlertTriangle size={14} /> {deleteError}</p>}
                <div className="tf-modal-actions">
                  <button type="button" className="tf-secondary-button" onClick={closeDeleting}>Cancel</button>
                  <button type="button" className="tf-danger-button" disabled={deleteName.trim() !== deletingProject.name} onClick={() => { setDeleteStep("confirm"); setDeleteError(""); }}>Continue</button>
                </div>
              </>
            ) : (
              <>
                <p className="tf-delete-project-copy">You entered the correct name for <strong>{deletingProject.name}</strong>. Are you sure you want to permanently delete this project?</p>
                <div className="tf-delete-project-warning"><ShieldCheck size={15} /> Final confirmation required. This cannot be undone.</div>
                {deleteError && <p className="tf-form-error"><AlertTriangle size={14} /> {deleteError}</p>}
                <div className="tf-modal-actions">
                  <button type="button" className="tf-secondary-button" onClick={() => { setDeleteStep("name"); setDeleteError(""); }} disabled={deleting}>Go back</button>
                  <button type="button" className="tf-danger-button" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? "Deleting…" : "Delete project permanently"}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

interface ProjectWorkspaceProps {
  project: Project;
  tasks: ProjectTask[];
  currentUserId: string;
  canCreateTask: boolean;
  onBackToProjects: () => void;
  onCreateTask: () => void;
}
type WorkspaceTab = "overview" | "tasks" | "members";

export function ProjectWorkspace({ project, tasks, currentUserId, canCreateTask, onBackToProjects, onCreateTask }: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"ALL" | ProjectTask["status"]>("ALL");
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const toDo = tasks.filter((task) => task.status === "TODO").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const inReview = tasks.filter((task) => task.status === "IN_REVIEW").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const membership = project.members.find((member) => member.user.id === currentUserId);
  const visibleTasks = taskStatusFilter === "ALL" ? tasks : tasks.filter((task) => task.status === taskStatusFilter);

  const renderTaskRows = (items: ProjectTask[]) => items.length === 0 ? (
    <div className="tf-project-empty"><ListTodo size={18} /><strong>No tasks in this view</strong><span>Tasks added to this project will appear here.</span></div>
  ) : (
    <div className="tf-project-work-task-list">
      {items.map((task) => (
        <article className="tf-project-work-task-row" key={task.id}>
          <span className={`tf-priority-dot ${task.priority.toLowerCase()}`} />
          <div className="tf-project-work-task-copy"><strong>{task.title}</strong><small>{task.assignedTo ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}</small></div>
          <span className={`tf-status-pill task-${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span>
          <span className={`tf-project-work-priority ${task.priority.toLowerCase()}`}>{task.priority}</span>
          <small className="tf-project-work-due">{task.dueDate ? formatDate(task.dueDate) : "No due date"}</small>
        </article>
      ))}
    </div>
  );

  return (
    <div className="tf-project-workspace">
      <div className="tf-project-workspace-toolbar">
        <button className="tf-project-back-button" type="button" onClick={onBackToProjects}><ArrowLeft size={14} /> All projects</button>
        <div className="tf-project-workspace-identity">
          <span className={`tf-status-pill ${project.status.toLowerCase()}`}>{statusLabel(project.status)}</span>
          {membership && <span className="tf-project-role-pill"><ShieldCheck size={12} /> Your role: {membership.role.toLowerCase()}</span>}
          {canCreateTask && project.status === "ACTIVE" && <button className="tf-primary-button tf-small-button" type="button" onClick={onCreateTask}><Plus size={14} /> New task</button>}
        </div>
      </div>
      <div className="tf-project-workspace-tabs" role="tablist" aria-label="Project sections">
        <button type="button" role="tab" aria-selected={activeTab === "overview"} className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>Overview</button>
        <button type="button" role="tab" aria-selected={activeTab === "tasks"} className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>Tasks <span>{tasks.length}</span></button>
        <button type="button" role="tab" aria-selected={activeTab === "members"} className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")}>Members <span>{project.members.length}</span></button>
      </div>
      {activeTab === "overview" && (
        <>
          <div className="tf-project-work-metrics">
            <article className="tf-project-work-metric"><span><ListTodo size={16} /></span><small>Total tasks</small><strong>{tasks.length}</strong></article>
            <article className="tf-project-work-metric"><span><Clock3 size={16} /></span><small>To do</small><strong>{toDo}</strong></article>
            <article className="tf-project-work-metric"><span><Users size={16} /></span><small>In progress</small><strong>{inProgress}</strong></article>
            <article className="tf-project-work-metric"><span><CheckCircle2 size={16} /></span><small>Completed</small><strong>{completed}</strong></article>
          </div>
          <div className="tf-project-work-grid">
            <section className="tf-panel tf-project-progress-panel">
              <div className="tf-panel-heading"><div><h2>Project progress</h2><p>Completion across this project’s tasks</p></div><strong className="tf-project-progress-value">{progress}%</strong></div>
              <div className="tf-project-progress-track"><span style={{ width: `${progress}%` }} /></div>
              <div className="tf-project-progress-legend"><span>{completed} completed</span><span>{tasks.length - completed} remaining</span></div>
              <div className="tf-project-description"><small>ABOUT THIS PROJECT</small><p>{project.description?.trim() || "No project description has been added yet."}</p></div>
            </section>
            <section className="tf-panel tf-project-summary-panel">
              <div className="tf-panel-heading"><div><h2>Task status</h2><p>Current workload</p></div></div>
              <div className="tf-project-status-line"><span><i className="todo" /> To do</span><strong>{toDo}</strong></div>
              <div className="tf-project-status-line"><span><i className="progress" /> In progress</span><strong>{inProgress}</strong></div>
              <div className="tf-project-status-line"><span><i className="review" /> In review</span><strong>{inReview}</strong></div>
              <div className="tf-project-status-line"><span><i className="completed" /> Completed</span><strong>{completed}</strong></div>
            </section>
          </div>
          <section className="tf-panel tf-project-work-tasks-panel">
            <div className="tf-panel-heading"><div><h2>Project tasks</h2><p>Latest work in {project.name}</p></div><button className="tf-panel-link tf-project-view-all" type="button" onClick={() => setActiveTab("tasks")}>View all <ArrowRight size={14} /></button></div>
            {renderTaskRows(tasks.slice(0, 6))}
          </section>
        </>
      )}
      {activeTab === "tasks" && (
        <section className="tf-panel tf-project-work-tasks-panel">
          <div className="tf-panel-heading">
            <div><h2>Project tasks</h2><p>Every task shared with members of {project.name}</p></div>

          </div>
          <div className="tf-project-task-filters">
            {(["ALL", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] as const).map((status) => (
              <button key={status} type="button" className={taskStatusFilter === status ? "active" : ""} onClick={() => setTaskStatusFilter(status)}>{status === "ALL" ? "All" : statusLabel(status)}</button>
            ))}
          </div>
          {renderTaskRows(visibleTasks)}
        </section>
      )}
      {activeTab === "members" && (
        <section className="tf-panel tf-project-members-panel">
          <div className="tf-panel-heading"><div><h2>Project members</h2><p>People collaborating in this project</p></div><span className="tf-count-pill">{project.members.length} members</span></div>
          <div className="tf-project-member-list">
            {project.members.map((member) => (
              <article className="tf-project-member-row" key={member.user.id}>
                <Avatar user={member.user} size="md" />
                <div><strong>{member.user.name}{member.user.id === currentUserId ? " (you)" : ""}</strong><small>{member.user.email}</small></div>
                <span>{member.role.toLowerCase()}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
