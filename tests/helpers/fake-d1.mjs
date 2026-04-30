import assert from 'node:assert/strict';

export function createFakeD1(handlers = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return createStatement(sql, handlers, calls);
    },
  };
}

function createStatement(sql, handlers, calls) {
  return {
    params: [],
    bind(...params) {
      this.params = params;
      return this;
    },
    async all() {
      calls.push({ op: 'all', sql, params: this.params });
      return normalizeAllResult(await runHandler(handlers, 'all', sql, this.params));
    },
    async run() {
      calls.push({ op: 'run', sql, params: this.params });
      return normalizeRunResult(await runHandler(handlers, 'run', sql, this.params));
    },
  };
}

async function runHandler(handlers, op, sql, params) {
  const handler = handlers.find((item) => matchesHandler(item, op, sql, params));
  if (!handler) throw new Error(`Unhandled D1 ${op}: ${compactSql(sql)} params=${JSON.stringify(params)}`);
  const resolver = handler[op] ?? handler.result;
  if (typeof resolver === 'function') return await resolver({ sql, params, op });
  return resolver;
}

function matchesHandler(handler, op, sql, params) {
  if (handler.op && handler.op !== op) return false;
  if (typeof handler.match === 'function') return handler.match({ sql, params, op });
  if (handler.match instanceof RegExp) return handler.match.test(compactSql(sql));
  return compactSql(sql).includes(String(handler.match || ''));
}

function normalizeAllResult(result) {
  if (Array.isArray(result)) return { results: result };
  if (result && typeof result === 'object') return result;
  return { results: [] };
}

function normalizeRunResult(result) {
  if (typeof result === 'number') return { meta: { changes: result } };
  if (result && typeof result === 'object') return result;
  return { meta: { changes: 0 } };
}

export function compactSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

export async function assertResponseText(response, status, expectedText) {
  assert.equal(response.status, status);
  assert.match(await response.text(), expectedText);
}
