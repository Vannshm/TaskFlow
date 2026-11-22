import express from 'express'
import { authMiddleware } from '../../middleware/auth.middleware';
import { DeleteNotification, GetNotification, MarkNotificationAsRead, MarkNotificationAsReadAll } from './notification.controller';
const route = express.Router()


route.get('/',authMiddleware,GetNotification)
route.patch('/:notificationId/read',authMiddleware,MarkNotificationAsRead)
route.patch('/readAll',authMiddleware,MarkNotificationAsReadAll)
route.delete('/:notificationId',authMiddleware,DeleteNotification)



export default route;