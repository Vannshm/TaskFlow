import type { RequestHandler } from "express";
import { getProjectActivity } from "./activity.service";

export const GetProjectActivity: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;

    // 2. Check whether the user is authenticated.
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { projectId } = req.params;

    if (typeof projectId !== "string" || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid Project ID",
      });
    }

    const activity = await getProjectActivity(userId, projectId);

    return res.status(200).json({
      success: true,
      message: "Project Activities Fetched Successfully!",
      data: activity,
    });
  } catch (err) {
    next(err);
  }
};
