import { useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import {
  AlertTriangle, ArrowRight, FolderKanban, Pencil, Plus, ShieldCheck, Trash2, X,
} from "lucide-react";
import { formatDate, statusLabel } from "./projectUtils";
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
  createdBy?: User;
  project: { id: string; name: string; status: string };
}
export interface ProjectUpdatePayload { name: string; description: string; }

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
  // Render project dialogs above the complete application shell, not inside
  // the content stacking context that sits below the topbar and side rail.
  const modalPortalTarget = typeof document === "undefined"
    ? null
    : document.querySelector(".tf-dashboard") ?? document.body;

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

      {editingProject && modalPortalTarget && createPortal(
        <div className="tf-modal-backdrop tf-project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditing(); }}>
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
        </div>,
        modalPortalTarget
      )}

      {deletingProject && modalPortalTarget && createPortal(
        <div className="tf-modal-backdrop tf-project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleting(); }}>
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
        </div>,
        modalPortalTarget
      )}
    </>
  );
}
