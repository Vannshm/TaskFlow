import express from 'express'
import cookieParser from 'cookie-parser';
import authRoute from './modules/auth/auth.route';
import userRoute from './modules/users/users.route'
import project from './modules/projects/project.route'
import members from './modules/members/member.route'
import invitation from './modules/invitation/invitation.route'
import tasks from './modules/tasks/task.route'
import comment from './modules/comment/comment.route'
import notification from './modules/notification/notification.route'
import activity from './modules/activity/activity.route'
import dashboard from './modules/dashboard/dashboard.route'

const app = express()

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth',authRoute)
app.use('/api/user',userRoute)
app.use('/api/project',project)
app.use('/api/member',members)
app.use('/api/invitation',invitation)
app.use('/api/tasks',tasks)
app.use('/api/comments',comment)
app.use('/api/notifications',notification)
app.use('/api/activity',activity)
app.use('/api/dashboard',dashboard)

export default app;