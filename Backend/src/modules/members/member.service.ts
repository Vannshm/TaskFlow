import { ProjectRole } from "../../../generated/prisma/enums";
import { prisma } from "../../prisma";
import { createActivity } from "../activity/activity.service";

export class MembersServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "MembersServiceError";
  }
}

export const getMembers = async (userId: string, projectId: string) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,

      members: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          id: true,
          role: true,
          joinedAt: true,

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

  if (!project) {
    throw new MembersServiceError(
      "Project not found or you are not a member of this project",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  return project.members;
};

export const updateMember = async (
  userId: string,
  projectId: string,
  memberId: string,
  role: ProjectRole,
) => {
  return await prisma.$transaction(async (tx) => {

    // Check whether the current user belongs to this project.
    const currentUser = await tx.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!currentUser) {
      throw new MembersServiceError(
        "Project not found or you are not a member of this project",
        404,
        "PROJECT_NOT_FOUND",
      );
    }

    // Only the project owner can update member roles.
    if (currentUser.role !== ProjectRole.OWNER) {
      throw new MembersServiceError(
        "Only the project owner can update member roles",
        403,
        "NOT_ALLOWED_TO_UPDATE_ROLE",
      );
    }

    // Ownership transfer must be handled separately.
    if (role === ProjectRole.OWNER) {
      throw new MembersServiceError(
        "Ownership cannot be transferred through this endpoint",
        400,
        "INVALID_ROLE",
      );
    }

    // Find the target member.
    const targetUser = await tx.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId,
        },
      },
    });

    if (!targetUser) {
      throw new MembersServiceError(
        "Member not found in this project",
        404,
        "MEMBER_NOT_FOUND",
      );
    }

    // Prevent changing the owner's role.
    if (targetUser.role === ProjectRole.OWNER) {
      throw new MembersServiceError(
        "You cannot change the owner's role",
        403,
        "CANNOT_UPDATE_OWNER",
      );
    }

    // Update the member's role.
    const updatedUser = await tx.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId,
        },
      },
      data: {
        role,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Record the activity in the same transaction.
    await tx.activityLog.create({
      data: {
        projectId,
        actorId: userId,
        action: "MEMBER_ROLE_UPDATED",
        entityType: "MEMBER",
        entityId: updatedUser.id,
        metadata: {
          memberId,
          oldRole: targetUser.role,
          newRole: updatedUser.role,
        },
      },
    });

    return updatedUser;
  });
};

export const deleteMember = async (
  userId: string,
  projectId: string,
  memberId: string,
) => {
  return await prisma.$transaction(async (tx) => {

    // Check whether the current user belongs to this project.
    const currentUser = await tx.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!currentUser) {
      throw new MembersServiceError(
        "Project not found or you are not a member of this project",
        404,
        "PROJECT_NOT_FOUND",
      );
    }

    // Only the owner can remove project members.
    if (currentUser.role !== ProjectRole.OWNER) {
      throw new MembersServiceError(
        "Only the project owner can remove members",
        403,
        "NOT_ALLOWED_TO_REMOVE_MEMBER",
      );
    }

    // Find the target member.
    const targetUser = await tx.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId,
        },
      },
    });

    if (!targetUser) {
      throw new MembersServiceError(
        "Member not found in this project",
        404,
        "MEMBER_NOT_FOUND",
      );
    }

    // The project owner cannot be removed through this endpoint.
    if (targetUser.role === ProjectRole.OWNER) {
      throw new MembersServiceError(
        "You cannot remove the project owner",
        403,
        "CANNOT_KICK_OWNER",
      );
    }

    // Remove the member.
    const deletedUser = await tx.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: memberId,
        },
      },
      select: {
        id: true,
        userId: true,
        role: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    // Record the removal in the same transaction.
    await tx.activityLog.create({
      data: {
        projectId,
        actorId: userId,
        action: "MEMBER_REMOVED",
        entityType: "MEMBER",
        entityId: deletedUser.id,
        metadata: {
          memberId: deletedUser.userId,
          memberName: deletedUser.user.name,
          previousRole: deletedUser.role,
        },
      },
    });

    return deletedUser;
  });
};