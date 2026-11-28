import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock3,
  ListTodo,
  Mail,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Avatar,
  formatDate,
  statusLabel,
  type Project,
  type ProjectTask,
} from "../../projects/Projects";
import "../../projects/Projects.css";

interface ProjectWorkspaceActivity {
  id: string;
  action: string;
  createdAt: string;
  actor: { name: string } | null;
  project: { id: string; name: string };
}

interface ProjectDetailsPageProps {
  project: Project;
  tasks: ProjectTask[];
  currentUserId: string;
  canCreateTask: boolean;
  activities: ProjectWorkspaceActivity[];
  unreadNotifications: number;
  pendingInvitations: number;
  onBackToProjects: () => void;
  onCreateTask: () => void;
  onOpenActivity: () => void;
  onOpenNotifications: () => void;
  onOpenInvitations: () => void;
}

type DetailsTab = "overview" | "tasks" | "members";
type TaskStatusFilter = "ALL" | ProjectTask["status"];

export default function ProjectDetailsPage({
  project,
  tasks,
  currentUserId,
  canCreateTask,
  activities,
  unreadNotifications,
  pendingInvitations,
  onBackToProjects,
  onCreateTask,
  onOpenActivity,
  onOpenNotifications,
  onOpenInvitations,
}: ProjectDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("overview");
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>("ALL");

  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const toDo = tasks.filter((task) => task.status === "TODO").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const inReview = tasks.filter((task) => task.status === "IN_REVIEW").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const membership = project.members.find((member) => member.user.id === currentUserId);
  const visibleTasks = taskStatusFilter === "ALL"
    ? tasks
    : tasks.filter((task) => task.status === taskStatusFilter);

  const renderTaskRows = (items: ProjectTask[]) => items.length === 0 ? (
    <div className="tf-project-empty">
      <ListTodo size={18} />
      <strong>No tasks in this view</strong>
      <span>Tasks added to this project will appear here.</span>
    </div>
  ) : (
    <div className="tf-project-work-task-list">
      {items.map((task) => (
        <article className="tf-project-work-task-row" key={task.id}>
          <span className={`tf-priority-dot ${task.priority.toLowerCase()}`} />
          <div className="tf-project-work-task-copy">
            <strong>{task.title}</strong>
            <small>
              {task.assignedTo ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}
              {task.createdBy?.name ? ` · Created by ${task.createdBy.name}` : ""}
              {task.updatedAt ? ` · Updated ${formatDate(task.updatedAt)}` : ""}
            </small>
            {task.description?.trim() && (
              <p className="tf-project-work-task-description">{task.description}</p>
            )}
          </div>
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
        <button className="tf-project-back-button" type="button" onClick={onBackToProjects}>
          <ArrowLeft size={14} /> All projects
        </button>
        <div className="tf-project-workspace-identity">
          <span className={`tf-status-pill ${project.status.toLowerCase()}`}>{statusLabel(project.status)}</span>
          {membership && (
            <span className="tf-project-role-pill">
              <ShieldCheck size={12} /> Your role: {membership.role.toLowerCase()}
            </span>
          )}
          <span className="tf-project-role-pill">Updated {formatDate(project.updatedAt)}</span>
          {canCreateTask && project.status === "ACTIVE" && (
            <button className="tf-primary-button tf-small-button" type="button" onClick={onCreateTask}>
              <Plus size={14} /> New task
            </button>
          )}
        </div>
      </div>

      <div className="tf-project-workspace-tabs" role="tablist" aria-label="Project sections">
        <button type="button" role="tab" aria-selected={activeTab === "overview"} className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "tasks"} className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>
          Tasks <span>{tasks.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "members"} className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")}>
          Members <span>{project.members.length}</span>
        </button>
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
              <div className="tf-panel-heading">
                <div><h2>Project progress</h2><p>Completion across this project’s tasks</p></div>
                <strong className="tf-project-progress-value">{progress}%</strong>
              </div>
              <div className="tf-project-progress-track"><span style={{ width: `${progress}%` }} /></div>
              <div className="tf-project-progress-legend"><span>{completed} completed</span><span>{tasks.length - completed} remaining</span></div>
              <div className="tf-project-description">
                <small>ABOUT THIS PROJECT</small>
                <p>{project.description?.trim() || "No project description has been added yet."}</p>
              </div>
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
            <div className="tf-panel-heading">
              <div><h2>Project tasks</h2><p>Latest work in {project.name}</p></div>
              <button className="tf-panel-link tf-project-view-all" type="button" onClick={() => setActiveTab("tasks")}>
                View all <ArrowRight size={14} />
              </button>
            </div>
            {renderTaskRows(tasks.slice(0, 6))}
          </section>

          <div className="tf-project-global-panels">
            <section className="tf-panel tf-project-global-activity">
              <div className="tf-panel-heading">
                <div><h2>Workspace activity</h2><p>Latest updates across all your projects</p></div>
                <button className="tf-panel-icon-button" type="button" onClick={onOpenActivity} aria-label="Open all workspace activity">
                  <ArrowRight size={15} />
                </button>
              </div>
              {activities.length === 0 ? (
                <div className="tf-project-global-empty">No recent workspace activity yet.</div>
              ) : (
                <div className="tf-project-global-activity-list">
                  {activities.slice(0, 4).map((activity) => (
                    <article className="tf-project-global-activity-row" key={activity.id}>
                      <span className="tf-project-global-activity-dot" />
                      <div>
                        <strong>{activity.actor?.name || "A teammate"} {activity.action.toLowerCase().replaceAll("_", " ")}</strong>
                        <small>{activity.project.name} · {formatDate(activity.createdAt)}</small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <button className="tf-panel-link" type="button" onClick={onOpenActivity}>
                View all workspace activity <ArrowRight size={14} />
              </button>
            </section>

            <section className="tf-panel tf-project-global-inbox">
              <div className="tf-panel-heading"><div><h2>Workspace inbox</h2><p>Updates from every project you belong to</p></div></div>
              <button className="tf-project-global-inbox-row" type="button" onClick={onOpenNotifications}>
                <span className="tf-project-global-inbox-icon"><Bell size={15} /></span>
                <span><strong>Notifications</strong><small>Unread workspace updates</small></span>
                <b>{unreadNotifications}</b>
                <ArrowRight size={14} />
              </button>
              <button className="tf-project-global-inbox-row" type="button" onClick={onOpenInvitations}>
                <span className="tf-project-global-inbox-icon"><Mail size={15} /></span>
                <span><strong>Project invitations</strong><small>Invitations across your workspace</small></span>
                <b>{pendingInvitations}</b>
                <ArrowRight size={14} />
              </button>
              <p className="tf-project-global-inbox-note">These are workspace-wide, not limited to {project.name}.</p>
            </section>
          </div>
        </>
      )}

      {activeTab === "tasks" && (
        <section className="tf-panel tf-project-work-tasks-panel">
          <div className="tf-panel-heading">
            <div><h2>Project tasks</h2><p>Every task shared with members of {project.name}</p></div>
          </div>
          <div className="tf-project-task-filters">
            {(["ALL", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] as const).map((status) => (
              <button key={status} type="button" className={taskStatusFilter === status ? "active" : ""} onClick={() => setTaskStatusFilter(status)}>
                {status === "ALL" ? "All" : statusLabel(status)}
              </button>
            ))}
          </div>
          {renderTaskRows(visibleTasks)}
        </section>
      )}

      {activeTab === "members" && (
        <section className="tf-panel tf-project-members-panel">
          <div className="tf-panel-heading">
            <div><h2>Project members</h2><p>People collaborating in this project</p></div>
            <span className="tf-count-pill">{project.members.length} members</span>
          </div>
          {project.members.length === 0 ? (
            <div className="tf-project-empty"><Users size={18} /><strong>No members yet</strong><span>Members added to this project will appear here.</span></div>
          ) : (
            <div className="tf-project-member-list">
              {project.members.map((member) => (
                <article className="tf-project-member-row" key={member.user.id}>
                  <Avatar user={member.user} size="md" />
                  <div>
                    <strong>{member.user.name}{member.user.id === currentUserId ? " (you)" : ""}</strong>
                    <small>{member.user.email}</small>
                  </div>
                  <span>{member.role.toLowerCase()}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
