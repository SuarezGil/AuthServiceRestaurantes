import { DataTypes } from 'sequelize';
import { sequelize } from '../../configs/db.js';
import { generateUserId } from '../../helpers/uuid-generator.js';

// Modelo User simplificado basado en esquema Mongoose
export const User = sequelize.define(
  'User',
  {
    Id: {
      type: DataTypes.STRING(16),
      primaryKey: true,
      field: 'id',
      defaultValue: () => generateUserId(),
    },
    Name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'name',
      validate: {
        notEmpty: { msg: 'El nombre es requerido' },
        len: {
          args: [1, 100],
          msg: 'El nombre no puede exceder 100 caracteres',
        },
      },
    },
    Email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'email',
      validate: {
        notEmpty: { msg: 'El email es requerido' },
        isEmail: { msg: 'El email no tiene un formato válido' },
      },
    },
    Password: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password',
      validate: {
        notEmpty: { msg: 'La contraseña es requerida' },
      },
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['is_active'] },
    ],
  }
);

// Modelo UserProfile (con Imagen para almacenar la foto de perfil)
export const UserProfile = sequelize.define(
  'UserProfile',
  {
    Id: {
      type: DataTypes.STRING(16),
      primaryKey: true,
      field: 'id',
      defaultValue: () => generateUserId(),
    },
    UserId: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'user_id',
      references: {
        model: User,
        key: 'id',
      },
    },
    Imagen: {
      type: DataTypes.STRING,
      defaultValue: null,
      field: 'imagen',
    },
    Phone: {
      type: DataTypes.STRING(8),
      allowNull: false,
      field: 'phone',
      validate: {
        notEmpty: { msg: 'El número de teléfono es obligatorio.' },
        len: {
          args: [8, 8],
          msg: 'El número de teléfono debe tener exactamente 8 dígitos.',
        },
        isNumeric: { msg: 'El teléfono solo debe contener números.' },
      },
    },
    Address: {
      type: DataTypes.TEXT,
      defaultValue: null,
      field: 'address',
    },
  },
  {
    tableName: 'user_profiles',
    timestamps: false,
  }
);

// Modelo UserEmail (equivalente a UserEmail.cs en .NET) - usando snake_case
export const UserEmail = sequelize.define(
  'UserEmail',
  {
    Id: {
      type: DataTypes.STRING(16),
      primaryKey: true,
      field: 'id',
      defaultValue: () => generateUserId(),
    },
    UserId: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'user_id',
      references: {
        model: User,
        key: 'id',
      },
    },
    EmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'email_verified',
    },
    EmailVerificationToken: {
      type: DataTypes.STRING(256),
      allowNull: true,
      field: 'email_verification_token',
    },
    EmailVerificationTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_verification_token_expiry',
    },
  },
  {
    tableName: 'user_emails',
    timestamps: false,
  }
);

// Modelo UserPasswordReset (equivalente a UserPasswordReset.cs en .NET) - usando snake_case
export const UserPasswordReset = sequelize.define(
  'UserPasswordReset',
  {
    Id: {
      type: DataTypes.STRING(16),
      primaryKey: true,
      field: 'id',
      defaultValue: () => generateUserId(),
    },
    UserId: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'user_id',
      references: {
        model: User,
        key: 'id',
      },
    },
    PasswordResetToken: {
      type: DataTypes.STRING(256),
      allowNull: true,
      field: 'password_reset_token',
    },
    PasswordResetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_reset_token_expiry',
    },
  },
  {
    tableName: 'user_password_resets',
    timestamps: false,
  }
);

// Definir las relaciones (equivalente a las navigation properties en .NET)
User.hasOne(UserProfile, { foreignKey: 'user_id', as: 'UserProfile' });
UserProfile.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

User.hasOne(UserEmail, { foreignKey: 'user_id', as: 'UserEmail' });
UserEmail.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

User.hasOne(UserPasswordReset, {
  foreignKey: 'user_id',
  as: 'UserPasswordReset',
});
UserPasswordReset.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
