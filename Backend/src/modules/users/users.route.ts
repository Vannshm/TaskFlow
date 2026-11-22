import express from 'express'
const route = express.Router()

import { CurrentUser, } from '../auth/auth.controller' 
import { UserUpdate, UpdatePass, SearchUser } from './users.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

route.get('/me',authMiddleware,CurrentUser)
route.patch('/me',authMiddleware,UserUpdate)
route.patch('/me/password',authMiddleware,UpdatePass)
route.get('/search',authMiddleware,SearchUser)


export default route