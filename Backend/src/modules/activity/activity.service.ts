import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../prisma";

export class ActivityServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "ActivityServiceError ";
  }
}

type CreateActivityInput = {
  projectId: string;
  actorId: string | null;
  action: string;
  entityType: "PROJECT" | "MEMBER" | "INVITATION" | "TASK" | "COMMENT";
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export const createActivity = async (input: CreateActivityInput) => {
  const activity = await prisma.activityLog.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ...(input.metadata != null && {
        metadata: input.metadata,
      }),
    },
  });

  return activity;
};

export const getProjectActivity = async (userId: string, projectId: string) => {
  console.log("ACTIVITY DEBUG:");
console.log("User ID:", userId);
console.log("Project ID:", projectId);
  const membership = await prisma.projectMember.findUnique({
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

  console.log("Membership:", membership);

  if (!membership) {
    throw new ActivityServiceError(
      "Project not found or you are not a member of this project",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  const activities = await prisma.activityLog.findMany({
    where: {
      projectId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,

    include: {
      actor: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return activities;
};
