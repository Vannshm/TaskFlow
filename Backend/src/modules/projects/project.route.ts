import express from'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { CreateProject, ShowProject, GetProjectById, UpdateProject, DeleteProject } from './project.controller'

const route = express.Router()


route.post('/create',authMiddleware,CreateProject)
route.get('/projects',authMiddleware,ShowProject)
route.get('/projects/:projectId',authMiddleware,GetProjectById)
route.patch('/projects/:projectId',authMiddleware,UpdateProject)
route.delete('/projects/:projectId',authMiddleware,DeleteProject)

export default route