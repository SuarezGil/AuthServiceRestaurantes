import { asyncHandler } from '../../middlewares/server-genericError-handler.js';
import { validateJWT } from '../../middlewares/validate-JWT.js';
import {
  createAdminRestaurantUser,
  findUserById,
  updateUserProfile,
  changeUserPassword,
  deleteUserAccount,
} from '../../helpers/user-db.js';
import {
  getUserRoleNames,
  getUsersByRole as repoGetUsersByRole,
  setUserSingleRole,
} from '../../helpers/role-db.js';
import { ALLOWED_ROLES, ADMIN_ROLE, ADMIN_RESTAURANT_ROLE } from '../../helpers/role-constants.js';
import { buildUserResponse } from '../../utils/user-helpers.js';
import { sequelize } from '../../configs/db.js';
import { validateCreateAdminRestaurant } from '../../middlewares/validation.js';
import { hashPassword } from '../../utils/password-utils.js';
import { sendRestaurantAssignmentEmail } from '../../helpers/email-service.js';

const ensureAdmin = async (req) => {
  const currentUserId = req.userId;
  if (!currentUserId) return false;
  const roles =
    req.user?.UserRoles?.map((ur) => ur.Role?.Name).filter(Boolean) ??
    (await getUserRoleNames(currentUserId));
  return roles.includes(ADMIN_ROLE);
};

const ensureAdminOrRestaurantAdmin = async (req) => {
  const currentUserId = req.userId;
  if (!currentUserId) return false;
  const roles =
    req.user?.UserRoles?.map((ur) => ur.Role?.Name).filter(Boolean) ??
    (await getUserRoleNames(currentUserId));
  return roles.includes(ADMIN_ROLE) || roles.includes(ADMIN_RESTAURANT_ROLE);
};

export const updateUserRole = [
  validateJWT,
  asyncHandler(async (req, res) => {
    if (!(await ensureAdmin(req))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { userId } = req.params;
    const { roleName } = req.body || {};

    const normalized = (roleName || '').trim().toUpperCase();
    if (!ALLOWED_ROLES.includes(normalized)) {
      return res.status(400).json({
        success: false,
        message:
          'Role not allowed. Use ADMIN_ROLE, USER_ROLE or ADMIN_RESTAURANT',
      });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const { updatedUser } = await setUserSingleRole(
      user,
      normalized,
      sequelize
    );

    return res.status(200).json(buildUserResponse(updatedUser));
  }),
];

export const getUserRoles = [
  validateJWT,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const roles = await getUserRoleNames(userId);
    return res.status(200).json(roles);
  }),
];

export const getUsersByRole = [
  validateJWT,
  asyncHandler(async (req, res) => {
    if (!(await ensureAdminOrRestaurantAdmin(req))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { roleName } = req.params;
    const normalized = (roleName || '').trim().toUpperCase();
    if (!ALLOWED_ROLES.includes(normalized)) {
      return res.status(400).json({
        success: false,
        message:
          'Role not allowed. Use ADMIN_ROLE, USER_ROLE or ADMIN_RESTAURANT',
      });
    }

    const users = await repoGetUsersByRole(normalized);
    const payload = users.map(buildUserResponse);
    return res.status(200).json(payload);
  }),
];

export const createAdminRestaurant = [
  validateJWT,
  ...validateCreateAdminRestaurant,
  asyncHandler(async (req, res) => {
    if (!(await ensureAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Acceso restringido solo para ADMIN_ROLE',
      });
    }

    const { name, email, password, phone, profilePicture } = req.body;

    try {
      const createdUser = await createAdminRestaurantUser({
        name,
        email,
        password,
        phone,
        profilePicture,
      });

      return res.status(201).json({
        success: true,
        message: 'Administrador de restaurante creado exitosamente',
        user: buildUserResponse(createdUser),
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        message: error.message || 'No se pudo crear el administrador',
      });
    }
  }),
];

export const updateProfile = [
  validateJWT,
  asyncHandler(async (req, res) => {
    try {
      const userId = req.userId;
      const { name, email, phone, address } = req.body;

      // Validaciones básicas
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: 'Nombre y email son requeridos',
        });
      }

      if (phone && !/^\d{8}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'El teléfono debe tener exactamente 8 dígitos',
        });
      }

      const updatedUser = await updateUserProfile(userId, {
        name,
        email,
        phone,
        address,
        profilePicture: req.file ? req.file.path : null,
      });

      return res.status(200).json({
        success: true,
        message: 'Perfil actualizado correctamente',
        user: buildUserResponse(updatedUser),
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        message: error.message || 'Error al actualizar perfil',
      });
    }
  }),
];

export const updatePasswordController = [
  validateJWT,
  asyncHandler(async (req, res) => {
    try {
      const userId = req.userId;
      const { currentPassword, newPassword } = req.body;

      // Validaciones
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva son requeridas',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 8 caracteres',
        });
      }

      const newHashedPassword = await hashPassword(newPassword);
      await changeUserPassword(userId, currentPassword, newHashedPassword);

      return res.status(200).json({
        success: true,
        message: 'Contraseña actualizada correctamente',
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        message: error.message || 'Error al cambiar contraseña',
      });
    }
  }),
];

export const deleteAccountController = [
  validateJWT,
  asyncHandler(async (req, res) => {
    try {
      const userId = req.userId;

      await deleteUserAccount(userId);

      return res.status(200).json({
        success: true,
        message: 'Cuenta eliminada correctamente',
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        message: error.message || 'Error al eliminar cuenta',
      });
    }
  }),
];

export const sendAssignmentNotification = [
  validateJWT,
  asyncHandler(async (req, res) => {
    if (!(await ensureAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Acceso restringido solo para ADMIN_ROLE',
      });
    }

    const { userId, restaurantName } = req.body;

    if (!userId || !restaurantName) {
      return res.status(400).json({
        success: false,
        message: 'userId y restaurantName son requeridos',
      });
    }

    try {
      const user = await findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
      }

      await sendRestaurantAssignmentEmail(user.Email, user.Name, restaurantName);

      return res.status(200).json({
        success: true,
        message: 'Email de asignación enviado exitosamente',
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        message: error.message || 'Error al enviar email de asignación',
      });
    }
  }),
];
