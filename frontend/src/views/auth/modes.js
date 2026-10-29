const PASSWORD = {
  existing: {
    label: 'Mot de passe',
    autoComplete: 'current-password',
    showForgotLink: true
  },
  chosen: {
    label: 'Mot de passe',
    autoComplete: 'new-password',
    minLength: 8,
    hint: '8 caractères minimum.'
  }
};

export const AUTH_MODES = {
  signin: {
    title: 'Connexion',
    subtitle: "Accédez à l'administration des invitations.",
    submit: 'Se connecter',
    busy: 'Connexion...',
    fields: ['email', 'password'],
    password: PASSWORD.existing,
    google: true,
    footer: 'register'
  },
  signup: {
    title: 'Créer un compte',
    subtitle: 'Inscrivez-vous, puis demandez un accès à un administrateur.',
    submit: 'Créer mon compte',
    busy: 'Création...',
    fields: ['name', 'email', 'password'],
    password: PASSWORD.chosen,
    google: true,
    footer: 'signin'
  },
  forgot: {
    title: 'Mot de passe oublié',
    subtitle: 'Recevez un lien pour choisir un nouveau mot de passe.',
    submit: 'Envoyer le lien',
    busy: 'Envoi...',
    fields: ['email'],
    footer: 'back'
  },
  reset: {
    title: 'Nouveau mot de passe',
    subtitle: 'Choisissez un mot de passe pour votre compte.',
    submit: 'Enregistrer',
    busy: 'Enregistrement...',
    fields: ['password'],
    password: { ...PASSWORD.chosen, label: 'Nouveau mot de passe' },
    footer: 'back'
  },
  'check-email': {
    title: 'Confirmez votre email',
    subtitle: 'Une dernière étape avant de pouvoir vous connecter.',
    panel: 'check-email'
  },
  'reset-sent': {
    title: 'Lien envoyé',
    subtitle: 'Consultez votre boîte de réception.',
    panel: 'reset-sent'
  }
};

export const authMode = (mode) => AUTH_MODES[mode] ?? AUTH_MODES.signin;
