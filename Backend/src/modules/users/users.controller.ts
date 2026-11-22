import type { RequestHandler } from "express";

import { UpdateUser, UpdatePassword, SearchUser as findUser } from "./users.service";

export const UserUpdate: RequestHandler = async (req, res, next) => {
  try {
    // Get the user ID added by authMiddleware
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get allowed fields from request body
    const { name, avatarUrl } = req.body;

    // Normalize name only if it was provided
    const normalizedName =name.trim();

    // Update user in database
    const user = await UpdateUser({
      userId,
      name: normalizedName,
      avatarUrl,
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

export const UpdatePass: RequestHandler = async(req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { opass, npass } = req.body;

    if (
      typeof opass !== "string" ||
      typeof npass !== "string" ||
      !opass ||
      !npass
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    await UpdatePassword({userId,Opassword:opass,Npassword:npass});

    return res.status(200).json({
      success:true,
      message:'Password Updated Sucessfully!'
    })

  }catch(err){
    next(err)
  }
}

export const SearchUser: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    // 1. Get the search query from URL
    const query = req.query.q;

    // 2. Validate the query
    if (typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // 3. Call service to search users
    const users = await findUser(query.trim());

    // 4. Return search results
    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      results: users.length,
      data: users,
    });

  } catch (err) {
    next(err);
  }
};