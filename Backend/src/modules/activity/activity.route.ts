import express from 'express'
const route = express.Router();
import { GetProjectActivity } from './activity.controller'
import { authMiddleware } from '../../middleware/auth.middleware';

route.get('/projects/:projectId',authMiddleware,GetProjectActivity);


export default route