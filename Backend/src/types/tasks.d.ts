import { TaskPriority, TaskStatus } from "../../../generated/prisma";

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assignedToId?: string | null;
}