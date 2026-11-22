import { prisma } from "../../prisma";
import { createActivity } from "../activity/activity.service";

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "AuthServiceError";
  }
}

interface CreateProjectInput {
  userId: string;
  name: string;
  description?: string;
}

interface UpdateProjectInput {
  userId: string;
  projectId: string;
  name?: string;
  description?: string | null;
}

export const CreateProject = async ({
  userId,
  name,
  description,
}: CreateProjectInput) => {
  const NormalizeName = name.trim();
  const NormalizeDescription = description?.trim() || null;

  if (!NormalizeName) {
    throw new AuthServiceError(
      "Project name is required",
      400,
      "PROJECT_NAME_REQUIRED",
    );
  }

  const project = await prisma.$transaction(
    async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: NormalizeName,
          description: NormalizeDescription,
          createdBy: {
            connect: {
              id: userId,
            },
          },
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: userId,
          role: "OWNER",
        },
      });

      return newProject;
    },
    {
      maxWait: 10000, // Wait up to 10 seconds to acquire a transaction
      timeout: 20000, // Allow up to 20 seconds to complete it
    },
  );

    await createActivity({
    projectId:project.id,
    actorId: userId,
    action: "PROJECT_CREATED",
    entityType: "PROJECT",
    entityId: project.id,
    metadata: {
      projectId: project.name,
    },
  });

  return project;
};

export const showPojects = async (userId: string) => {
  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return projects;
};

export const getProjectById = async (projectId: string, userId: string) => {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      members:{
        some:{
          userId: userId,
        }
      }
    },
    include: {
      members: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  return project;
};

export const updateProject = async ({userId,projectId,name,description}:UpdateProjectInput) => {
  const membership = await prisma.projectMember.findFirst({
    where:{
      userId: userId,
      projectId: projectId
    }
  })

  if (!membership) {
    throw new AuthServiceError(
      "Project not found",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  if (membership.role === "MEMBER") {
    throw new AuthServiceError(
      "You don't have permission to update this project",
      403,
      "PROJECT_UPDATE_FORBIDDEN",
    );
  }

  if (name !== undefined && !name.trim()) {
    throw new AuthServiceError(
      "Project name cannot be empty",
      400,
      "PROJECT_NAME_REQUIRED",
    );
  }

  const updateData = {
    ...(name !== undefined && { name: name.trim() }),

    ...(description !== undefined && {
      description: description?.trim() || null,
    }),
  };

  if (Object.keys(updateData).length === 0) {
    throw new AuthServiceError(
      "At least one field is required to update",
      400,
      "NO_UPDATE_DATA",
    );
  }

  const updatedProject = await prisma.project.update({
    where: {
      id: projectId,
    },
    data: updateData,
  });

    await createActivity({
  projectId:projectId,
  actorId: userId,
  action: "TASK_UPDATE_FORBIDDEN",
  entityType: "PROJECT",
  entityId: projectId,
  metadata: {
    taskTitle: updatedProject.name,
  },
});

  return updatedProject;
}

export const deleteProject = async (userId: string, projectId: string) => {
  const membership = await prisma.projectMember.findFirst({
    where:{
      userId,
      projectId
    }
  })

  if(!membership){
    throw new AuthServiceError(
      "Project not found",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  if(membership.role !== 'OWNER'){
    throw new AuthServiceError(
      "You don't have permission to delete this project",
      403,
      "PROJECT_DELETE_FORBIDDEN",
    );
  }

  const deletedProject = await prisma.project.delete({
    where:{
      id: projectId
    }
  })

    await createActivity({
  projectId: projectId,
  actorId: userId,
  action: "PROJECT_DELETE_FORBIDDEN",
  entityType: "PROJECT",
  entityId: projectId,
  metadata: {
    taskTitle: deletedProject.name,
  },
});

  return deletedProject;
}