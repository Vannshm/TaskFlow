import test from "node:test";
import {
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { createActivity } from "../activity/activity.service";

export class TaskServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "TaskServiceError ";
  }
}

type CreateTaskInput = {
  title: string;
  description?: string | null;
  assignedToId?: string | null;
  priority?: TaskPriority;
  dueDate?: Date | null;
};

type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assignedToId?: string | null;
};

export const createTask = async (
  userId: string,
  projectId: string,
  input: CreateTaskInput,
) => {
  const { title, description, assignedToId, priority, dueDate } = input;

  const normalisedTitle = title.trim();

  if (!normalisedTitle) {
    throw new TaskServiceError("Task title is required", 400, "TITLE_REQUIRED");
  }

  if (normalisedTitle.length > 160) {
    throw new TaskServiceError(
      "Task title cannot exceed 160 characters",
      400,
      "TITLE_TOO_LONG",
    );
  }

  if (dueDate && Number.isNaN(dueDate.getTime())) {
    throw new TaskServiceError("Invalid due date", 400, "INVALID_DUE_DATE");
  }

  const currectUser = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: {
      role: true,
      project: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!currectUser) {
    throw new TaskServiceError(
      "Project not found or you are not a member of this project",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  if (currectUser.project.status !== ProjectStatus.ACTIVE) {
    throw new TaskServiceError(
      "Cannot create tasks in an inactive project",
      409,
      "PROJECT_NOT_ACTIVE",
    );
  }

  const normalisedAssigneeId = assignedToId?.trim() || null;

  if (normalisedAssigneeId) {
    const assignee = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: normalisedAssigneeId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!assignee) {
      throw new TaskServiceError(
        "Assigned user is not a member of this project",
        400,
        "ASSIGNEE_NOT_PROJECT_MEMBER",
      );
    }
  }

  const lastTask = await prisma.task.aggregate({
    where: {
      projectId,
    },
    _max: {
      position: true,
    },
  });

  const nextPosition = (lastTask._max.position ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      title: normalisedTitle,
      description: description?.trim() || null,
      projectId,
      createdById: userId,
      assignedToId: normalisedAssigneeId,
      priority: priority ?? TaskPriority.MEDIUM,
      dueDate: dueDate ?? null,
      position: nextPosition,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      position: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  await createActivity({
  projectId: task.project.id,
  actorId: userId,
  action: "TASK_CREATED",
  entityType: "TASK",
  entityId: task.id,
  metadata: {
    taskTitle: task.title,
    assignedTo: task.assignedTo?.name ?? null,
  },
});

  return task;
};

export const getProjectTasks = async (userId: string, projectId: string) => {
  const currectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!currectMember) {
    throw new TaskServiceError(
      "Project not found or you are not a member of this project",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
    },
    orderBy: [
      {
        position: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      position: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  return tasks;
};

export const getTasks = async (userId: string) => {
  const task = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      project: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    orderBy: [
      {
        dueDate: {
          sort: "asc",
          nulls: "last",
        },
      },
      {
        createdAt: "desc",
      },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      position: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  return task;
};

export const getTaskById = async (userId: string, taskId: string) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      position: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  return task;
};

export const updateTask = async (
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Find the task only if the user belongs to its project.
    const task = await tx.task.findFirst({
      where: {
        id: taskId,
        project: {
          members: {
            some: { userId },
          },
        },
      },
      select: {
        id: true,
        projectId: true,
        createdById: true,
        assignedToId: true,

        project: {
          select: {
            members: {
              where: { userId },
              select: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new TaskServiceError(
        "Task not found or you don't have access to it",
        404,
        "TASK_NOT_FOUND",
      );
    }

    // 2. Determine the user's permissions.
    const membership = task.project.members[0];

    if (!membership) {
      throw new TaskServiceError(
        "You are not a member of this project",
        403,
        "PROJECT_ACCESS_DENIED",
      );
    }

    const isCreator = task.createdById === userId;

    const isOwnerOrAdmin =
      membership.role === "OWNER" || membership.role === "ADMIN";

    const isAssignee = task.assignedToId === userId;

    // Creator, project owner and admin have full update access.
    const canFullyUpdate = isCreator || isOwnerOrAdmin;

    // 3. If the user doesn't have full access,
    // check whether they are allowed to complete the task.
    if (!canFullyUpdate) {
      const inputFields = Object.keys(input);

      const canCompleteTask =
        isAssignee && inputFields.length === 1 && input.status === "COMPLETED";

      if (!canCompleteTask) {
        throw new TaskServiceError(
          "You don't have permission to update this task",
          403,
          "TASK_UPDATE_FORBIDDEN",
        );
      }
    }

    // 4. Validate the new assignee if one is provided.
    if (canFullyUpdate && input.assignedToId) {
      const assignee = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: task.projectId,
            userId: input.assignedToId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!assignee) {
        throw new TaskServiceError(
          "Assignee must be a member of this project",
          400,
          "INVALID_ASSIGNEE",
        );
      }
    }

    // 5. Prepare the update data.
    const data: Prisma.TaskUncheckedUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title.trim();
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.priority !== undefined) {
      data.priority = input.priority;
    }

    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate;
    }

    if (input.assignedToId !== undefined) {
      data.assignedToId = input.assignedToId;
    }

    // 6. Update and return the task.
    const updatedTask = await tx.task.update({
      where: {
        id: taskId,
      },
      data,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        position: true,
        createdAt: true,
        updatedAt: true,

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },

        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

      await createActivity({
  projectId: task.projectId,
  actorId: userId,
  action: "TASK_UPDATE_FORBIDDEN",
  entityType: "TASK",
  entityId: task.id,
  metadata: {
    taskTitle: input.title,
    assignedTo: input.assignedToId ?? null,
  },
});

    return updatedTask
  },{
    maxWait:10000,
    timeout:20000
  });
};

export const deleteTask = async (userId: string, taskId: string) => {
  return await prisma.$transaction( async (tx) => {

    const task = await tx.task.findFirst({
      where:{
        id: taskId,
        project:{
          members:{
            some:{
              userId
            }
          }
        }
      },
      select:{
        id: true,
        title: true,
        createdById: true,

        project:{
          select:{
            id: true,
            members:{
              where:{
                userId
              },
              select:{
                role: true
              }
            }
          }
        }
      }
    })

    if(!task){
       throw new TaskServiceError(
        "Task not found or you don't have access to it",
        404,
        "TASK_NOT_FOUND"
      );
    }
    

    const membership = task.project.members[0];

    if(!membership){
      throw new TaskServiceError(
        "You are not a member of this project",
        403,
        "PROJECT_ACCESS_DENIED"
      );
    }

    const isCreator = task.createdById === userId;

    const isOwnerOrAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN'

    const canDelete = isCreator || isOwnerOrAdmin

    if(!canDelete){
       throw new TaskServiceError(
        "You don't have permission to delete this task",
        403,
        "TASK_DELETE_FORBIDDEN"
      );
    }

    const del = await tx.task.delete({
      where:{
        id: taskId
      },
      select:{
        id: true,
        title: true,
        description: true,
        projectId: true
      }
    })

      await createActivity({
  projectId: task.project.id,
  actorId: userId,
  action: "TASK_DELETE_FORBIDDEN",
  entityType: "TASK",
  entityId: task.id,
  metadata: {
    taskTitle: task.title
  },
});

    return del

  },{
    maxWait:10000,
    timeout:20000
  } )
}