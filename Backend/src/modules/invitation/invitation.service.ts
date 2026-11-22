import {
  ProjectRole,
  NotificationType,
  InvitationStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../prisma";

export class InvitationServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "InvitationServiceError";
  }
}

export const createInvitation = async (
  userId: string,
  projectId: string,
  invitedUserId: string,
) => {
  const currectTime = new Date();

  return await prisma.$transaction(
    async (tx) => {
      const currentMember = await tx.projectMember.findUnique({
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
            },
          },
          user: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!currentMember) {
        throw new InvitationServiceError(
          "Project not found or you are not a member of this project",
          404,
          "PROJECT_NOT_FOUND",
        );
      }

      if (currentMember.role !== ProjectRole.OWNER) {
        throw new InvitationServiceError(
          "Only the project owner can invite members",
          403,
          "NOT_ALLOWED_TO_INVITE",
        );
      }

      if (userId === invitedUserId) {
        throw new InvitationServiceError(
          "You cannot invite yourself",
          400,
          "CANNOT_INVITE_SELF",
        );
      }

      const invitedUser = await tx.user.findUnique({
        where: {
          id: invitedUserId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!invitedUser) {
        throw new InvitationServiceError(
          "User not found",
          404,
          "USER_NOT_FOUND",
        );
      }

      const existingMember = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: invitedUserId,
          },
        },
      });

      if (existingMember) {
        throw new InvitationServiceError(
          "This user is already a member of the project",
          409,
          "USER_ALREADY_MEMBER",
        );
      }

      await tx.invitation.updateMany({
        where: {
          projectId,
          invitedUserId,
          status: InvitationStatus.PENDING,
          expiresAt: {
            lte: currectTime,
          },
        },
        data: {
          status: InvitationStatus.EXPIRED,
        },
      });

      const existingInvitation = await tx.invitation.findFirst({
        where: {
          projectId,
          invitedUserId,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: currectTime,
          },
        },
      });

      if (existingInvitation) {
        throw new InvitationServiceError(
          "An active invitation has already been sent to this user",
          409,
          "INVITATION_ALREADY_EXISTS",
        );
      }

      const expiresAt = new Date(
        currectTime.getTime() + 7 * 24 * 60 * 60 * 1000,
      );

      const invitation = await tx.invitation.create({
        data: {
          projectId,
          invitedUserId,
          invitedById: userId,
          status: InvitationStatus.PENDING,
          expiresAt,
        },
        select: {
          id: true,
          projectId: true,
          invitedUserId: true,
          invitedById: true,
          status: true,
          expiresAt: true,
          createdAt: true,

          project: {
            select: {
              name: true,
            },
          },

          invitedUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const notification = await tx.notification.create({
        data: {
          userId: invitedUserId,

          type: NotificationType.PROJECT_INVITATION,

          title: "New project invitation",

          message: `${currentMember.user.name} invited you to join ${currentMember.project.name}`,

          relatedProjectId: projectId,

          relatedInvitationId: (await invitation).id,
        },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          createdAt: true,
        },
      });

      await tx.activityLog.create({
        data: {
          projectId,
          actorId: userId,
          action: "INVITATION_CREATED",
          entityType: "INVITATION",
          entityId: invitation.id,
          metadata: {
            invitedUserId: invitedUser.id,
            invitedUserName: invitedUser.name,
            projectName: currentMember.project.name,
          },
        },
      });

      return {
        message: "Project invitation sent successfully",

        invitation,

        notification,
      };
    },
    {
      maxWait: 10000, // Wait up to 10 seconds to acquire a transaction
      timeout: 20000, // Allow up to 20 seconds to complete it
    },
  );
};

