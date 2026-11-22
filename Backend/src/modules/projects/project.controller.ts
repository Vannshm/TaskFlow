import type { RequestHandler } from "express";

import {
  CreateProject as create,
  showPojects as show,
  getProjectById as get,
  updateProject as update,
  deleteProject as del,
} from "./project.service";

export const CreateProject: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { name, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string",
      });
    }

    const project = await create({ userId, name, description });

    return res.status(201).json({
      success: true,
      message: "Project Created Sucessfully",
      data: project,
    });
  } catch (err) {
    next(err);
  }
};

export const ShowProject: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const projects = await show(userId);

    return res.status(200).json({
      success: true,
      message: "All projects Fetched sucessfully",
      data: projects,
    });
  } catch (err) {
    next(err);
  }
};

export const GetProjectById: RequestHandler = async (req, res, next) => {
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

    const project = await get(projectId, userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Project Found Sucessfully",
      data: project,
    });
  } catch (err) {
    next(err);
  }
};

export const UpdateProject: RequestHandler = async (req, res, next) => {
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

    const { name, description } = req.body;

    const NormalizeName = name?.trim();
    const NormalizeDescription =
      description !== undefined ? description.trim() || null : undefined;

    const project = await update({
      userId,
      projectId,
      name: NormalizeName,
      description: NormalizeDescription,
    });

    return res.status(200).json({
      success: true,
      message: "Project Updated Sucessfully",
      data: project,
    });
  } catch (err) {
    next(err);
  }
};

export const DeleteProject: RequestHandler = async (req, res, next) => {
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

    const deleteProj = await del(userId, projectId);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: deleteProj
    })
  } catch (err) {
    next(err);
  }
};
