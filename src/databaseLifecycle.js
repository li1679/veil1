import { clearExpiredCache } from './cacheHelper.js';
import { ensureIntegritySchema } from './databaseIntegrity.js';
import {
  REQUIRED_SCHEMA,
  createSchemaIndexes,
  createSchemaTables,
  validateRequiredSchema
} from './databaseSchema.js';

const initializations = new WeakMap();

export async function initDatabase(db) {
  clearExpiredCache(db);
  let initialization = initializations.get(db);
  if (!initialization) {
    initialization = performFirstTimeSetup(db).catch((error) => {
      initializations.delete(db);
      console.error('数据库初始化失败:', error);
      throw error;
    });
    initializations.set(db, initialization);
  }
  await initialization;
}

async function performFirstTimeSetup(db) {
  if (!(await hasRequiredTables(db))) {
    await createSchemaTables(db);
  }
  await ensureIntegritySchema(db);
  await validateRequiredSchema(db);
  await createSchemaIndexes(db);
  await db.exec('PRAGMA foreign_keys = ON;');
}

async function hasRequiredTables(db) {
  try {
    for (const table of Object.keys(REQUIRED_SCHEMA)) {
      await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).all();
    }
    return true;
  } catch (_) {
    return false;
  }
}

export async function setupDatabase(db) {
  await createSchemaTables(db);
  await ensureIntegritySchema(db);
  await validateRequiredSchema(db);
  await createSchemaIndexes(db);
  await db.exec('PRAGMA foreign_keys = ON;');
}