export const getInvitations = async (userId: string) => {
  const currentTime = new Date();

  await prisma.invitation.updateMany({
    where: {
      invitedUserId: userId,
      status: InvitationStatus.PENDING,
      expiresAt: {
        lte: currentTime,
      },
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });

  const invitations = await prisma.invitation.findMany({
    where: {
      invitedUserId: userId,
      status: InvitationStatus.PENDING,
      expiresAt: {
        gt: currentTime,
      },
    },
    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      status: true,
      expiresAt: true,
      createdAt: true,

      project: {
        select: {
          id: true,
          name: true,
          status: true,
          description: true,
        },
      },

      invitedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  return {
    TotalInvitations: invitations.length,
    invitations,
  };
};

export const acceptInvitation = async (
  userId: string,
  invitationId: string,
) => {
  const currentTime = new Date();

  // Use a transaction because invitation and membership
  // must be updated together.
  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Find the invitation belonging to the logged-in user
      const invitation = await tx.invitation.findFirst({
        where: {
          id: invitationId,
          invitedUserId: userId,
        },
        select: {
          id: true,
          projectId: true,
          invitedById: true,
          status: true,
          expiresAt: true,

          project: {
            select: {
              id: true,
              name: true,
            },
          },

          invitedUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Check whether the invitation exists
      // and belongs to the current user.
      if (!invitation) {
        throw new InvitationServiceError(
          "Invitation not found",
          404,
          "INVITATION_NOT_FOUND",
        );
      }

      // 2. Check whether the invitation is still pending
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new InvitationServiceError(
          "This invitation has already been responded to",
          409,
          "INVITATION_NOT_PENDING",
        );
      }

      // 3. Check whether the invitation has expired
      if (invitation.expiresAt <= currentTime) {
        // Update the invitation status to EXPIRED
        await tx.invitation.updateMany({
          where: {
            id: invitationId,
            invitedUserId: userId,
            status: InvitationStatus.PENDING,
          },
          data: {
            status: InvitationStatus.EXPIRED,
          },
        });

        // Return instead of throwing here.
        // Throwing inside the transaction would roll back
        // the EXPIRED status update.
        return {
          expired: true as const,
        };
      }

      // 4. Update the invitation status to ACCEPTED.
      // updateMany allows us to ensure it is still pending.
      const updatedInvitation = await tx.invitation.updateMany({
        where: {
          id: invitationId,
          invitedUserId: userId,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: currentTime,
          },
        },
        data: {
          status: InvitationStatus.ACCEPTED,
          respondedAt: currentTime,
        },
      });

      // Prevent accepting an invitation that was already
      // processed by another request.
      if (updatedInvitation.count !== 1) {
        throw new InvitationServiceError(
          "Invitation is no longer available",
          409,
          "INVITATION_ALREADY_RESPONDED",
        );
      }

      // 5. Check whether the user is already a project member
      const existingMember = await tx.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: invitation.projectId,
            userId,
          },
        },
        select: {
          id: true,
          projectId: true,
          userId: true,
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
      });

      // 6. Create a membership if one doesn't already exist
      const member =
        existingMember ??
        (await tx.projectMember.create({
          data: {
            projectId: invitation.projectId,
            userId,

            // Your Invitation model doesn't store a role,
            // so accepted invitations create MEMBER accounts.
            role: ProjectRole.MEMBER,
          },
          select: {
            id: true,
            projectId: true,
            userId: true,
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
        }));

      // 7. Notify the person who sent the invitation
      const notification = existingMember
        ? null
        : await tx.notification.create({
            data: {
              userId: invitation.invitedById,

              type: NotificationType.MEMBER_JOINED,

              title: "Invitation accepted",

              message: `${invitation.invitedUser.name} accepted your invitation to ${invitation.project.name}`,

              relatedProjectId: invitation.projectId,

              relatedInvitationId: invitation.id,
            },
            select: {
              id: true,
              type: true,
              title: true,
              message: true,
              createdAt: true,
            },
          });

      // Log invitation acceptance
      await tx.activityLog.create({
        data: {
          projectId: invitation.projectId,
          actorId: userId,
          action: "INVITATION_ACCEPTED",
          entityType: "INVITATION",
          entityId: invitation.id,
          metadata: {
            projectName: invitation.project.name,
            memberName: invitation.invitedUser.name,
          },
        },
      });

      if (!existingMember) {
        await tx.activityLog.create({
          data: {
            projectId: invitation.projectId,
            actorId: userId,
            action: "MEMBER_JOINED",
            entityType: "MEMBER",
            entityId: member.id,
            metadata: {
              memberName: member.user.name,
              role: member.role,
            },
          },
        });
      }

      // 8. Return the result
      return {
        expired: false as const,

        alreadyMember: Boolean(existingMember),

        invitation: {
          id: invitation.id,
          status: InvitationStatus.ACCEPTED,
          respondedAt: currentTime,
        },

        member,

        notification,
      };
    },
    {
      // Transaction configuration
      maxWait: 10000,
      timeout: 20000,
    },
  );

  // Handle expiration AFTER the transaction commits
  if (result.expired) {
    throw new InvitationServiceError(
      "This invitation has expired",
      410,
      "INVITATION_EXPIRED",
    );
  }

  // Return the accepted invitation
  return {
    message: result.alreadyMember
      ? "You are already a member of this project. Invitation marked as accepted."
      : "Invitation accepted successfully",

    invitation: result.invitation,

    member: result.member,

    notification: result.notification,
  };
};

