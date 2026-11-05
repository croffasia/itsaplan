import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Abra o convite para entrar ou criar uma conta. Se você não esperava este convite, pode ignorar este e-mail.';

export const ptBR: EmailLocaleTexts = {
  linkHint: 'Ou abra este link:',
  words: {
    someone: 'Alguém',
    untitled: 'Sem título',
    owner: 'dono',
    manager: 'gerente',
    member: 'membro',
  },
  templates: {
    reset: {
      subject: 'Redefina sua senha',
      body: 'Use o link abaixo para definir uma nova senha. Ignore este e-mail se você não pediu isso.',
      button: 'Definir uma nova senha',
    },
    verify: {
      subject: 'Confirme seu endereço de e-mail',
      body: 'Use o link abaixo para confirmar este endereço e concluir o cadastro.',
      button: 'Confirmar o endereço',
    },
    magic: {
      subject: 'Seu link de login',
      body: 'Use o link abaixo para entrar. Ele funciona uma vez e expira em breve.',
      button: 'Entrar',
    },
    inviteProject: {
      subject: "Você foi convidado para {project} no It's a Plan",
      body: `{inviter} convidou você para entrar em {project} como {role}.\n\n${INVITE_NEXT}`,
      button: 'Abrir o convite',
    },
    inviteTeam: {
      subject: "Você foi convidado para {team} no It's a Plan",
      body: `{inviter} convidou você para entrar na equipe {team} como {role}.\n\n${INVITE_NEXT}`,
      button: 'Abrir o convite',
    },
    assigned: {
      subject: '{ref}: atribuída a você',
      body: '{actor} atribuiu esta issue a você.\n\n{ref}: {title}',
      button: 'Abrir a issue',
    },
    mentioned: {
      subject: '{ref}: você foi mencionado',
      body: '{actor} mencionou você nesta issue.\n\n{ref}: {title}',
      button: 'Abrir a issue',
    },
    commented: {
      subject: '{ref}: novo comentário',
      body: '{actor} comentou nesta issue.\n\n{ref}: {title}',
      button: 'Abrir o comentário',
    },
    stateChanged: {
      subject: '{ref}: status alterado para {to}',
      body: '{actor} alterou o status desta issue de {from} para {to}.\n\n{ref}: {title}',
      button: 'Abrir a issue',
    },
    documentMentioned: {
      subject: '{document}: você foi mencionado',
      body: '{actor} mencionou você neste documento.\n\n{document}',
      button: 'Abrir o documento',
    },
    documentCommentMentioned: {
      subject: '{document}: você foi mencionado',
      body: '{actor} mencionou você em um comentário neste documento.\n\n{document}',
      button: 'Abrir o documento',
    },
    test: {
      subject: "Teste de e-mail do It's a Plan",
      body: "Este teste confirma que o It's a Plan consegue enviar e-mails pelo provedor configurado.",
      button: '',
    },
  },
};
