<template>
  <div class="auth-page">
    <div class="auth-card">
      <header class="auth-head">
        <span class="auth-mark" aria-hidden="true">🎉</span>
        <h1 class="auth-title">{{ copy.title }}</h1>
        <p class="auth-subtitle">{{ copy.subtitle }}</p>
      </header>

      <!-- ---------- Signed in, but not yet granted access ---------- -->
      <section v-if="mode === 'pending'" class="auth-body">
        <div class="auth-notice" role="status">
          <p>
            Votre compte <strong>{{ session.user?.email }}</strong> est bien enregistré,
            mais il n'a pas encore accès à l'administration.
          </p>
          <p class="auth-notice-muted">
            Demandez à un administrateur de vous accorder l'accès, puis actualisez cette page.
          </p>
        </div>
        <button class="btn btn-primary btn-block" :disabled="loading" @click="recheckAccess">
          {{ loading ? 'Vérification...' : 'Vérifier à nouveau' }}
        </button>
        <button class="btn btn-ghost btn-block" @click="handleSignOut">Se déconnecter</button>
      </section>

      <!-- ---------- Verification email sent ---------- -->
      <section v-else-if="mode === 'check-email'" class="auth-body">
        <div class="auth-notice" role="status">
          <p>Un email de confirmation vient d'être envoyé à <strong>{{ form.email }}</strong>.</p>
          <p class="auth-notice-muted">
            Ouvrez le lien qu'il contient pour activer votre compte. Pensez à regarder dans
            les indésirables.
          </p>
        </div>
        <button class="btn btn-secondary btn-block" :disabled="loading" @click="resendVerification">
          {{ loading ? 'Envoi...' : "Renvoyer l'email" }}
        </button>
        <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
        <p class="auth-alt">
          <router-link to="/login">← Retour à la connexion</router-link>
        </p>
      </section>

      <!-- ---------- Reset link sent ---------- -->
      <section v-else-if="mode === 'reset-sent'" class="auth-body">
        <div class="auth-notice" role="status">
          <p>
            Si un compte existe pour <strong>{{ form.email }}</strong>, un lien de
            réinitialisation vient de lui être envoyé.
          </p>
          <p class="auth-notice-muted">Le lien est valable une heure.</p>
        </div>
        <p class="auth-alt">
          <router-link to="/login">← Retour à la connexion</router-link>
        </p>
      </section>

      <!-- ---------- Forms ---------- -->
      <form v-else class="auth-body" novalidate @submit.prevent="submit">
        <div v-if="mode === 'signup'" class="form-group">
          <label for="auth-name">Nom</label>
          <input
            id="auth-name"
            v-model.trim="form.name"
            class="form-input"
            type="text"
            autocomplete="name"
            required
          />
        </div>

        <div v-if="mode !== 'reset'" class="form-group">
          <label for="auth-email">Email</label>
          <input
            id="auth-email"
            v-model.trim="form.email"
            class="form-input"
            type="email"
            autocomplete="username"
            required
          />
        </div>

        <div v-if="mode === 'signin' || mode === 'signup' || mode === 'reset'" class="form-group">
          <div class="label-row">
            <label for="auth-password">{{ mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe' }}</label>
            <router-link v-if="mode === 'signin'" class="auth-inline-link" to="/forgot-password">
              Oublié ?
            </router-link>
          </div>
          <input
            id="auth-password"
            v-model="form.password"
            class="form-input"
            type="password"
            :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
            :minlength="mode === 'signin' ? null : 8"
            required
          />
          <p v-if="mode !== 'signin'" class="form-hint">8 caractères minimum.</p>
        </div>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? copy.busy : copy.submit }}
        </button>

        <!-- Google is only offered when the server reports it configured. -->
        <template v-if="providers.google && (mode === 'signin' || mode === 'signup')">
          <div class="auth-divider"><span>ou</span></div>
          <button type="button" class="btn btn-google btn-block" :disabled="loading" @click="signInWithGoogle">
            <svg class="google-mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/>
            </svg>
            Continuer avec Google
          </button>
        </template>

        <p class="auth-alt">
          <template v-if="mode === 'signin'">
            Pas encore de compte ? <router-link to="/register">Créer un compte</router-link>
          </template>
          <template v-else-if="mode === 'signup'">
            Déjà un compte ? <router-link to="/login">Se connecter</router-link>
          </template>
          <template v-else>
            <router-link to="/login">← Retour à la connexion</router-link>
          </template>
        </p>
      </form>
    </div>
  </div>
