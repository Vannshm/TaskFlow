import { prisma } from "../../prisma";

export class NotificationServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "NotificationServiceError ";
  }
}

export const getNotifications = async (userId: string) => {

  const notification = await prisma.notification.findMany({
    where:{
      userId
    },
    orderBy:{
      createdAt: 'desc'
    },
    select:{
      id: true,
      type: true,
      title: true,
      message: true,
      readAt: true,
      createdAt: true,

      relatedProject:{
        select:{
          id: true,
          name: true
        }
      },

      relatedTask:{
        select:{
          id: true,
          title: true,
          projectId: true
        }
      },

      relatedInvitation:{
        select:{
          id: true,
          status: true,
          expiresAt: true,

          project:{
            select:{
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  return notification;

}

export const markNotificationAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findFirst({
    where:{
      id: notificationId,
      userId
    },
    select:{
      id: true,
      readAt: true
    }
  });

  if (!notification) {
    throw new NotificationServiceError(
      "Notification not found",
      404,
      "NOTIFICATION_NOT_FOUND"
    );
  }

  if(notification.readAt !== null){
    return notification
  }

  const updateNotification = await prisma.notification.update({
    where:{
      id: notificationId
    },
    data:{
      readAt: new Date()
    },
    select:{
      id: true,
      type: true,
      title: true,
      message: true,
      readAt: true,
      createdAt: true
    }
  });


  return updateNotification;

}

export const markNotificationAsReadAll = async (userId: string) => {

  const updateNotification = await prisma.notification.updateMany({
    where:{
      userId
    },
    data:{
      readAt: new Date()
    }
  });


  return updateNotification;

}

export const deleteNotification = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findFirst({
    where:{
      id: notificationId,
      userId
    },
    select:{
      id: true
    }
  });

  if (!notification) {
    throw new NotificationServiceError(
      "Notification not found",
      404,
      "NOTIFICATION_NOT_FOUND"
    );
  }

  const deleteNoti = await prisma.notification.delete({
    where:{
      id: notificationId
    },
    select:{
      id: true
    }
  });

  return deleteNoti;
}