import type { RequestHandler } from "express";
import { getDashboardSummary, getRecentActivity } from "./dashboard.service";

export const GetDashboardSummary: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const summary = await getDashboardSummary(userId);

    return res.status(200).json({
      success: true,
      message: "Summary Fetched Sucessfully",
      data: summary
    })

  }catch(err){
    next(err);
  }
}

export const GetRecentActivity: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const activity = await getRecentActivity(userId);

    return res.status(200).json({
      success: true,
      message: "Activity Fetched Sucessfully",
      data: activity
    })

  }catch(err){
    next(err);
  }
}