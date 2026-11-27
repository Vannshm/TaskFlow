import { FolderKanban, Plus } from "lucide-react";
import "./Projects.css";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProjectMember {
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: User;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  updatedAt: string;
  members: ProjectMember[];
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function statusLabel(status: string) {
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

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
}

export function Avatar({ user, size = "md" }: { user: Pick<User, "name" | "avatarUrl">; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`tf-avatar tf-avatar-${size}`} title={user.name}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user.name)}
    </span>
  );
}

interface ProjectsProps {
  projects: Project[];
  onCreateProject: () => void;
}

export default function Projects({ projects, onCreateProject }: ProjectsProps) {
  return (
    <section className="tf-panel tf-full-panel">
      <div className="tf-panel-heading">
        <div>
          <h2>All projects</h2>
          <p>{projects.length} project{projects.length === 1 ? "" : "s"} you belong to</p>
        </div>
        <button className="tf-primary-button tf-small-button" onClick={onCreateProject}>
          <Plus size={14} /> New project
        </button>
      </div>
      {projects.length === 0 ? (
        <div className="tf-empty-state">
          <strong>No projects yet</strong>
          <p>Create your first project to get started.</p>
        </div>
      ) : (
        <div className="tf-project-list tf-project-list-expanded">
          {projects.map((project) => (
            <article className="tf-project-row" key={project.id}>
              <span className="tf-project-mark"><FolderKanban size={16} /></span>
              <div className="tf-project-copy">
                <strong>{project.name}</strong>
                <small>{project.description?.trim() || "No description added"}</small>
              </div>
              <div className="tf-project-avatars">
                {project.members.slice(0, 4).map((member) => (
                  <Avatar key={member.user.id} user={member.user} size="sm" />
                ))}
              </div>
              <span className={`tf-status-pill ${project.status.toLowerCase()}`}>
                {statusLabel(project.status)}
              </span>
              <small className="tf-project-date">Updated {formatDate(project.updatedAt)}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
