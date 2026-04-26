/**
 * auth.js
 * Autenticación via Supabase — Google OAuth + email/password.
 */

'use strict';

const SUPABASE_URL     = 'https://eaxgglyisbttauyzygen.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheGdnbHlpc2J0dGF1eXp5Z2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTMyODIsImV4cCI6MjA5MjcyOTI4Mn0.Jb4BuJZkqMQW2CbErTt8ouBVY8ILztu2tJ4TIf97CU0';

// ── Cliente Supabase (singleton compartido con data.js) ───────────────────────

let _supabase = null;

function getSupabaseClient() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ── Estado de sesión ──────────────────────────────────────────────────────────

let _currentUser = null;
const _authListeners = [];

function onAuthChange(callback) {
  _authListeners.push(callback);
  callback(_currentUser);
}

function _notifyListeners(user) {
  _currentUser = user;
  _authListeners.forEach(fn => fn(user));
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Login con email y contraseña. */
async function authLogin(email, password) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

/** Login con Google (redirige al proveedor). */
async function authLoginGoogle() {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** Registra un usuario nuevo con email/contraseña. */
async function authRegister(email, password, nombre) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });
  if (error) return { user: null, error: error.message };
  // Supabase puede requerir confirmación de email
  if (data.user && !data.session) {
    return { user: data.user, error: null, needsConfirmation: true };
  }
  return { user: data.user, error: null };
}

/** Cierra sesión. */
async function authLogout() {
  await getSupabaseClient().auth.signOut();
}

/** Devuelve el usuario actual (o null). */
function authCurrentUser() {
  return _currentUser;
}

// ── Inicialización ────────────────────────────────────────────────────────────

function initAuth() {
  const sb = getSupabaseClient();

  // Escuchar cambios de sesión
  sb.auth.onAuthStateChange((_event, session) => {
    _notifyListeners(session?.user ?? null);
  });

  // Restaurar sesión existente al cargar la página
  sb.auth.getSession().then(({ data: { session } }) => {
    _notifyListeners(session?.user ?? null);
  });
}
