import type { RequestHandler } from "express";
import { getNotifications, markNotificationAsRead, markNotificationAsReadAll, deleteNotification } from "./notification.service";

export const GetNotification: RequestHandler = async (req,res,next) => {
  try{

     const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notification = await getNotifications(userId);

    return res.status(200).json({
      success: true,
      message: "Notification Fetched Sucessfully!",
      data: notification
    })

  }catch(err){
    next(err);
  }
}

export const MarkNotificationAsRead: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { notificationId } = req.params

    if (typeof notificationId !== "string" || !notificationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid Notification ID",
      });
    }

    const mark = await markNotificationAsRead(userId,notificationId);

    return res.status(200).json({
      success: true,
      message: "Message Merked As Read Sucessfully",
      data: mark
    })

  }catch(err){
    next(err);
  }
}

export const MarkNotificationAsReadAll: RequestHandler = async (req,res,next) => {
  try{
    
      const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const markAll = await markNotificationAsReadAll(userId);

    return res.status(200).json({
      success: true,
      message: "All Notifications Marked As Read Sucessfully",
      data: markAll
    })

  }catch(err){
    next(err);
  }
}

export const DeleteNotification: RequestHandler = async (req,res,next) => {
  try{

     const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { notificationId } = req.params

    if (typeof notificationId !== "string" || !notificationId) {
      return res.status(400).json({
        success: false,
        message: "Invalid Notification ID",
      });
    }

    const deleteNoti = await deleteNotification(userId,notificationId);

    return res.status(200).json({
      success: true,
      message: "Notification Deleted Sucessfully!",
      data:deleteNoti
    })

  }catch(err){
    next(err);
  }
}