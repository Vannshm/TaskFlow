import type { RequestHandler } from "express";
import { comment, getComment, updateComment, deleteComment } from "./comment.service";

export const Comment: RequestHandler = async (req,res,next) =>{
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

    // 3. Validate request body.
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

    const { content } = req.body;

     if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "content should not be empty",
      });
    }

    const createComment = await comment(userId,taskId,content);
    
    return res.status(201).json({
      success: true,
      message: "Comment added Sucessfully!",
      data: createComment
    })

  }catch(err){
    next(err);
  }
}

export const GetComment: RequestHandler = async (req,res,next) => {
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

    const get = await getComment(userId,taskId);

    return res.status(200).json({
      success: true,
      message: "Comments Fetched Sucessfully",
      data: get
    })

  }catch(err){
    next(err);
  }
}

export const UpdateComment: RequestHandler = async (req,res,next) => {
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

    const { commentId } = req.params;

    if (typeof commentId !== "string" || !commentId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid Comment ID",
      });
    }

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

    const { content } = req.body;

     if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "content should not be empty",
      });
    }

    const updatedComment = await  updateComment(userId,taskId,commentId,content);

    return res.status(201).json({
      success: true,
      message: "Comment Updated Sucessfully",
      data: updatedComment
    })


  }catch(err){
    next(err);
  }
}

export const DeleteComment: RequestHandler = async (req,res,next) => {
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

    const { commentId } = req.params;

    if (typeof commentId !== "string" || !commentId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid Comment ID",
      });
    }

    const delCom = await deleteComment(userId,taskId,commentId);

    return res.status(200).json({
      success: true,
      message: "Comment Deleted Sucessfully",
      data: delCom
    })

  }catch(err){
    next(err);
  }
}