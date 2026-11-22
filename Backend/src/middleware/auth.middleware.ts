import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const token = req.cookies.token;
  try {
    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    if (!decoded) {
      return res.status(404).json({
        success: false,
        message: "Unauthorized - No token provided",
      });
    }

    const userId = decoded.sub;

    if (!userId || typeof userId !== "string") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid token payload",
      });
    }

    req.userId = userId;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized - Invalid or expired token",
    });
  }
};
