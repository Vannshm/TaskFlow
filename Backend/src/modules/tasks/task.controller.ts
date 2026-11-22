import type { RequestHandler } from "express";
import { createTask, getProjectTasks, getTasks, getTaskById, updateTask, deleteTask } from "./task.service";
import type { UpdateTaskInput } from "../../types/tasks";

export const CreateTask: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { projectId } = req.params;

    if (typeof projectId !== "string" || !projectId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

     const {
      title,
      description,
      assignedToId,
      priority,
      dueDate,
    } = req.body;

    const task = await createTask(userId,projectId,{
      title,
      description,
      assignedToId,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null
    });

    return res.status(201).json({
      success: true,
      message: "task assigned sucessfully",
      data: task
    })

  }catch(err){
    next(err);
  }
}

export const GetProjectTasks: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { projectId } = req.params;

    if (typeof projectId !== "string" || !projectId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const tasks = await getProjectTasks(userId,projectId);

    return res.status(200).json({
      success: true,
      message: "Tasks Fetched Sucessfully",
      data: tasks
    })

  }catch(err){
    next(err);
  }
}

export const GetTasks: RequestHandler = async (req,res,next) => {
  try{

     const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const tasks = await getTasks(userId);

    return res.status(200).json({
      success: true,
      message: "All Tasks Fetched Sucessfully!",
      data: tasks
    })

  }catch(err){
    next(err);
  }
}

export const GetTaskById: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { taskId } = req.params;

    if (typeof taskId !== "string" || !taskId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid Task ID",
      });
    }

    const task = await getTaskById(userId,taskId);

    return res.status(200).json({
      success: true,
      message: "Task Fetched Sucessfully!",
      data: task
    })


  }catch(err){
    next(err);
  }
}


export const UpdateTask: RequestHandler = async (req, res, next) => {
  try {
    // 1. Get the authenticated user's ID.
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 2. Validate task ID.
    const { taskId } = req.params;

    if (typeof taskId !== "string" || !taskId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid Task ID",
      });
    }

    // 3. Validate request body before accessing its properties.
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body",
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update",
      });
    }

    // 4. Get fields from request body.
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedToId,
    } = req.body;

    // 5. Allow only these fields to be updated.
    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "assignedToId",
    ];

    const invalidFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid fields: ${invalidFields.join(", ")}`,
      });
    }

    // 6. Validate title.
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty",
        });
      }
    }

    // 7. Validate description.
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid description",
      });
    }

    // 8. Validate task status.
    const validStatuses = [
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "COMPLETED",
    ];

    if (
      status !== undefined &&
      (typeof status !== "string" || !validStatuses.includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    // 9. Validate task priority.
    const validPriorities = [
      "LOW",
      "MEDIUM",
      "HIGH",
      "URGENT",
    ];

    if (
      priority !== undefined &&
      (typeof priority !== "string" || !validPriorities.includes(priority))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority",
      });
    }

    // 10. Validate and parse due date.
    let parsedDueDate: Date | null | undefined;

    if (dueDate !== undefined) {
      if (dueDate === null) {
        parsedDueDate = null;
      } else {
        if (typeof dueDate !== "string") {
          return res.status(400).json({
            success: false,
            message: "Due date must be a valid date string",
          });
        }

        parsedDueDate = new Date(dueDate);

        if (!Number.isFinite(parsedDueDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid due date",
          });
        }
      }
    }

    // 11. Validate assigned user ID.
    if (
      assignedToId !== undefined &&
      assignedToId !== null &&
      (typeof assignedToId !== "string" || !assignedToId.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignee ID",
      });
    }

    // 12. Build update object.
    // Only fields provided by the client will be included.
const updateData: UpdateTaskInput = {
  ...(title !== undefined && { title: title.trim() }),
  ...(description !== undefined && { description }),
  ...(status !== undefined && { status }),
  ...(priority !== undefined && { priority }),

  ...(dueDate !== undefined && {
    dueDate: parsedDueDate as Date | null,
  }),

  ...(assignedToId !== undefined && { assignedToId }),
};

    // Debug log: check whether data reaches the service.
    console.log("UPDATE DATA:", updateData);

    // 13. Call service to perform permission checks and update the task.
    const update = await updateTask(userId, taskId, updateData);

    // 14. Send successful response.
    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: update,
    });

  } catch (err) {
    next(err);
  }
};

export const DeleteTask: RequestHandler = async (req,res,next) => {
  try{

     const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 2. Validate task ID.
    const { taskId } = req.params;

    if (typeof taskId !== "string" || !taskId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid Task ID",
      });
    }

    const delTask = await deleteTask(userId,taskId);

    return res.status(200).json({
      success: true,
      message: "Task Deleted Sucessfully",
      data: delTask
    })

  }catch(err){
    next(err);
  }
}