</template>

<script>
import { authClient } from '../auth-client.js';
import { session, refresh, signOut, authProviders } from '../session.js';

// Route name -> form mode. `check-email` and `reset-sent` are transient states
// the component enters after a successful submit; they have no route of their
// own so a refresh returns the visitor to a form rather than a dead end.
const MODES = {
  login: 'signin',
  register: 'signup',
  'forgot-password': 'forgot',
  'reset-password': 'reset',
  pending: 'pending'
};

const COPY = {
  signin: {
    title: 'Connexion',
    subtitle: "Accédez à l'administration des invitations.",
    submit: 'Se connecter',
    busy: 'Connexion...'
  },
  signup: {
    title: 'Créer un compte',
    subtitle: 'Inscrivez-vous, puis demandez un accès à un administrateur.',
    submit: 'Créer mon compte',
    busy: 'Création...'
  },
  forgot: {
    title: 'Mot de passe oublié',
    subtitle: 'Recevez un lien pour choisir un nouveau mot de passe.',
    submit: 'Envoyer le lien',
    busy: 'Envoi...'
  },
  reset: {
    title: 'Nouveau mot de passe',
    subtitle: 'Choisissez un mot de passe pour votre compte.',
    submit: 'Enregistrer',
    busy: 'Enregistrement...'
  },
  pending: {
    title: 'Accès en attente',
    subtitle: "Votre compte n'a pas encore les droits d'administration.",
    submit: '',
    busy: ''
  },
  'check-email': {
    title: 'Confirmez votre email',
    subtitle: 'Une dernière étape avant de pouvoir vous connecter.',
    submit: '',
    busy: ''
  },
  'reset-sent': {
    title: 'Lien envoyé',
    subtitle: 'Consultez votre boîte de réception.',
    submit: '',
    busy: ''
  }
};

