import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware';
import { GetDashboardSummary, GetRecentActivity } from './dashboard.controller';
const route = express.Router()


route.get('/summary',authMiddleware,GetDashboardSummary)
route.get('/recent-activity',authMiddleware,GetRecentActivity)


export default route;