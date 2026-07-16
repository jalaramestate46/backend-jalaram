const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.service_role;

// ─────────────────────────────────────────────────────────
// Helper: create mock proxy when Supabase is not configured
// ─────────────────────────────────────────────────────────
const createMockChain = () => {
  const chain = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
    'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
    'range', 'order', 'limit', 'single', 'maybeSingle',
    'csv', 'auth', 'storage', 'from'
  ];

  chainMethods.forEach(method => {
    chain[method] = () => createMockChain();
  });

  chain.then = (resolve, reject) => {
    const err = new Error(
      'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY in your .env file.'
    );
    if (reject) reject(err);
    else throw err;
  };

  return chain;
};

const createMockClient = (label) => {
  console.warn(`[Supabase] ${label} client is NOT configured — running in mock/fallback mode.`);
  return new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'from') return () => createMockChain();
      if (prop === 'storage') return createMockChain();
      return () => {
        const msg = `[Supabase ${label}] Tried to access '${String(prop)}' but credentials are not set.`;
        console.error(msg);
        throw new Error(msg);
      };
    }
  });
};

// ─────────────────────────────────────────────────────────
// Anon client  (public / read operations)
// ─────────────────────────────────────────────────────────
let supabaseClient;
const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

if (isConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    console.log('[Supabase] Anon client initialized successfully.');
  } catch (err) {
    console.error('[Supabase] Failed to initialize anon client:', err.message);
  }
}

if (!supabaseClient) {
  console.warn('************************************************************************');
  console.warn(' WARNING: SUPABASE_URL or SUPABASE_KEY is missing / invalid.');
  console.warn(' Backend running in fallback/mock mode for anon client.');
  console.warn('************************************************************************');
  supabaseClient = createMockClient('anon');
}

// ─────────────────────────────────────────────────────────
// Admin client  (service role — bypasses RLS)
// Used for: writes, deletes, storage uploads, admin queries
// ─────────────────────────────────────────────────────────
let supabaseAdminClient;
const isAdminConfigured = !!(supabaseUrl && supabaseServiceRoleKey && supabaseUrl.startsWith('http'));

if (isAdminConfigured) {
  try {
    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[Supabase] Admin (service role) client initialized successfully.');
  } catch (err) {
    console.error('[Supabase] Failed to initialize admin client:', err.message);
  }
}

if (!supabaseAdminClient) {
  console.warn('[Supabase] service_role key is missing — admin client running in mock mode.');
  supabaseAdminClient = createMockClient('admin');
}

module.exports = {
  supabase: supabaseClient,          // anon key  — public reads
  supabaseAdmin: supabaseAdminClient, // service role — writes / admin ops
  isConfigured,
  isAdminConfigured
};
