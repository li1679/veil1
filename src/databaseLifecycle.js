import { clearExpiredCache } from './cacheHelper.js';
import {
  REQUIRED_SCHEMA,
  createSchemaIndexes,
  createSchemaTables,
  validateRequiredSchema
} from './databaseSchema.js';

let isFirstInit = true;

export async function initDatabase(db) {
  try {
    clearExpiredCache();
    if (isFirstInit) {
      await performFirstTimeSetup(db);
      isFirstInit = false;
      return;
    }
    await db.exec('PRAGMA foreign_keys = ON;');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

async function performFirstTimeSetup(db) {
  if (!(await hasRequiredTables(db))) {
    await createSchemaTables(db);
  }
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
  await validateRequiredSchema(db);
  await createSchemaIndexes(db);
  await db.exec('PRAGMA foreign_keys = ON;');
}
