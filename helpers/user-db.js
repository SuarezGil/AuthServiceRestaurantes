import crypto from 'crypto';
import path from 'path';
import {
  User,
  UserProfile,
  UserEmail,
  UserPasswordReset,
} from '../src/users/user.model.js';
import { UserRole, Role } from '../src/auth/role.model.js';
import {
  USER_ROLE,
  ADMIN_RESTAURANT_ROLE,
} from './role-constants.js';
import { hashPassword } from '../utils/password-utils.js';
import { uploadImage } from './cloudinary-service.js';
import { Op } from 'sequelize';

/**
 * Helper para buscar un usuario por email
 * @param {string} email - Email del usuario
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export const findUserByEmailOrUsername = async (email) => {
  try {
    const user = await User.findOne({
      where: {
        Email: email.toLowerCase()
      },
      include: [
        { model: UserProfile, as: 'UserProfile' },
        { model: UserEmail, as: 'UserEmail' },
        { model: UserPasswordReset, as: 'UserPasswordReset' },
        {
          model: UserRole,
          as: 'UserRoles',
          include: [{ model: Role, as: 'Role' }],
        },
      ],
    });

    return user;
  } catch (error) {
    console.error('Error buscando usuario:', error);
    throw new Error('Error al buscar usuario');
  }
};

export const findUserById = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      include: [
        { model: UserProfile, as: 'UserProfile' },
        { model: UserEmail, as: 'UserEmail' },
        { model: UserPasswordReset, as: 'UserPasswordReset' },
        {
          model: UserRole,
          as: 'UserRoles',
          include: [{ model: Role, as: 'Role' }],
        },
      ],
    });

    return user;
  } catch (error) {
    console.error('Error buscando usuario por ID:', error);
    throw new Error('Error al buscar usuario');
  }
};

export const checkUserExists = async (email) => {
  try {
    const existingUser = await User.findOne({
      where: {
        Email: email.toLowerCase()
      },
    });

    return !!existingUser;
  } catch (error) {
    console.error('Error verificando si el usuario existe:', error);
    throw new Error('Error al verificar usuario');
  }
};

export const createNewUser = async (userData) => {
  const transaction = await User.sequelize.transaction();

  try {
    const { name, email, password, phone, profilePicture } = userData;

    const hashedPassword = await hashPassword(password);

    // Crear el usuario principal
    const user = await User.create(
      {
        Name: name,
        Email: email.toLowerCase(),
        Password: hashedPassword,
        IsActive: false, // Empieza inactivo hasta que verifique el email
      },
      { transaction }
    );

    // Crear el perfil del usuario
    const { getDefaultAvatarPath } = await import(
      '../helpers/cloudinary-service.js'
    );
    const defaultAvatarFilename = getDefaultAvatarPath();

    await UserProfile.create(
      {
        UserId: user.Id,
        Phone: phone,
        Imagen: profilePicture || defaultAvatarFilename,
      },
      { transaction }
    );

    // Crear el registro de email
    await UserEmail.create(
      {
        UserId: user.Id,
        EmailVerified: false,
      },
      { transaction }
    );

    // Crear el registro de reset de contraseña
    await UserPasswordReset.create(
      {
        UserId: user.Id,
      },
      { transaction }
    );

    // Asignar rol USER_ROLE por defecto
    const userRole = await Role.findOne(
      { where: { Name: USER_ROLE } },
      { transaction }
    );
    if (userRole) {
      await UserRole.create(
        {
          UserId: user.Id,
          RoleId: userRole.Id,
        },
        { transaction }
      );
    } else {
      console.warn(
        `USER_ROLE not found in database during user creation for user ${user.Id}`
      );
    }

    await transaction.commit();

    // Obtener el usuario completo con todas las relaciones
    const completeUser = await findUserById(user.Id);
    return completeUser;
  } catch (error) {
    await transaction.rollback();
    console.error('Error creando usuario:', error);
    throw new Error('Error al crear usuario');
  }
};

export const updateEmailVerificationToken = async (userId, token, expiry) => {
  try {
    await UserEmail.update(
      {
        EmailVerificationToken: token,
        EmailVerificationTokenExpiry: expiry,
      },
      {
        where: { UserId: userId },
      }
    );
  } catch (error) {
    console.error('Error actualizando token de verificación:', error);
    throw new Error('Error al actualizar token de verificación');
  }
};

export const markEmailAsVerified = async (userId) => {
  const transaction = await User.sequelize.transaction();

  try {
    // Marcar email como verificado
    await UserEmail.update(
      {
        EmailVerified: true,
        EmailVerificationToken: null,
        EmailVerificationTokenExpiry: null,
      },
      {
        where: { UserId: userId },
        transaction,
      }
    );

    // Activar el usuario
    await User.update(
      {
        IsActive: true,
      },
      {
        where: { Id: userId },
        transaction,
      }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('Error marcando email como verificado:', error);
    throw new Error('Error al verificar email');
  }
};

export const updatePasswordResetToken = async (userId, token, expiry) => {
  try {
    await UserPasswordReset.update(
      {
        PasswordResetToken: token,
        PasswordResetTokenExpiry: expiry,
      },
      {
        where: { UserId: userId },
      }
    );
  } catch (error) {
    console.error('Error actualizando token de reset:', error);
    throw new Error('Error al actualizar token de reset');
  }
};

export const findUserByEmail = async (email) => {
  try {
    const user = await User.findOne({
      where: { Email: email.toLowerCase() },
      include: [
        { model: UserProfile, as: 'UserProfile' },
        { model: UserEmail, as: 'UserEmail' },
        { model: UserPasswordReset, as: 'UserPasswordReset' },
        {
          model: UserRole,
          as: 'UserRoles',
          include: [{ model: Role, as: 'Role' }],
        },
      ],
    });

    return user;
  } catch (error) {
    console.error('Error buscando usuario por email:', error);
    throw new Error('Error al buscar usuario');
  }
};

/**
 * Helper para buscar un usuario por token de verificación de email (matching .NET)
 * @param {string} token - Token de verificación de email
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export const findUserByEmailVerificationToken = async (token) => {
  try {
    const user = await User.findOne({
      include: [
        {
          model: UserEmail,
          as: 'UserEmail',
          where: {
            EmailVerificationToken: token,
            EmailVerificationTokenExpiry: {
              [Op.gt]: new Date(), // Token no expirado
            },
          },
        },
        {
          model: UserProfile,
          as: 'UserProfile',
        },
        {
          model: UserPasswordReset,
          as: 'UserPasswordReset',
        },
      ],
    });

    return user;
  } catch (error) {
    console.error('Error buscando usuario por token de verificación:', error);
    throw new Error('Error al buscar usuario');
  }
};

/**
 * Helper para buscar un usuario por token de reset de password (matching .NET)
 * @param {string} token - Token de reset de password
 * @returns {Promise<Object|null>} Usuario encontrado o null
 */
