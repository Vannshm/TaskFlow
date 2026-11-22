import express from 'express'
const route = express.Router()

import { authMiddleware } from '../../middleware/auth.middleware';
import { GetMembers, UpdateMember, DeleteMember } from './member.controller';

route.get('/projects/:projectId/members',authMiddleware,GetMembers);
route.get('/projects/:projectId/members/:userId',authMiddleware,UpdateMember); // not tested
route.delete('/projects/:projectId/members/:userId',authMiddleware,DeleteMember); // not tested


export default route;