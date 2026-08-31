import { createRouter, createWebHistory } from 'vue-router';
import Invitation from './views/Invitation.vue';
import Admin from './views/Admin.vue';
import Auth from './views/Auth.vue';
import { ensureSession, refresh } from './session.js';

const routes = [
  { path: '/', name: 'invitation', component: Invitation },
  { path: '/e/:slug', name: 'event', component: Invitation, props: true },
  { path: '/admin', name: 'admin', component: Admin, meta: { requiresAdmin: true } },
  { path: '/login', name: 'login', component: Auth },
  { path: '/register', name: 'register', component: Auth },
  { path: '/forgot-password', name: 'forgot-password', component: Auth },
  { path: '/reset-password', name: 'reset-password', component: Auth },
  { path: '/pending', name: 'pending', component: Auth, meta: { requiresAuth: true } }
];

const router = createRouter({ history: createWebHistory(), routes });

// Route guard. The server is the authority — every admin API call is checked
// again there — but resolving the session up front avoids rendering a dashboard
// that would only fill with 401s, and routes a registered-but-ungranted account
// to the pending screen instead of a bare error.
router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin && !to.meta.requiresAuth) return true;

  // Google sign-in lands back on /admin as a full page load; re-read rather
  // than trust a session resolved before the redirect.
  let user = await ensureSession();
  if (!user && to.meta.requiresAdmin) user = await refresh();

  if (!user) {
    return { name: 'login', query: to.fullPath === '/admin' ? {} : { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && user.role !== 'admin') {
    return { name: 'pending' };
  }
  // An admin has no reason to sit on the pending screen.
  if (to.name === 'pending' && user.role === 'admin') {
    return { name: 'admin' };
  }
  return true;
});

export default router;
