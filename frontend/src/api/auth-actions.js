// The sign-in flows, in this app's vocabulary.
//
// Better Auth answers with `{ error: { status, message } }` — HTTP numbers and
// English strings. Translating them here means the view never branches on a 403
// or a 422, and the day the library changes its shape, one module changes with
// it. Each action either resolves with an outcome the view can act on, or
// rejects with the French message the visitor should read.

import { authClient } from '../auth-client.js';

export const authActions = {
  /**
   * Resolves `{ verified: true }` once the session exists, or
   * `{ verified: false }` when the account is real but its email is
   * unconfirmed — a different fix from "wrong password", so the two are
   * distinguishable rather than both being "échec".
   */
  async signIn({ email, password }) {
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    if (!error) return { verified: true };
    if (error.status === 403) return { verified: false };
    throw new Error('Email ou mot de passe incorrect.');
  },

  async signUp({ name, email, password }) {
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      // Where the confirmation link lands: the dashboard, like the resend below,
      // so both routes end on the same screen — a freshly confirmed account can
      // create its first invitation straight away.
      callbackURL: '/admin'
    });
    if (!error) return;
    throw new Error(
      error.status === 422
        ? 'Un compte existe déjà pour cet email.'
        : error.message || 'La création du compte a échoué.'
    );
  },

  /**
   * The response is deliberately the same whether or not the account exists, so
   * this endpoint can't be used to probe for addresses.
   */
  async requestPasswordReset(email) {
    await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/reset-password`
    });
  },

  async resetPassword({ token, password }) {
    const invalid = new Error('Lien de réinitialisation invalide ou expiré.');
    if (!token) throw invalid;
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) throw invalid;
  },

  async resendVerification(email) {
    await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: '/admin' });
  },

  /**
   * Full-page redirect to Google; the server drops the visitor back on /admin,
   * where the route guard resolves the restored session. Rejects only when the
   * redirect itself could not be started.
   */
  signInWithGoogle() {
    return authClient.signIn.social({ provider: 'google', callbackURL: '/admin' });
  }
};
