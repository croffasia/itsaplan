import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  "Apri l'invito per accedere o creare un account. Se non ti aspettavi questo invito, puoi ignorare questa email.";

export const it: EmailLocaleTexts = {
  linkHint: 'Oppure apri questo link:',
  words: {
    someone: 'Qualcuno',
    untitled: 'Senza titolo',
    owner: 'proprietario',
    manager: 'manager',
    member: 'membro',
  },
  templates: {
    reset: {
      subject: 'Reimposta la tua password',
      body: "Usa il link qui sotto per impostare una nuova password. Ignora questa email se non l'hai richiesta.",
      button: 'Imposta una nuova password',
    },
    verify: {
      subject: 'Conferma il tuo indirizzo email',
      body: 'Usa il link qui sotto per confermare questo indirizzo e completare la registrazione.',
      button: "Conferma l'indirizzo",
    },
    magic: {
      subject: 'Il tuo link di accesso',
      body: 'Usa il link qui sotto per accedere. È valido una volta sola e scade a breve.',
      button: 'Accedi',
    },
    inviteProject: {
      subject: "Sei stato invitato in {project} su It's a Plan",
      body: `{inviter} ti ha invitato a unirti a {project} come {role}.\n\n${INVITE_NEXT}`,
      button: "Apri l'invito",
    },
    inviteTeam: {
      subject: "Sei stato invitato in {team} su It's a Plan",
      body: `{inviter} ti ha invitato a unirti al team {team} come {role}.\n\n${INVITE_NEXT}`,
      button: "Apri l'invito",
    },
    assigned: {
      subject: '{ref}: assegnato a te',
      body: '{actor} ha assegnato questo issue a te.\n\n{ref}: {title}',
      button: "Apri l'issue",
    },
    mentioned: {
      subject: '{ref}: sei stato menzionato',
      body: '{actor} ti ha menzionato in questo issue.\n\n{ref}: {title}',
      button: "Apri l'issue",
    },
    commented: {
      subject: '{ref}: nuovo commento',
      body: '{actor} ha commentato questo issue.\n\n{ref}: {title}',
      button: 'Apri il commento',
    },
    stateChanged: {
      subject: '{ref}: stato cambiato in {to}',
      body: '{actor} ha cambiato lo stato di questo issue da {from} a {to}.\n\n{ref}: {title}',
      button: "Apri l'issue",
    },
    reacted: {
      subject: '{ref}: {actor} ha reagito al tuo commento',
      body: '{actor} ha reagito al tuo commento con {emoji}.\n\n{ref}: {title}',
      button: 'Apri il commento',
    },
    documentMentioned: {
      subject: '{document}: sei stato menzionato',
      body: '{actor} ti ha menzionato in questo documento.\n\n{document}',
      button: 'Apri il documento',
    },
    documentCommentMentioned: {
      subject: '{document}: sei stato menzionato',
      body: '{actor} ti ha menzionato in un commento di questo documento.\n\n{document}',
      button: 'Apri il documento',
    },
    test: {
      subject: "It's a Plan: test email",
      body: "Se stai leggendo questo, le email di It's a Plan funzionano.",
      button: '',
    },
  },
};
