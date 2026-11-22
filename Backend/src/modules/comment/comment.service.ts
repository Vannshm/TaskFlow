import { prisma } from "../../prisma";
import { createActivity } from "../activity/activity.service";

export class CommentServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "CommentServiceError ";
  }
}

export const comment = async (userId: string, taskId: string, content: string) => {
    
    const task = await prisma.task.findFirst({
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

        project:{
          select:{
            id: true,
            name: true
          }
        }
      }
    });

    if(!task){
       throw new CommentServiceError(
        "Task not found or you don't have access to it",
        404,
        "TASK_NOT_FOUND"
      );
    }

    const createComment = await prisma.comment.create({
      data:{
        taskId,
        authorId: userId,
        content: content.trim()
      },
      select:{
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,

        author:{
          select:{
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    await createActivity({
  projectId: task.project.id,
  actorId: userId,
  action: "COMMENT_CREATED",
  entityType: "COMMENT",
  entityId: createComment.id,
  metadata: {
    commentContent: createComment.content,
    taskId: task.id,
  },
});

    return createComment

} 

export const getComment = async (userId: string, taskId: string) => {
  const task = await prisma.task.findFirst({
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
      id: true
    }
  });

  if(!task){
     throw new CommentServiceError(
        "Task not found or you don't have access to it",
        404,
        "TASK_NOT_FOUND"
      );
  }

  const comment = await prisma.comment.findMany({
    where:{
      taskId
    },
    orderBy:{
      createdAt: 'asc'
    },
    select:{
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,

      author:{
        select:{
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  })

  return comment
}

export const updateComment = async (userId: string, taskId: string, commentId: string, content: string) => {
  const task = await prisma.task.findFirst({
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

      project:{
        select:{
          id: true,
          name: true
        }
      }
    }
  });

  if(!task){
     throw new CommentServiceError(
        "Task not found or you don't have access to it",
        404,
        "TASK_NOT_FOUND"
      );
  }

  const comment = await prisma.comment.findFirst({
    where:{
      id: commentId,
      taskId,
      authorId: userId,

      task:{
        project:{
          members:{
            some:{
              userId
            }
          }
        }
      }
    },
    select:{
      id: true
    }
  })

  if(!comment){
     throw new CommentServiceError(
        "Comment not found or you don't have access to it",
        404,
        "COMMENT_NOT_FOUND"
      );
  }

  const update = await prisma.comment.update({
    where:{
      id: commentId,
      authorId: userId
    },
    data:{
      content:content.trim()
    },
    select:{
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,

      author:{
        select:{
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  });

      await createActivity({
      projectId: task.project.id,
      actorId: userId,
      action: "COMMENT_UPDATED",
      entityType: "COMMENT",
      entityId: update.id,
      metadata: {
        commentTitile: update.content,
      },
    });

  return update


}

export const deleteComment = async (userId: string, taskId: string, commentId: string) => {

  const comment = await prisma.comment.findFirst({
  where: {
    id: commentId,
    taskId,
    authorId: userId,
    task: {
      project: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
  },
  select: {
    id: true,
    content: true,
    task: {
      select: {
        id: true,
        project: {
          select: {
            id: true,
          },
        },
      },
    },
  },
});

  if(!comment){
     throw new CommentServiceError(
        "Comment not found or you don't have access to it",
        404,
        "COMMENT_NOT_FOUND"
      );
  }

  const deleteComment = await prisma.comment.delete({
    where:{
      id: commentId,
      authorId: userId,
      taskId
    },
    select:{
      id: true,
    }
  })

    await createActivity({
  projectId: comment.task.project.id,
  actorId: userId,
  action: "COMMENT_DELETED",
  entityType: "COMMENT",
  entityId: comment.id,
  metadata: {
    commentContent: comment.content,
    taskId: comment.task.id,
  },
});

  return deleteComment;
}