import { Router } from 'express';
import {
  updateUserRole,
  getUserRoles,
  getUsersByRole,
  createAdminRestaurant,
  updateProfile,
  updatePasswordController,
  deleteAccountController,
  sendAssignmentNotification,
} from './user.controller.js';

import { validateJWT } from '../../middlewares/validate-JWT.js';
import { upload, handleUploadError } from '../../helpers/file-upload.js';
import { findUserById } from '../../helpers/user-db.js';
import { User } from './user.model.js';
import { UserProfile, UserEmail } from './user.model.js';
import { UserRole, Role } from '../auth/role.model.js';
import { ADMIN_ROLE, ADMIN_RESTAURANT_ROLE } from '../../helpers/role-constants.js';

const router = Router();

// PUT /api/v1/users/profile - Update user profile (foto opcional)
router.put('/profile', upload.single('profilePicture'), handleUploadError, ...updateProfile);

// POST /api/v1/users/change-password - Change password
router.post('/change-password', ...updatePasswordController);

// DELETE /api/v1/users/account - Delete account
router.delete('/account', ...deleteAccountController);

// POST /api/v1/users/admin-restaurant
router.post('/admin-restaurant', ...createAdminRestaurant);

// POST /api/v1/users/send-assignment-notification
router.post('/send-assignment-notification', ...sendAssignmentNotification);

// GET /api/v1/users/all
router.get('/all', validateJWT, async (req, res) => {
  // Verificar que el usuario sea admin
  const user = req.user;
  const roles = user.UserRoles?.map((ur) => ur.Role?.Name) || [];
  if (!roles.includes(ADMIN_ROLE) && !roles.includes(ADMIN_RESTAURANT_ROLE) && !roles.includes('ADMIN_RESTAURANTE')) {
    return res.status(403).json({ success: false, message: 'Acceso restringido.' });
  }

  // Obtener todos los usuarios con relaciones
  const users = await User.findAll({
    include: [
      { model: UserProfile, as: 'UserProfile' },
      { model: UserEmail, as: 'UserEmail' },
      {
        model: UserRole,
        as: 'UserRoles',
        include: [{ model: Role, as: 'Role' }],
      },
    ],
  });

  return res.status(200).json({ success: true, users });
});

// GET /api/v1/users/by-role/:roleName
router.get('/by-role/:roleName', ...getUsersByRole);

// PUT /api/v1/users/:userId/role
router.put('/:userId/role', ...updateUserRole);

// GET /api/v1/users/:userId/roles
router.get('/:userId/roles', ...getUserRoles);

// PATCH /api/v1/users/:userId/toggle-active
router.patch('/:userId/toggle-active', validateJWT, async (req, res) => {
  const user = req.user;
  const roles = user.UserRoles?.map((ur) => ur.Role?.Name) || [];
  if (!roles.includes(ADMIN_ROLE)) {
    return res.status(403).json({ success: false, message: 'Acceso restringido solo para administradores.' });
  }

  const { userId } = req.params;
  const targetUser = await User.findByPk(userId);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
  }

  await targetUser.update({ IsActive: !targetUser.IsActive });

  return res.status(200).json({
    success: true,
    message: `Usuario ${targetUser.IsActive ? 'activado' : 'desactivado'} correctamente.`,
    isActive: targetUser.IsActive,
  });
});

export default router;
