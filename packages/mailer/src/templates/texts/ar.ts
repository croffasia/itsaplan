import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'افتح الدعوة علشان تسجّل الدخول أو تعمل حساب. لو ماكنتش مستني الدعوة دي، تجاهل الرسالة.';

export const ar: EmailLocaleTexts = {
  linkHint: 'أو افتح الرابط ده:',
  words: {
    someone: 'أحدهم',
    untitled: 'بلا عنوان',
    owner: 'مالك',
    manager: 'مدير',
    member: 'عضو',
  },
  templates: {
    reset: {
      subject: 'إعادة تعيين كلمة المرور',
      body: 'استخدم الرابط اللي تحت علشان تعيّن كلمة مرور جديدة. لو ماطلبتش ده، تجاهل الرسالة.',
      button: 'تعيين كلمة مرور جديدة',
    },
    verify: {
      subject: 'أكّد عنوان بريدك',
      body: 'استخدم الرابط اللي تحت علشان تأكد العنوان ده وتكمّل التسجيل.',
      button: 'تأكيد العنوان',
    },
    magic: {
      subject: 'رابط تسجيل الدخول بتاعك',
      body: 'استخدم الرابط اللي تحت علشان تسجّل الدخول. الرابط بيشتغل مرة واحدة وهينتهي قريب.',
      button: 'تسجيل الدخول',
    },
    inviteProject: {
      subject: "عندك دعوة لـ {project} على It's a Plan",
      body: `{inviter} دعاك تنضم لـ {project} بدور {role}.\n\n${INVITE_NEXT}`,
      button: 'افتح الدعوة',
    },
    inviteTeam: {
      subject: "عندك دعوة لـ {team} على It's a Plan",
      body: `{inviter} دعاك تنضم للفريق {team} بدور {role}.\n\n${INVITE_NEXT}`,
      button: 'افتح الدعوة',
    },
    assigned: {
      subject: '{ref}: اتعيّنت لك',
      body: '{actor} عيّن لك المهمة دي.\n\n{ref}: {title}',
      button: 'افتح المهمة',
    },
    mentioned: {
      subject: '{ref}: حد أشار إليك',
      body: '{actor} أشار إليك في المهمة دي.\n\n{ref}: {title}',
      button: 'افتح المهمة',
    },
    commented: {
      subject: '{ref}: تعليق جديد',
      body: '{actor} علّق على المهمة دي.\n\n{ref}: {title}',
      button: 'افتح التعليق',
    },
    stateChanged: {
      subject: '{ref}: الحالة بقت {to}',
      body: '{actor} غيّر حالة المهمة دي من {from} لـ {to}.\n\n{ref}: {title}',
      button: 'افتح المهمة',
    },
    documentMentioned: {
      subject: '{document}: حد أشار إليك',
      body: '{actor} أشار إليك في المستند ده.\n\n{document}',
      button: 'افتح المستند',
    },
    documentCommentMentioned: {
      subject: '{document}: حد أشار إليك',
      body: '{actor} أشار إليك في تعليق على المستند ده.\n\n{document}',
      button: 'افتح المستند',
    },
    test: {
      subject: "اختبار بريد It's a Plan",
      body: "الاختبار ده بيأكد إن It's a Plan يقدر يبعت بريد من خلال المزوّد المضبوط.",
      button: '',
    },
  },
};
