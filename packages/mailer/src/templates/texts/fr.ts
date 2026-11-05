import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  "Ouvrez l'invitation pour vous connecter ou créer un compte. Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.";

export const fr: EmailLocaleTexts = {
  linkHint: 'Ou ouvrez ce lien :',
  words: {
    someone: "Quelqu'un",
    untitled: 'Sans titre',
    owner: 'propriétaire',
    manager: 'gestionnaire',
    member: 'membre',
  },
  templates: {
    reset: {
      subject: 'Réinitialisez votre mot de passe',
      body: "Utilisez le lien ci-dessous pour définir un nouveau mot de passe. Ignorez cet e-mail si vous n'en êtes pas à l'origine.",
      button: 'Définir un nouveau mot de passe',
    },
    verify: {
      subject: 'Confirmez votre adresse e-mail',
      body: "Utilisez le lien ci-dessous pour confirmer cette adresse et terminer l'inscription.",
      button: "Confirmer l'adresse",
    },
    magic: {
      subject: 'Votre lien de connexion',
      body: "Utilisez le lien ci-dessous pour vous connecter. Il ne fonctionne qu'une fois et expire rapidement.",
      button: 'Se connecter',
    },
    inviteProject: {
      subject: "Vous êtes invité à {project} sur It's a Plan",
      body: `{inviter} vous invite à rejoindre {project} avec le rôle {role}.\n\n${INVITE_NEXT}`,
      button: "Ouvrir l'invitation",
    },
    inviteTeam: {
      subject: "Vous êtes invité à {team} sur It's a Plan",
      body: `{inviter} vous invite à rejoindre l'équipe {team} avec le rôle {role}.\n\n${INVITE_NEXT}`,
      button: "Ouvrir l'invitation",
    },
    assigned: {
      subject: '{ref} : vous a été assigné',
      body: '{actor} vous a assigné ce ticket.\n\n{ref} : {title}',
      button: 'Ouvrir le ticket',
    },
    mentioned: {
      subject: '{ref} : vous avez été mentionné',
      body: '{actor} vous a mentionné sur ce ticket.\n\n{ref} : {title}',
      button: 'Ouvrir le ticket',
    },
    commented: {
      subject: '{ref} : nouveau commentaire',
      body: '{actor} a commenté ce ticket.\n\n{ref} : {title}',
      button: 'Ouvrir le commentaire',
    },
    stateChanged: {
      subject: '{ref} : état passé à {to}',
      body: "{actor} a fait passer l'état de ce ticket de {from} à {to}.\n\n{ref} : {title}",
      button: 'Ouvrir le ticket',
    },
    documentMentioned: {
      subject: '{document} : vous avez été mentionné',
      body: '{actor} vous a mentionné dans ce document.\n\n{document}',
      button: 'Ouvrir le document',
    },
    documentCommentMentioned: {
      subject: '{document} : vous avez été mentionné',
      body: '{actor} vous a mentionné dans un commentaire sur ce document.\n\n{document}',
      button: 'Ouvrir le document',
    },
    test: {
      subject: "Test d'e-mail It's a Plan",
      body: "Si vous lisez ceci, l'envoi d'e-mails depuis It's a Plan fonctionne.",
      button: '',
    },
  },
};
