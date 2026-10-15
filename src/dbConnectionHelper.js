const DATABASE_BINDINGS = ['TEMP_MAIL_DB', 'DB', 'DATABASE', 'D1_DB', 'MAIL_DB', 'MAILFREE_DB', 'TEMPMAIL_DB'];
const validationCache = new WeakMap();
const VALIDATION_TTL_MS = 5 * 60 * 1000;

export function getDatabase(env) {
  for (const name of DATABASE_BINDINGS) {
    if (typeof env[name]?.prepare === 'function') return env[name];
  }
  return Object.values(env).find((value) => typeof value?.prepare === 'function') || null;
}

export async function validateDatabaseConnection(db) {
  if (!db) return false;
  try {
    await db.prepare('SELECT 1').all();
    return true;
  } catch (error) {
    console.error('Database connection validation failed:', error);
    return false;
  }
}

export async function getDatabaseWithValidation(env) {
  const db = getDatabase(env);
  if (!db) throw new Error('Missing D1 database binding');
  const cached = validationCache.get(db);
  if (cached && Date.now() - cached.timestamp < VALIDATION_TTL_MS) {
    await cached.promise;
    return db;
  }
  const promise = validateDatabaseConnection(db).then((valid) => {
    if (!valid) {
      validationCache.delete(db);
      throw new Error('Database connection validation failed');
    }
  });
  validationCache.set(db, { timestamp: Date.now(), promise });
  await promise;
  return db;
}