export const declineInvitation = async (
  userId: string,
  invitationId: string,
) => {
  // Get the current date and time
  const currentTime = new Date();

  // 1. Find the invitation belonging to the logged-in user
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      invitedUserId: userId,
    },
    select: {
      id: true,
      projectId: true,
      status: true,
      expiresAt: true,
    },
  });

  // 2. Check whether the invitation exists
  if (!invitation) {
    throw new InvitationServiceError(
      "Invitation not found",
      404,
      "INVITATION_NOT_FOUND",
    );
  }

  // 3. Check whether the invitation is still pending
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new InvitationServiceError(
      "This invitation has already been responded to",
      409,
      "INVITATION_NOT_PENDING",
    );
  }

  // 4. Check whether the invitation has expired
  if (invitation.expiresAt <= currentTime) {
    // Update the expired invitation's status
    await prisma.invitation.updateMany({
      where: {
        id: invitationId,
        invitedUserId: userId,
        status: InvitationStatus.PENDING,
        expiresAt: {
          lte: currentTime,
        },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    throw new InvitationServiceError(
      "This invitation has expired",
      410,
      "INVITATION_EXPIRED",
    );
  }

  // 5. Update the invitation status to DECLINED
  // updateMany ensures that only a pending, non-expired
  // invitation belonging to this user can be declined.
  const updatedInvitation = await prisma.invitation.updateMany({
    where: {
      id: invitationId,
      invitedUserId: userId,
      status: InvitationStatus.PENDING,
      expiresAt: {
        gt: currentTime,
      },
    },
    data: {
      status: InvitationStatus.DECLINED,
      respondedAt: currentTime,
    },
  });

  // 6. Check whether the invitation was successfully updated
  if (updatedInvitation.count !== 1) {
    throw new InvitationServiceError(
      "Invitation is no longer available",
      409,
      "INVITATION_ALREADY_RESPONDED",
    );
  }

  await prisma.activityLog.create({
    data: {
      projectId: invitation.projectId,
      actorId: userId,
      action: "INVITATION_DECLINED",
      entityType: "INVITATION",
      entityId: invitation.id,
      metadata: {
        status: InvitationStatus.DECLINED,
      },
    },
  });

  // 7. Return the result
  return {
    message: "Invitation declined successfully",

    invitation: {
      id: invitation.id,
      projectId: invitation.projectId,
      status: InvitationStatus.DECLINED,
      respondedAt: currentTime,
    },
  };
};

export const cancelInvitation = async (
  userId: string,
  projectId: string,
  invitationId: string,
) => {
  const currectTime = new Date();

  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      projectId,
      invitedById: userId,
    },
    select: {
      id: true,
      projectId: true,
      invitedUserId: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    throw new InvitationServiceError(
      "Invitation not found",
      404,
      "INVITATION_NOT_FOUND",
    );
  }

  const currentMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: invitation.projectId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!currentMember || currentMember.role !== ProjectRole.OWNER) {
    throw new InvitationServiceError(
      "Only the project owner can cancel invitations",
      403,
      "NOT_ALLOWED_TO_CANCEL_INVITATION",
    );
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new InvitationServiceError(
      "This invitation cannot be canceled because it is no longer pending",
      409,
      "INVITATION_NOT_PENDING",
    );
  }

  if (invitation.expiresAt <= currectTime) {
    const expiredInvitation = await prisma.invitation.updateMany({
      where: {
        id: invitationId,
        invitedById: userId,
        status: InvitationStatus.PENDING,
        expiresAt: {
          lte: currectTime,
        },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    if (expiredInvitation.count !== 1) {
      throw new InvitationServiceError(
        "Invitation is no longer available",
        409,
        "INVITATION_ALREADY_RESPONDED",
      );
    }

    throw new InvitationServiceError(
      "This invitation has already expired",
      410,
      "INVITATION_EXPIRED",
    );
  }

  const cancelInvite = await prisma.invitation.updateMany({
    where: {
      id: invitationId,
      invitedById: userId,
      status: InvitationStatus.PENDING,
      expiresAt: {
        gt: currectTime,
      },
    },
    data: {
      status: InvitationStatus.CANCELED,
    },
  });

  if (cancelInvite.count !== 1) {
    throw new InvitationServiceError(
      "Invitation is no longer available",
      409,
      "INVITATION_ALREADY_RESPONDED",
    );
  }

  await prisma.activityLog.create({
    data: {
      projectId: invitation.projectId,
      actorId: userId,
      action: "INVITATION_CANCELLED",
      entityType: "INVITATION",
      entityId: invitation.id,
      metadata: {
        invitedUserId: invitation.invitedUserId,
        status: InvitationStatus.CANCELED,
      },
    },
  });

  return {
    message: "Invitation canceled successfully",

    invitation: {
      id: invitation.id,
      projectId: invitation.projectId,
      invitedUserId: invitation.invitedUserId,
      status: InvitationStatus.CANCELED,
    },
  };
};