export default {
  name: 'Auth',
  data() {
    return {
      session,
      // Transient mode set after a submit; null means "follow the route".
      transientMode: null,
      providers: { emailPassword: true, google: false },
      form: { name: '', email: '', password: '' },
      error: null,
      notice: null,
      loading: false
    };
  },
  computed: {
    mode() {
      return this.transientMode ?? MODES[this.$route.name] ?? 'signin';
    },
    copy() {
      return COPY[this.mode] ?? COPY.signin;
    },
    // Better Auth puts the reset token in the query string of the page its
    // emailed link redirects to.
    resetToken() {
      return this.$route.query.token ?? '';
    }
  },
  watch: {
    // Navigating between /login and /register must clear a stale error and any
    // transient "check your email" state.
    '$route.name'() {
      this.transientMode = null;
      this.error = null;
      this.notice = null;
    }
  },
  async created() {
    this.providers = await authProviders();
    // A visitor arriving on /login who already has a session belongs elsewhere.
    if (this.mode === 'signin' && session.user) {
      this.$router.replace(session.user.role === 'admin' ? '/admin' : '/pending');
    }
  },
  methods: {
    submit() {
      const handlers = {
        signin: this.handleSignIn,
        signup: this.handleSignUp,
        forgot: this.handleForgot,
        reset: this.handleReset
      };
      return handlers[this.mode]?.();
    },

    async handleSignIn() {
      await this.run(async () => {
        const { error } = await authClient.signIn.email({
          email: this.form.email,
          password: this.form.password
        });
        if (error) {
          // 403 here means the account exists but its email is unconfirmed —
          // a different fix from "wrong password", so say which it is.
          if (error.status === 403) {
            this.transientMode = 'check-email';
            return;
          }
          throw new Error('Email ou mot de passe incorrect.');
        }
        this.form.password = '';
        await this.goToDestination();
      });
    },

    async handleSignUp() {
      await this.run(async () => {
        const { error } = await authClient.signUp.email({
          name: this.form.name,
          email: this.form.email,
          password: this.form.password
        });
        if (error) {
          throw new Error(
            error.status === 422
              ? 'Un compte existe déjà pour cet email.'
              : error.message || 'La création du compte a échoué.'
          );
        }
        this.form.password = '';
        this.transientMode = 'check-email';
      });
    },

    async handleForgot() {
      await this.run(async () => {
        // The response is deliberately the same whether or not the account
        // exists, so this endpoint can't be used to probe for addresses.
        await authClient.requestPasswordReset({
          email: this.form.email,
          redirectTo: `${window.location.origin}/reset-password`
        });
        this.transientMode = 'reset-sent';
      });
    },

    async handleReset() {
      await this.run(async () => {
        if (!this.resetToken) {
          throw new Error('Lien de réinitialisation invalide ou expiré.');
        }
        const { error } = await authClient.resetPassword({
          newPassword: this.form.password,
          token: this.resetToken
        });
        if (error) throw new Error('Lien de réinitialisation invalide ou expiré.');
        this.form.password = '';
        this.$router.replace('/login');
      });
    },

    async resendVerification() {
      await this.run(async () => {
        await authClient.sendVerificationEmail({
          email: this.form.email,
          callbackURL: '/admin'
        });
        this.notice = 'Email renvoyé.';
      });
    },

    signInWithGoogle() {
      this.error = null;
      this.loading = true;
      // Full-page redirect to Google; the server drops the visitor back on
      // /admin, where the router guard sorts admins from pending accounts.
      authClient.signIn.social({ provider: 'google', callbackURL: '/admin' }).catch(() => {
        this.loading = false;
        this.error = "La connexion Google a échoué.";
      });
    },

    async recheckAccess() {
      this.loading = true;
      const user = await refresh();
      this.loading = false;
      if (user?.role === 'admin') this.$router.replace('/admin');
    },

    async handleSignOut() {
      await signOut();
      this.$router.replace('/login');
    },

    // Send a freshly signed-in visitor to the page they were headed for, or to
    // the pending screen when their account has no access yet.
    async goToDestination() {
      const user = await refresh();
      if (user?.role !== 'admin') return this.$router.replace('/pending');
      const target = this.$route.query.redirect;
      this.$router.replace(typeof target === 'string' && target.startsWith('/') ? target : '/admin');
    },

    // Shared submit wrapper: one place for the loading flag and error surface.
    async run(action) {
      this.loading = true;
      this.error = null;
      this.notice = null;
      try {
        await action();
      } catch (err) {
        this.error = err?.message || 'Une erreur est survenue.';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
/*
 * Same neutral token set as the admin dashboard: these screens are part of the
 * tool, not the festive invitation, so they stay theme-independent.
 */
.auth-page{
  --c-surface:#ffffff;
  --c-surface-subtle:#f8fafc;
  --c-border:#e2e8f0;
  --c-border-strong:#cbd5e1;
  --c-text:#0f172a;
  --c-text-muted:#64748b;
  --c-text-subtle:#94a3b8;
  --c-accent:#4f46e5;
  --c-accent-hover:#4338ca;
  --c-danger:#dc2626;
  --c-danger-soft:#fef2f2;
  --c-success:#059669;
  --c-success-soft:#ecfdf5;
  --c-focus-ring:rgba(79,70,229,.25);
  --r-sm:8px;
  --r-md:12px;
  --r-lg:16px;

  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:32px 20px 64px;
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  color:var(--c-text);
  -webkit-font-smoothing:antialiased;
}
.auth-card{
  width:100%;max-width:420px;background:var(--c-surface);
  border:1px solid var(--c-border);border-radius:var(--r-lg);
  box-shadow:0 20px 50px rgba(15,23,42,.25);overflow:hidden;
}
.auth-head{padding:32px 28px 8px;text-align:center}
.auth-mark{font-size:2rem;display:block;margin-bottom:8px}
.auth-title{margin:0;font-size:1.35rem;font-weight:700;letter-spacing:-.01em}
.auth-subtitle{margin:6px 0 0;color:var(--c-text-muted);font-size:.9rem;line-height:1.5}
.auth-body{padding:24px 28px 28px;display:flex;flex-direction:column;gap:4px}

.form-group{margin-bottom:14px}
.label-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.form-group label{display:block;margin-bottom:6px;font-weight:600;font-size:.875rem}
.form-input{
  width:100%;padding:10px 12px;border:1px solid var(--c-border-strong);
  border-radius:var(--r-sm);font-size:.95rem;font-family:inherit;color:var(--c-text);
  background:var(--c-surface);transition:border-color .15s ease,box-shadow .15s ease;
}
.form-input:focus{outline:none;border-color:var(--c-accent);box-shadow:0 0 0 3px var(--c-focus-ring)}
.form-hint{margin:6px 0 0;font-size:.78rem;color:var(--c-text-subtle)}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:11px 16px;border:1px solid transparent;border-radius:var(--r-sm);
  font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;
  transition:background-color .15s ease,border-color .15s ease,color .15s ease;
}
.btn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--c-focus-ring)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn-block{width:100%}
.btn-primary{background:var(--c-accent);color:#fff}
.btn-primary:hover:not(:disabled){background:var(--c-accent-hover)}
.btn-secondary{background:var(--c-surface);color:var(--c-text);border-color:var(--c-border-strong)}
.btn-secondary:hover:not(:disabled){background:var(--c-surface-subtle)}
.btn-ghost{background:transparent;color:var(--c-text-muted);margin-top:8px}
.btn-ghost:hover:not(:disabled){background:var(--c-surface-subtle);color:var(--c-text)}
.btn-google{background:var(--c-surface);color:var(--c-text);border-color:var(--c-border-strong)}
.btn-google:hover:not(:disabled){background:var(--c-surface-subtle)}
.google-mark{width:18px;height:18px;flex:none}

.auth-divider{display:flex;align-items:center;gap:12px;margin:14px 0;color:var(--c-text-subtle);font-size:.8rem}
.auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:var(--c-border)}

.auth-error{
  margin:0 0 14px;padding:10px 12px;border-radius:var(--r-sm);
  background:var(--c-danger-soft);color:var(--c-danger);font-size:.85rem;line-height:1.45;
}
.auth-success{
  margin:12px 0 0;padding:10px 12px;border-radius:var(--r-sm);
  background:var(--c-success-soft);color:var(--c-success);font-size:.85rem;
}
.auth-notice{
  margin-bottom:18px;padding:14px 16px;border-radius:var(--r-md);
  background:var(--c-surface-subtle);border:1px solid var(--c-border);
  font-size:.9rem;line-height:1.55;
}
.auth-notice p{margin:0}
.auth-notice p + p{margin-top:8px}
.auth-notice-muted{color:var(--c-text-muted);font-size:.85rem}

.auth-alt{margin:18px 0 0;text-align:center;font-size:.875rem;color:var(--c-text-muted)}
.auth-alt a,.auth-inline-link{color:var(--c-accent);font-weight:600;text-decoration:none}
.auth-alt a:hover,.auth-inline-link:hover{text-decoration:underline}
.auth-inline-link{font-size:.8rem}

@media (max-width:480px){
  .auth-head{padding:26px 20px 6px}
  .auth-body{padding:20px}
}
</style>
