import type { RequestHandler } from "express";
import { createInvitation, getInvitations, acceptInvitation, declineInvitation, cancelInvitation } from "./invitation.service";

export const CreateInvitation: RequestHandler = async (req, res, next) => {
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

    const { invitedUserId } = req.body;

    const invite = await createInvitation(userId, projectId, invitedUserId);

    return res.status(201).json({
      success: true,
      message: "Invitaion Send Sucuessfully",
      data: invite,
    });
  } catch (err) {
    next(err);
  }
};

export const GetInvitations: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const invitations = await getInvitations(userId);

    return res.status(200).json({
      success: true,
      message: "Invitations Fetched Sucessfully",
      data: invitations,
    });
  } catch (err) {
    next(err);
  }
};

export const AcceptInvitation: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { invitationId } = req.params;

    if (typeof invitationId !== "string" || !invitationId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const accept = await acceptInvitation(userId,invitationId);

    return res.status(200).json({
      success: true,
      message: "Invitation Accepted Sucuessfully",
      data: accept
    })

  }catch(err){
    next(err)
  }
}

export const DeclineInvitation: RequestHandler = async (req,res,next) => {
  try{

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { invitationId } = req.params;

    if (typeof invitationId !== "string" || !invitationId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation  ID",
      });
    }

    const decline = await declineInvitation(userId,invitationId)

    return res.status(200).json({
      success: true,
      message: "Invitation Declined Sucessfully",
      data: decline
    })

  }catch(err){
    next(err);
  }
}

export const CancelInvitation: RequestHandler = async (req,res,next) => {
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

    const { invitationId } = req.params;

    if (typeof invitationId !== "string" || !invitationId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation  ID",
      });
    }

    const cancel = await cancelInvitation(userId,projectId,invitationId);

    return res.status(200).json({
      success: true,
      message: "The Invitation Canceled Sucessfully!",
      data: cancel
    })

  }catch(err){
    next(err);
  }
}
