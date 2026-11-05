import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Откройте приглашение, чтобы войти или создать аккаунт. Если вы не ждали этого приглашения, просто проигнорируйте письмо.';

export const ru: EmailLocaleTexts = {
  linkHint: 'Или откройте ссылку:',
  words: {
    someone: 'Кто-то',
    untitled: 'Без названия',
    owner: 'владелец',
    manager: 'менеджер',
    member: 'участник',
  },
  templates: {
    reset: {
      subject: 'Сброс пароля',
      body: 'Перейдите по ссылке ниже, чтобы задать новый пароль. Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
      button: 'Задать новый пароль',
    },
    verify: {
      subject: 'Подтвердите адрес почты',
      body: 'Перейдите по ссылке ниже, чтобы подтвердить этот адрес и завершить регистрацию.',
      button: 'Подтвердить адрес',
    },
    magic: {
      subject: 'Ссылка для входа',
      body: 'Перейдите по ссылке ниже, чтобы войти. Ссылка работает один раз и скоро перестанет действовать.',
      button: 'Войти',
    },
    inviteProject: {
      subject: "Приглашение в {project} в It's a Plan",
      body: `{inviter} приглашает вас в проект {project} с ролью {role}.\n\n${INVITE_NEXT}`,
      button: 'Открыть приглашение',
    },
    inviteTeam: {
      subject: "Приглашение в команду {team} в It's a Plan",
      body: `{inviter} приглашает вас в команду {team} с ролью {role}.\n\n${INVITE_NEXT}`,
      button: 'Открыть приглашение',
    },
    assigned: {
      subject: '{ref}: назначена на вас',
      body: '{actor}: вы назначены исполнителем этой задачи.\n\n{ref}: {title}',
      button: 'Открыть задачу',
    },
    mentioned: {
      subject: '{ref}: вас упомянули',
      body: '{actor}: вас упомянули в этой задаче.\n\n{ref}: {title}',
      button: 'Открыть задачу',
    },
    commented: {
      subject: '{ref}: новый комментарий',
      body: '{actor}: новый комментарий к этой задаче.\n\n{ref}: {title}',
      button: 'Открыть комментарий',
    },
    stateChanged: {
      subject: '{ref}: статус изменён на «{to}»',
      body: '{actor}: статус задачи изменён с «{from}» на «{to}».\n\n{ref}: {title}',
      button: 'Открыть задачу',
    },
    documentMentioned: {
      subject: '{document}: вас упомянули',
      body: '{actor}: вас упомянули в этом документе.\n\n{document}',
      button: 'Открыть документ',
    },
    documentCommentMentioned: {
      subject: '{document}: вас упомянули',
      body: '{actor}: вас упомянули в комментарии к этому документу.\n\n{document}',
      button: 'Открыть документ',
    },
    test: {
      subject: "Проверка почты It's a Plan",
      body: "Это тестовое письмо: It's a Plan может отправлять почту через настроенного провайдера.",
      button: '',
    },
  },
};
