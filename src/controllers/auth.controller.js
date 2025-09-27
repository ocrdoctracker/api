import { compare } from '../utils/utils.js';
import {
  ERROR_USER_NOT_FOUND,
  ERROR_PASSWORD_INCORRECT,
} from '../constants/auth.constant.js';
import { findActiveUserByUsername } from '../services/auth.service.js';

export async function login(req, res) {
  const { username, password } = req.body;

  let user = await findActiveUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: ERROR_USER_NOT_FOUND });
  }

  const isMatch = await compare(user.password , password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: ERROR_PASSWORD_INCORRECT });
  }

  if(!user?.department) {
    return res.status(401).json({ success: false, message: "User does not have access!" });
  }

  delete user.password;
  delete user.currentOtp;

  return res.json({ success: true, data: user });
}