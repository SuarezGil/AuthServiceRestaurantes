import dotenv from 'dotenv';
import { initServer } from './configs/app.js';
import { sequelize } from './configs/db.js';
import './src/users/user.model.js';
import './src/auth/role.model.js';
import { seedData } from './helpers/data-seeder.js';

// Configurar variables de entorno
dotenv.config();

await sequelize.authenticate();
await sequelize.sync({ alter: true });

await seedData();

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

// Inicializar servidor
initServer();
