
import {
  ERROR_USER_NOT_FOUND, 
  ERROR_USER_EXISTS, 
  CREATE_SUCCESS
} from '../constants/user.constant.js';
import { hashPassword } from '../utils/utils.js'
import { getUserById, createUser } from '../services/user.service.js';
import { findActiveUserByEmail } from '../services/auth.service.js';
import { getDepartmentById } from "../services/department.service.js"
import { ERROR_DEPARTMENT_NOT_FOUND } from "../constants/department.constant.js"

export async function getUser(req, res) {
  const { userId } = req.params;
  if(!userId) {
      return res.status(400).json({ success: false, message: "Missing userId params" });
  }
  let user = await getUserById(userId);
  if(!user) {
    return res.status(400).json({ success: false, message: ERROR_USER_NOT_FOUND });
  }
  delete user.password;
  delete user.currentOtp;
  return res.json({ success: true, data: user });
}

export async function create(req, res) {
  const { name, username, email, departmentId, password } = req.body;

  let user;

  try {
    const department = await getDepartmentById(!isNaN(Number(departmentId)) ? Number(departmentId) : 0);
    if (!department) {
      return res
        .status(400)
        .json({ success: false, message: ERROR_DEPARTMENT_NOT_FOUND });
    }
    user = await findActiveUserByEmail(email);
    if(!user) {
      const passwordHash = await hashPassword(password);
      user = await createUser(name, username, email, departmentId, passwordHash);
    } else {
      return res.status(400).json({ success: false, message: ERROR_USER_EXISTS });
    }
    delete user.passwordHash;
    
  } catch (error) {
    if(error.message.includes('duplicate key value violates unique constraint') && error.message.includes('User_Active_Email')) {
      return res.status(400).json({ success: false, message: ERROR_USER_EXISTS });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
  
  return res.json({ success: true, data: user, message: CREATE_SUCCESS });
}