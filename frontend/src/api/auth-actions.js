import { authClient } from '../auth-client.js';

export const authActions = {
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
      callbackURL: '/admin'
    });
    if (!error) return;
    throw new Error(
      error.status === 422
        ? 'Un compte existe déjà pour cet email.'
        : error.message || 'La création du compte a échoué.'
    );
  },

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

  signInWithGoogle() {
    return authClient.signIn.social({ provider: 'google', callbackURL: '/admin' });
  }
};
