<template>
  <div class="flex min-h-full items-center justify-center px-4 py-10">
    <Card class="w-full max-w-[26rem] shadow-xl">
      <CardHeader class="text-center">
        <span class="mx-auto mb-1 text-4xl" aria-hidden="true">🎉</span>
        <CardTitle class="text-xl">{{ copy.title }}</CardTitle>
        <CardDescription>{{ copy.subtitle }}</CardDescription>
      </CardHeader>

      <!-- ---------- Signed in, but not yet granted access ---------- -->
      <CardContent v-if="mode === 'pending'" class="grid gap-3">
        <Alert>
          <ClockIcon />
          <AlertTitle>En attente de validation</AlertTitle>
          <AlertDescription>
            <p>
              Votre compte <strong class="font-medium">{{ session.user?.email }}</strong> est bien
              enregistré, mais il n'a pas encore accès à l'administration.
            </p>
            <p>Demandez à un administrateur de vous accorder l'accès, puis vérifiez à nouveau.</p>
          </AlertDescription>
        </Alert>
        <Button class="w-full" :disabled="loading" @click="recheckAccess">
          <Loader2Icon v-if="loading" class="animate-spin" />
          {{ loading ? 'Vérification...' : 'Vérifier à nouveau' }}
        </Button>
        <Button variant="ghost" class="w-full" @click="handleSignOut">Se déconnecter</Button>
      </CardContent>

      <!-- ---------- Verification email sent ---------- -->
      <CardContent v-else-if="mode === 'check-email'" class="grid gap-3">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>Vérifiez votre boîte mail</AlertTitle>
          <AlertDescription>
            <p>
              Un email de confirmation vient d'être envoyé à
              <strong class="font-medium">{{ form.email }}</strong>.
            </p>
            <p>Ouvrez le lien qu'il contient pour activer votre compte. Pensez à regarder dans les indésirables.</p>
          </AlertDescription>
        </Alert>
        <Button variant="secondary" class="w-full" :disabled="loading" @click="resendVerification">
          <Loader2Icon v-if="loading" class="animate-spin" />
          {{ loading ? 'Envoi...' : "Renvoyer l'email" }}
        </Button>
        <p v-if="notice" class="text-center text-sm font-medium text-success" role="status">{{ notice }}</p>
        <RouterLink to="/login" class="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          ← Retour à la connexion
        </RouterLink>
      </CardContent>

      <!-- ---------- Reset link sent ---------- -->
      <CardContent v-else-if="mode === 'reset-sent'" class="grid gap-3">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>Lien envoyé</AlertTitle>
          <AlertDescription>
            <p>
              Si un compte existe pour <strong class="font-medium">{{ form.email }}</strong>, un lien de
              réinitialisation vient de lui être envoyé.
            </p>
            <p>Le lien est valable une heure.</p>
          </AlertDescription>
        </Alert>
        <RouterLink to="/login" class="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          ← Retour à la connexion
        </RouterLink>
      </CardContent>

      <!-- ---------- Forms ---------- -->
      <form v-else novalidate @submit.prevent="submit">
        <CardContent class="grid gap-4">
          <div v-if="mode === 'signup'" class="grid gap-2">
            <Label for="auth-name">Nom</Label>
            <Input id="auth-name" v-model.trim="form.name" type="text" autocomplete="name" required />
          </div>

          <div v-if="mode !== 'reset'" class="grid gap-2">
            <Label for="auth-email">Email</Label>
            <Input
              id="auth-email"
              v-model.trim="form.email"
              type="email"
              inputmode="email"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
            />
          </div>

          <div v-if="mode === 'signin' || mode === 'signup' || mode === 'reset'" class="grid gap-2">
            <div class="flex items-baseline justify-between gap-2">
              <Label for="auth-password">{{ mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe' }}</Label>
              <RouterLink
                v-if="mode === 'signin'"
                to="/forgot-password"
                class="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >Oublié ?</RouterLink>
            </div>
            <!-- Typing a password blind on a phone keyboard is the single most
                 common reason a sign-in fails twice, so it can be revealed. -->
            <div class="relative">
              <Input
                id="auth-password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="pr-10"
                :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
                :minlength="mode === 'signin' ? undefined : 8"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <EyeOffIcon v-if="showPassword" />
                <EyeIcon v-else />
              </Button>
            </div>
            <p v-if="mode !== 'signin'" class="text-sm text-muted-foreground">8 caractères minimum.</p>
          </div>

          <Alert v-if="error" variant="destructive" role="alert">
            <CircleAlertIcon />
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
          <p v-if="passwordWasReset" class="text-sm font-medium text-success" role="status">
            Mot de passe modifié. Connectez-vous avec le nouveau.
          </p>
        </CardContent>

        <CardFooter class="mt-6 grid gap-4">
          <Button type="submit" class="w-full" :disabled="loading">
            <Loader2Icon v-if="loading" class="animate-spin" />
            {{ loading ? copy.busy : copy.submit }}
          </Button>

          <!-- Google is only offered when the server reports it configured. -->
          <template v-if="providers.google && (mode === 'signin' || mode === 'signup')">
            <div class="relative text-center text-sm">
              <Separator class="absolute inset-x-0 top-1/2" />
              <span class="relative bg-card px-2 text-muted-foreground">ou</span>
            </div>
            <Button type="button" variant="outline" class="w-full" :disabled="loading" @click="signInWithGoogle">
              <svg class="size-[18px]" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              Continuer avec Google
            </Button>
          </template>

          <p class="text-center text-sm text-muted-foreground">
            <template v-if="mode === 'signin'">
              Pas encore de compte ?
              <RouterLink to="/register" class="font-medium text-primary underline-offset-4 hover:underline">Créer un compte</RouterLink>
            </template>
            <template v-else-if="mode === 'signup'">
              Déjà un compte ?
              <RouterLink to="/login" class="font-medium text-primary underline-offset-4 hover:underline">Se connecter</RouterLink>
            </template>
            <template v-else>
              <RouterLink to="/login" class="underline-offset-4 hover:text-foreground hover:underline">← Retour à la connexion</RouterLink>
            </template>
          </p>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>

<script>
import { RouterLink } from 'vue-router';
import {
  CircleAlertIcon, ClockIcon, EyeIcon, EyeOffIcon, Loader2Icon, MailCheckIcon
} from '@lucide/vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { authClient } from '../auth-client.js';
import { session, refresh, ensureSession, signOut, authProviders } from '../session.js';
import { applySeo } from '../seo.js';

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
  components: {
    RouterLink,
    Alert, AlertDescription, AlertTitle,
    Button,
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
    Input, Label, Separator,
    CircleAlertIcon, ClockIcon, EyeIcon, EyeOffIcon, Loader2Icon, MailCheckIcon
  },
  data() {
    return {
      session,
      // Transient mode set after a submit; null means "follow the route".
      transientMode: null,
      providers: { emailPassword: true, google: false },
      form: { name: '', email: '', password: '' },
      showPassword: false,
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
    // Set by handleReset once a new password is stored, so the sign-in form the
    // visitor lands on says why they are being asked to sign in again.
    passwordWasReset() {
      return this.mode === 'signin' && this.$route.query.reset === '1';
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
      this.showPassword = false;
    },
    mode() {
      this.applyHeadForMode();
    }
  },
  async created() {
    this.applyHeadForMode();
    this.providers = await authProviders();
    // A visitor arriving on /login who already has a session belongs elsewhere.
    // No route guard runs here, so resolve the session rather than reading a
    // `session.user` that a cold load has never filled in.
    if (this.mode === 'signin') {
      const user = await ensureSession();
      if (user) this.$router.replace(user.role === 'admin' ? '/admin' : '/pending');
    }
  },
  methods: {
    // Sign-in and registration have nothing to offer a search engine. The server
    // shell already sends noindex for these paths (server/src/seo.ts); this keeps
    // the head right across client-side navigation and gives the tab a real name.
    applyHeadForMode() {
      applySeo({
        title: `${this.copy.title} | Invitation d'anniversaire`,
        description: this.copy.subtitle,
        robots: 'noindex, nofollow'
      });
    },

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
          password: this.form.password,
          // Where the confirmation link lands. /admin, like the resend below, so
          // both routes end on the same screen — the guard forwards an account
          // that has no access yet to /pending rather than the invitation page.
          callbackURL: '/admin'
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
        this.$router.replace({ name: 'login', query: { reset: '1' } });
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

