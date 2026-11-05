import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'دعوت‌نامه را باز کنید تا وارد شوید یا حساب بسازید. اگر انتظار این دعوت را نداشتید، این ایمیل را نادیده بگیرید.';

export const fa: EmailLocaleTexts = {
  linkHint: 'یا این لینک را باز کنید:',
  words: {
    someone: 'یک نفر',
    untitled: 'بدون عنوان',
    owner: 'مالک',
    manager: 'مدیر',
    member: 'عضو',
  },
  templates: {
    reset: {
      subject: 'بازنشانی گذرواژه',
      body: 'با لینک زیر گذرواژه جدید تنظیم کنید. اگر این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.',
      button: 'تنظیم گذرواژه جدید',
    },
    verify: {
      subject: 'نشانی ایمیل خود را تأیید کنید',
      body: 'با لینک زیر این نشانی را تأیید کنید و ثبت‌نام را کامل کنید.',
      button: 'تأیید نشانی',
    },
    magic: {
      subject: 'لینک ورود شما',
      body: 'با لینک زیر وارد شوید. این لینک یک بار کار می‌کند و به‌زودی منقضی می‌شود.',
      button: 'ورود',
    },
    inviteProject: {
      subject: "شما به {project} در It's a Plan دعوت شده‌اید",
      body: `{inviter} شما را با نقش {role} به {project} دعوت کرده است.\n\n${INVITE_NEXT}`,
      button: 'باز کردن دعوت‌نامه',
    },
    inviteTeam: {
      subject: "شما به {team} در It's a Plan دعوت شده‌اید",
      body: `{inviter} شما را با نقش {role} به تیم {team} دعوت کرده است.\n\n${INVITE_NEXT}`,
      button: 'باز کردن دعوت‌نامه',
    },
    assigned: {
      subject: '{ref}: به شما واگذار شد',
      body: '{actor} این تسک را به شما واگذار کرد.\n\n{ref}: {title}',
      button: 'باز کردن تسک',
    },
    mentioned: {
      subject: '{ref}: از شما نام برده شد',
      body: '{actor} در این تسک از شما نام برد.\n\n{ref}: {title}',
      button: 'باز کردن تسک',
    },
    commented: {
      subject: '{ref}: دیدگاه جدید',
      body: '{actor} روی این تسک دیدگاه گذاشت.\n\n{ref}: {title}',
      button: 'باز کردن دیدگاه',
    },
    stateChanged: {
      subject: '{ref}: وضعیت به {to} تغییر کرد',
      body: '{actor} وضعیت این تسک را از {from} به {to} تغییر داد.\n\n{ref}: {title}',
      button: 'باز کردن تسک',
    },
    documentMentioned: {
      subject: '{document}: از شما نام برده شد',
      body: '{actor} در این سند از شما نام برد.\n\n{document}',
      button: 'باز کردن سند',
    },
    documentCommentMentioned: {
      subject: '{document}: از شما نام برده شد',
      body: '{actor} در دیدگاهی روی این سند از شما نام برد.\n\n{document}',
      button: 'باز کردن سند',
    },
    test: {
      subject: "آزمایش ایمیل It's a Plan",
      body: "اگر این را می‌خوانید، ایمیل It's a Plan کار می‌کند.",
      button: '',
    },
  },
};
