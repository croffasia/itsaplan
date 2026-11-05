import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Giriş yapmak veya hesap oluşturmak için daveti açın. Bu daveti beklemiyorsanız bu e-postayı yok sayabilirsiniz.';

export const tr: EmailLocaleTexts = {
  linkHint: 'Veya bu bağlantıyı açın:',
  words: {
    someone: 'Biri',
    untitled: 'Başlıksız',
    owner: 'sahip',
    manager: 'yönetici',
    member: 'üye',
  },
  templates: {
    reset: {
      subject: 'Şifrenizi sıfırlayın',
      body: 'Yeni şifre belirlemek için aşağıdaki bağlantıyı kullanın. Bunu siz istemediyseniz bu e-postayı yok sayın.',
      button: 'Yeni şifre belirle',
    },
    verify: {
      subject: 'E-posta adresinizi onaylayın',
      body: 'Bu adresi onaylamak ve kaydı tamamlamak için aşağıdaki bağlantıyı kullanın.',
      button: 'Adresi onayla',
    },
    magic: {
      subject: 'Giriş bağlantınız',
      body: 'Giriş yapmak için aşağıdaki bağlantıyı kullanın. Bağlantı bir kez çalışır ve kısa süre sonra geçersiz olur.',
      button: 'Giriş yap',
    },
    inviteProject: {
      subject: "It's a Plan üzerinde {project} için davet edildiniz",
      body: `{inviter} sizi {role} rolüyle {project} projesine davet etti.\n\n${INVITE_NEXT}`,
      button: 'Daveti aç',
    },
    inviteTeam: {
      subject: "It's a Plan üzerinde {team} için davet edildiniz",
      body: `{inviter} sizi {role} rolüyle {team} ekibine davet etti.\n\n${INVITE_NEXT}`,
      button: 'Daveti aç',
    },
    assigned: {
      subject: '{ref}: size atandı',
      body: '{actor} bu işi size atadı.\n\n{ref}: {title}',
      button: 'İşi aç',
    },
    mentioned: {
      subject: '{ref}: sizden bahsedildi',
      body: '{actor} bu işte sizden bahsetti.\n\n{ref}: {title}',
      button: 'İşi aç',
    },
    commented: {
      subject: '{ref}: yeni yorum',
      body: '{actor} bu işe yorum yaptı.\n\n{ref}: {title}',
      button: 'Yorumu aç',
    },
    stateChanged: {
      subject: '{ref}: durum {to} olarak değişti',
      body: '{actor} bu işin durumunu {from} değerinden {to} değerine değiştirdi.\n\n{ref}: {title}',
      button: 'İşi aç',
    },
    documentMentioned: {
      subject: '{document}: sizden bahsedildi',
      body: '{actor} bu belgede sizden bahsetti.\n\n{document}',
      button: 'Belgeyi aç',
    },
    documentCommentMentioned: {
      subject: '{document}: sizden bahsedildi',
      body: '{actor} bu belgedeki bir yorumda sizden bahsetti.\n\n{document}',
      button: 'Belgeyi aç',
    },
    test: {
      subject: "It's a Plan e-posta testi",
      body: "Bunu okuyabiliyorsanız It's a Plan e-postaları çalışıyor.",
      button: '',
    },
  },
};
