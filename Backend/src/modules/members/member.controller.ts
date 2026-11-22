import { ProjectRole } from "../../../generated/prisma/enums";
import type { RequestHandler } from "express";

import { getMembers, updateMember, deleteMember } from "./member.service";

export const GetMembers: RequestHandler = async (req, res, next) => {
  try {
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

    const members = await getMembers(userId, projectId);

    return res.status(200).json({
      success: true,
      message: "Project Members Fetched Sucuessfully!",
      data: members,
    });
  } catch (err) {
    next(err);
  }
};

export const UpdateMember: RequestHandler = async (req,res,next) => {
try{
  const userId = req.userId

  if(!userId){
    return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
  }

  const { projectId, memberId } = req.params;

  if (
      typeof projectId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    // 4. Validate member ID
    if (
      typeof memberId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const { role } = req.body ?? {};

     if (
      role !== ProjectRole.ADMIN &&
      role !== ProjectRole.MEMBER
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Allowed roles: ADMIN, MEMBER",
      });
    }

    const updatedMember = await updateMember(userId,projectId,memberId,role);

    return res.status(200).json({
      success: true,
      message: 'User Role Updated Sucessfully!',
      data: updatedMember
    })
}catch(err){
  next(err);
}
  
}

export const DeleteMember: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId

  if(!userId){
    return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
  }

  const { projectId, memberId } = req.params;

  if (
      typeof projectId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    // 4. Validate member ID
    if (
      typeof memberId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const deletedMember = await deleteMember(userId,projectId,memberId);

    return res.status(200).json({
      success: true,
      message: "Member KickedOut Sucuessfully!",
      data: deletedMember
    })

  }catch(err){
    next(err);
  }
}