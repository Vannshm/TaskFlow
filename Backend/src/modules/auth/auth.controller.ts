import type { RequestHandler } from "express";
import { registerUser, loginUser, getCurrentUser } from "./auth.service";
import jwt from "jsonwebtoken";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

export const Register: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const user = await registerUser({ name, email, password });

    return res.status(200).json({
      success: true,
      message: "User Registered Sucuessfully!",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

export const Login: RequestHandler = async (req, res, next) => {
  try {
    const { nameOrEmail, password } = req.body;

    const user = await loginUser({ nameOrEmail, password });

    res.cookie("token", user.token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: "User Log in Sucessfully",
      data: {
        user: user.user,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const Logout: RequestHandler = async (req, res) => {
  try {
    res.clearCookie("token", cookieOptions);

    res.status(200).json({
      success: true,
      message: "User logged out successfully!",
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: "Server Error",
    });
  }
};

export const CurrentUser: RequestHandler = async (req,res,next) => {
  try{
    
    const userId = req.userId;

    if(!userId){
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User ID not found",
      });
    }

    const user = await getCurrentUser(userId);

    return res.status(200).json({
       success: true,
      message: "User fetched successfully!",
      data: user
    });

  }catch(err){
    next(err);
  }
}
