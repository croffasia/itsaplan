import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Відкрийте запрошення, щоб увійти або створити обліковий запис. Якщо ви не чекали цього запрошення, просто проігноруйте лист.';

export const uk: EmailLocaleTexts = {
  linkHint: 'Або відкрийте посилання:',
  words: {
    someone: 'Хтось',
    untitled: 'Без назви',
    owner: 'власник',
    manager: 'менеджер',
    member: 'учасник',
  },
  templates: {
    reset: {
      subject: 'Скидання пароля',
      body: 'Перейдіть за посиланням нижче, щоб задати новий пароль. Якщо ви не запитували скидання, просто проігноруйте цей лист.',
      button: 'Задати новий пароль',
    },
    verify: {
      subject: 'Підтвердіть адресу пошти',
      body: 'Перейдіть за посиланням нижче, щоб підтвердити цю адресу й завершити реєстрацію.',
      button: 'Підтвердити адресу',
    },
    magic: {
      subject: 'Посилання для входу',
      body: 'Перейдіть за посиланням нижче, щоб увійти. Посилання працює один раз і скоро перестане діяти.',
      button: 'Увійти',
    },
    inviteProject: {
      subject: "Запрошення до {project} в It's a Plan",
      body: `{inviter} запрошує вас до проєкту {project} з роллю {role}.\n\n${INVITE_NEXT}`,
      button: 'Відкрити запрошення',
    },
    inviteTeam: {
      subject: "Запрошення до команди {team} в It's a Plan",
      body: `{inviter} запрошує вас до команди {team} з роллю {role}.\n\n${INVITE_NEXT}`,
      button: 'Відкрити запрошення',
    },
    assigned: {
      subject: '{ref}: призначено вам',
      body: '{actor}: вас призначено виконавцем цієї задачі.\n\n{ref}: {title}',
      button: 'Відкрити задачу',
    },
    mentioned: {
      subject: '{ref}: вас згадали',
      body: '{actor}: вас згадали в цій задачі.\n\n{ref}: {title}',
      button: 'Відкрити задачу',
    },
    commented: {
      subject: '{ref}: новий коментар',
      body: '{actor}: новий коментар до цієї задачі.\n\n{ref}: {title}',
      button: 'Відкрити коментар',
    },
    stateChanged: {
      subject: '{ref}: статус змінено на «{to}»',
      body: '{actor}: статус задачі змінено з «{from}» на «{to}».\n\n{ref}: {title}',
      button: 'Відкрити задачу',
    },
    documentMentioned: {
      subject: '{document}: вас згадали',
      body: '{actor}: вас згадали в цьому документі.\n\n{document}',
      button: 'Відкрити документ',
    },
    documentCommentMentioned: {
      subject: '{document}: вас згадали',
      body: '{actor}: вас згадали в коментарі до цього документа.\n\n{document}',
      button: 'Відкрити документ',
    },
    test: {
      subject: "Перевірка пошти It's a Plan",
      body: "Якщо ви це читаєте, пошта з It's a Plan працює.",
      button: '',
    },
  },
};