export const findUserByPasswordResetToken = async (token) => {
  try {
    const user = await User.findOne({
      include: [
        {
          model: UserPasswordReset,
          as: 'UserPasswordReset',
          where: {
            PasswordResetToken: token,
            PasswordResetTokenExpiry: {
              [Op.gt]: new Date(), // Token no expirado
            },
          },
        },
        {
          model: UserProfile,
          as: 'UserProfile',
        },
        {
          model: UserEmail,
          as: 'UserEmail',
        },
      ],
    });

    return user;
  } catch (error) {
    console.error('Error buscando usuario por token de reset:', error);
    throw new Error('Error al buscar usuario');
  }
};

export const updateUserPassword = async (userId, hashedPassword) => {
  const transaction = await User.sequelize.transaction();

  try {
    // Actualizar contraseña
    await User.update(
      {
        Password: hashedPassword,
      },
      {
        where: { Id: userId },
        transaction,
      }
    );

    // Limpiar token de reset
    await UserPasswordReset.update(
      {
        PasswordResetToken: null,
        PasswordResetTokenExpiry: null,
      },
      {
        where: { UserId: userId },
        transaction,
      }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('Error actualizando contraseña:', error);
    throw new Error('Error al actualizar contraseña');
  }
};

export const createAdminRestaurantUser = async (userData) => {
  const transaction = await User.sequelize.transaction();

  try {
    const { name, email, password, phone, profilePicture } = userData;

    const existingUser = await User.findOne({
      where: { Email: email.toLowerCase() },
      transaction,
    });

    if (existingUser) {
      const err = new Error('Ya existe un usuario con este email');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create(
      {
        Name: name,
        Email: email.toLowerCase(),
        Password: hashedPassword,
        IsActive: true,
      },
      { transaction }
    );

    const { getDefaultAvatarPath } = await import('./cloudinary-service.js');
    const defaultAvatarFilename = getDefaultAvatarPath();

    await UserProfile.create(
      {
        UserId: user.Id,
        Phone: phone,
        Imagen: profilePicture || defaultAvatarFilename,
      },
      { transaction }
    );

    await UserEmail.create(
      {
        UserId: user.Id,
        EmailVerified: true,
        EmailVerificationToken: null,
        EmailVerificationTokenExpiry: null,
      },
      { transaction }
    );

    await UserPasswordReset.create(
      {
        UserId: user.Id,
      },
      { transaction }
    );

    const role = await Role.findOne(
      { where: { Name: ADMIN_RESTAURANT_ROLE } },
      { transaction }
    );

    if (!role) {
      const err = new Error(
        'El rol ADMIN_RESTAURANT no existe en la base de datos'
      );
      err.status = 500;
      throw err;
    }

    await UserRole.create(
      {
        UserId: user.Id,
        RoleId: role.Id,
      },
      { transaction }
    );

    await transaction.commit();

    return findUserById(user.Id);
  } catch (error) {
    await transaction.rollback();
    if (!error.status) {
      console.error('Error creando ADMIN_RESTAURANT:', error);
      error.status = 500;
      error.message = 'Error al crear administrador de restaurante';
    }
    throw error;
  }
};

export const updateUserProfile = async (userId, profileData) => {
  const transaction = await User.sequelize.transaction();

  try {
    const { name, email, phone, address, profilePicture } = profileData;

    // Verificar si el nuevo email ya existe (si es diferente)
    if (email) {
      const existingUser = await User.findOne({
        where: {
          Email: email.toLowerCase(),
          Id: { [Op.ne]: userId },
        },
      });

      if (existingUser) {
        const err = new Error('El email ya está registrado por otro usuario');
        err.status = 409;
        throw err;
      }
    }

    // Actualizar datos del usuario
    await User.update(
      {
        Name: name,
        Email: email ? email.toLowerCase() : undefined,
      },
      {
        where: { Id: userId },
        transaction,
      }
    );

    // Si viene una foto nueva (archivo local subido por multer), súbela a
    // Cloudinary igual que en el registro y guarda solo el nombre resultante.
    let imagenToStore;
    if (profilePicture) {
      try {
        const ext = path.extname(profilePicture);
        const randomHex = crypto.randomBytes(6).toString('hex');
        const cloudinaryFileName = `profile-${randomHex}${ext}`;
        imagenToStore = await uploadImage(profilePicture, cloudinaryFileName);
      } catch (err) {
        console.error('Error subiendo foto de perfil en actualización:', err);
      }
    }

    // Actualizar perfil del usuario
    if (phone || address !== undefined || imagenToStore) {
      const profileUpdates = { Phone: phone, Address: address };
      if (imagenToStore) profileUpdates.Imagen = imagenToStore;
      await UserProfile.update(profileUpdates, {
        where: { UserId: userId },
        transaction,
      });
    }

    await transaction.commit();

    return findUserById(userId);
  } catch (error) {
    await transaction.rollback();
    if (!error.status) {
      console.error('Error actualizando perfil:', error);
      error.status = 500;
      error.message = 'Error al actualizar perfil';
    }
    throw error;
  }
};

export const changeUserPassword = async (userId, currentPassword, newHashedPassword) => {
  const transaction = await User.sequelize.transaction();

  try {
    // Obtener usuario actual
    const user = await User.findByPk(userId);
    if (!user) {
      const err = new Error('Usuario no encontrado');
      err.status = 404;
      throw err;
    }

    // Verificar contraseña actual
    const { verifyPassword } = await import('../utils/password-utils.js');
    const passwordMatch = await verifyPassword(user.Password, currentPassword);

    if (!passwordMatch) {
      const err = new Error('Contraseña actual incorrecta');
      err.status = 401;
      throw err;
    }

    // Actualizar contraseña
    await User.update(
      {
        Password: newHashedPassword,
      },
      {
        where: { Id: userId },
        transaction,
      }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if (!error.status) {
      console.error('Error cambiando contraseña:', error);
      error.status = 500;
      error.message = 'Error al cambiar contraseña';
    }
    throw error;
  }
};

export const deleteUserAccount = async (userId) => {
  const transaction = await User.sequelize.transaction();

  try {
    // Eliminar roles del usuario
    await UserRole.destroy(
      {
        where: { UserId: userId },
        transaction,
      }
    );

    // Eliminar perfil del usuario
    await UserProfile.destroy(
      {
        where: { UserId: userId },
        transaction,
      }
    );

    // Eliminar email del usuario
    await UserEmail.destroy(
      {
        where: { UserId: userId },
        transaction,
      }
    );

    // Eliminar reset de contraseña
    await UserPasswordReset.destroy(
      {
        where: { UserId: userId },
        transaction,
      }
    );

    // Eliminar usuario
    await User.destroy(
      {
        where: { Id: userId },
        transaction,
      }
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('Error eliminando cuenta:', error);
    error.status = error.status || 500;
    error.message = error.message || 'Error al eliminar cuenta';
    throw error;
  }
};
