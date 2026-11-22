import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware';
import { CreateInvitation, GetInvitations, AcceptInvitation, DeclineInvitation, CancelInvitation } from './invitation.controller';
const route = express.Router();

route.post('/projects/:projectId/invitation',authMiddleware,CreateInvitation)
route.get('/invitations',authMiddleware,GetInvitations)
route.post('/invitations/:invitationId/accept',authMiddleware,AcceptInvitation)
route.post('/invitations/:invitationId/decline',authMiddleware,DeclineInvitation)
route.post('/projects/:projectId/invitations/:invitationId',authMiddleware,CancelInvitation)

export default route;