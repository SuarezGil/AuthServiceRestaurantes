import { Role } from '../src/auth/role.model.js';
import { User, UserProfile, UserEmail } from '../src/users/user.model.js';
import { UserRole } from '../src/auth/role.model.js';
import {
  USER_ROLE,
  ADMIN_ROLE,
  ADMIN_RESTAURANT_ROLE,
} from './role-constants.js';
import { generateUserId } from './uuid-generator.js';
import { hashPassword } from '../utils/password-utils.js';

export const seedData = async () => {
  // Crear roles si no existen
  const roles = [ADMIN_ROLE, USER_ROLE, ADMIN_RESTAURANT_ROLE];
  for (const name of roles) {
    await Role.findOrCreate({
      where: { Name: name },
      defaults: { Id: generateUserId(), Name: name },
    });
  }

  // Seed de usuarios por defecto
  const seedUsers = [
    {
      name: 'Admin',
      email: 'admin@gestor.local',
      password: 'Admin1234!',
      phone: '39539423',
      roleName: ADMIN_ROLE,
    },
    {
      name: 'Usuario Por Defecto',
      email: 'user@gestor.local',
      password: 'User1234!',
      phone: '00000000',
      roleName: USER_ROLE,
    },
    {
      name: 'Cliente Test',
      email: 'cliente@gestor.local',
      password: 'Cliente1234!',
      phone: '00000000',
      roleName: USER_ROLE,
    },
  ];

  for (const seed of seedUsers) {
    const existing = await User.findOne({ where: { Email: seed.email } });
    if (existing) continue;

    const role = await Role.findOne({ where: { Name: seed.roleName } });
    if (!role) continue;

    const userId = generateUserId();
    const password = await hashPassword(seed.password);

    await User.create({
      Id: userId,
      Name: seed.name,
      Email: seed.email,
      Password: password,
      IsActive: true,
    });

    await UserProfile.create({
      Id: generateUserId(),
      UserId: userId,
      Imagen: '',
      Phone: seed.phone,
    });

    await UserEmail.create({
      Id: generateUserId(),
      UserId: userId,
      EmailVerified: true,
      EmailVerificationToken: null,
      EmailVerificationTokenExpiry: null,
    });

    await UserRole.create({
      Id: generateUserId(),
      UserId: userId,
      RoleId: role.Id,
    });
  }
};
