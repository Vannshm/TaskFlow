import express from 'express'
const route = express.Router()

import { Register, Login, Logout, CurrentUser } from './auth.controller'
import { authMiddleware } from '../../middleware/auth.middleware'

route.get('/',(_,res)=>{
  res.send('hello vansh lets Build TaskFlow!')
})

route.post('/register-user',Register)
route.post('/login-user',Login)
route.post('/logout-user',Logout)
route.get('/me',authMiddleware,CurrentUser)

export default route