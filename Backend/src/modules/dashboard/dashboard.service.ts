import { prisma } from "../../prisma";

export class dashboardServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "dashboardServiceError";
  }
}

export const getDashboardSummary = async (userId: string) => {
  const [projectStatusCounts, taskStatusCount, overdueTasks] =
    await Promise.all([
      prisma.project.groupBy({
        by: ["status"],
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        _count: {
          _all: true,
        },
      }),

      prisma.task.groupBy({
        by: ["status"],
        where: {
          project: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        _count: {
          _all: true,
        },
      }),

      prisma.task.count({
        where: {
          project: {
            members: {
              some: {
                userId,
              },
            },
          },
          dueDate: {
            lt: new Date(),
          },
          status: {
            not: "COMPLETED",
          },
        },
      }),
    ]);

  const getProjectCount = (status: string) =>
    projectStatusCounts.find((item) => item.status === status)?._count._all ??
    0;

  const getTaskCount = (status: string) =>
    taskStatusCount.find((item) => item.status === status)?._count._all ?? 0;

  // Calculate total projects and tasks.
  const totalProjects = projectStatusCounts.reduce(
    (total, item) => total + item._count._all,
    0,
  );

  const totalTasks = taskStatusCount.reduce(
    (total, item) => total + item._count._all,
    0,
  );

  return {
    projects: {
      total: totalProjects,
      active: getProjectCount("ACTIVE"),
      completed: getProjectCount("COMPLETED"),
      archived: getProjectCount("ARCHIVED"),
    },

    tasks: {
      total: totalTasks,
      todo: getTaskCount("TODO"),
      inProgress: getTaskCount("IN_PROGRESS"),
      inReview: getTaskCount("IN_REVIEW"),
      completed: getTaskCount("COMPLETED"),
      overdue: overdueTasks,
    },
  };
};

export const getRecentActivity = async (userId: string) => {
  const activities = await prisma.activityLog.findMany({
    where: {
      project: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,

    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,

      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },

      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    totalActivities: activities.length,
    activities,
  };
};
