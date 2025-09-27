import { hashPassword } from '../utils/utils.js'
import { getDepartmentById, createDepartment, updateDepartment, removeDepartment } from '../services/department.service.js';
import { CREATE_SUCCESS, ERROR_DEPARTMENT_EXISTS, ERROR_DEPARTMENT_NOT_FOUND, REMOVE_SUCCESS } from '../constants/department.constant.js';

export async function getDepartment(req, res) {
  const { departmentId } = req.params;
  if(!departmentId) {
      return res.status(400).json({ success: false, message: "Missing departmentId params" });
  }
  let department = await getDepartmentById(departmentId);
  if(!department) {
    return res.status(400).json({ success: false, message: ERROR_DEPARTMENT_NOT_FOUND });
  }
  return res.json({ success: true, data: department });
}

export async function create(req, res) {
  const { name } = req.body;

  let department;

  try {
    department = await createDepartment(name);
    
  } catch (error) {
    if(error.message.includes('duplicate key value violates unique constraint')) {
      return res.status(400).json({ success: false, message: ERROR_DEPARTMENT_EXISTS });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
  
  return res.json({ success: true, data: department, message: CREATE_SUCCESS });
}

export async function update(req, res) {
  const { departmentId } = req.params;
  if(!departmentId) {
      return res.status(400).json({ success: false, message: "Missing departmentId params" });
  }
  const { name } = req.body;

  let department;

  try {
    department = await getDepartmentById(departmentId);
    if(!department) {
      return res.status(400).json({ success: false, message: ERROR_DEPARTMENT_NOT_FOUND });
    }
    department = await updateDepartment(departmentId, name);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  
  return res.json({ success: true, data: department, message: REMOVE_SUCCESS });
}

export async function remove(req, res) {
  const { departmentId } = req.params;
  if(!departmentId) {
      return res.status(400).json({ success: false, message: "Missing departmentId params" });
  }

  let department;

  try {
    department = await getDepartmentById(departmentId);
    if(!department) {
      return res.status(400).json({ success: false, message: ERROR_DEPARTMENT_NOT_FOUND });
    }
    department = await removeDepartment(departmentId);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  
  return res.json({ success: true, data: department, message: REMOVE_SUCCESS });
}