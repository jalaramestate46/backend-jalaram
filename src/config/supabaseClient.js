const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabaseClient;
const isConfigured = !!(supabaseUrl && supabaseKey && supabaseUrl.startsWith('http'));

if (isConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    console.log("Supabase Client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize real Supabase client:", error.message);
  }
}

if (!supabaseClient) {
  console.warn("************************************************************************");
  console.warn(" WARNING: Supabase URL or Key is missing / invalid in .env file.");
  console.warn(" The backend is running in dynamic warning mode.");
  console.warn(" Configure SUPABASE_URL and SUPABASE_KEY in backend/.env to connect.");
  console.warn("************************************************************************");

  // Create a handler proxy to catch calls and throw a clean error when queried
  const throwNotConfigured = (propName) => {
    return () => {
      const msg = `Database query error: Tried to access '${propName}' but Supabase credentials are not configured in your backend .env file.`;
      console.error(msg);
      throw new Error(msg);
    };
  };

  // Mock builder pattern for Supabase JS client
  const createMockChain = () => {
    const chain = {};
    const chainMethods = [
      'select', 'insert', 'update', 'delete', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
      'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'range', 'order', 'limit',
      'single', 'maybeSingle', 'csv', 'auth', 'storage', 'from'
    ];

    chainMethods.forEach(method => {
      chain[method] = () => {
        if (method === 'from') {
          return createMockChain();
        }
        return createMockChain();
      };
    });

    // Terminating then promise handler
    chain.then = (resolve, reject) => {
      const err = new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY in your .env file.");
      if (reject) {
        reject(err);
      } else {
        throw err;
      }
    };

    return chain;
  };

  supabaseClient = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'from') {
        return () => createMockChain();
      }
      return throwNotConfigured(String(prop));
    }
  });
}

module.exports = {
  supabase: supabaseClient,
  isConfigured
};
