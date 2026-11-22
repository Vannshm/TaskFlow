import express from 'express'
const route = express.Router()

import { Comment, GetComment, UpdateComment, DeleteComment } from './comment.controller'
import { authMiddleware } from '../../middleware/auth.middleware'


route.post('/tasks/:taskId/comments',authMiddleware,Comment);
route.get('/tasks/:taskId/comments',authMiddleware,GetComment);
route.patch('/tasks/:taskId/comments/:commentId',authMiddleware,UpdateComment);
route.delete('/tasks/:taskId/comments/:commentId',authMiddleware,DeleteComment);



export default route