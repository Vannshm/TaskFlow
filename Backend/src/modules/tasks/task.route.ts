import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { CreateTask, GetProjectTasks, GetTasks, GetTaskById, UpdateTask, DeleteTask } from './task.controller'
const route = express.Router()


route.post('/project/:projectId/tasks',authMiddleware,CreateTask)
route.get('/project/:projectId/tasks',authMiddleware,GetProjectTasks)
route.get('/',authMiddleware,GetTasks)
route.get('/:taskId',authMiddleware,GetTaskById)
route.patch('/:taskId',authMiddleware,UpdateTask)
route.delete('/:taskId',authMiddleware,DeleteTask)


export default route