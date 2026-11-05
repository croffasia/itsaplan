import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Buka undangan untuk masuk atau membuat akun. Jika Anda tidak mengharapkan undangan ini, abaikan email ini.';

export const id: EmailLocaleTexts = {
  linkHint: 'Atau buka tautan ini:',
  words: {
    someone: 'Seseorang',
    untitled: 'Tanpa judul',
    owner: 'pemilik',
    manager: 'manajer',
    member: 'anggota',
  },
  templates: {
    reset: {
      subject: 'Atur ulang kata sandi Anda',
      body: 'Gunakan tautan di bawah untuk mengatur kata sandi baru. Abaikan email ini jika Anda tidak memintanya.',
      button: 'Atur kata sandi baru',
    },
    verify: {
      subject: 'Konfirmasi alamat email Anda',
      body: 'Gunakan tautan di bawah untuk mengonfirmasi alamat ini dan menyelesaikan pendaftaran.',
      button: 'Konfirmasi alamat',
    },
    magic: {
      subject: 'Tautan masuk Anda',
      body: 'Gunakan tautan di bawah untuk masuk. Tautan ini hanya berfungsi sekali dan segera kedaluwarsa.',
      button: 'Masuk',
    },
    inviteProject: {
      subject: "Anda diundang ke {project} di It's a Plan",
      body: `{inviter} mengundang Anda untuk bergabung dengan {project} sebagai {role}.\n\n${INVITE_NEXT}`,
      button: 'Buka undangan',
    },
    inviteTeam: {
      subject: "Anda diundang ke {team} di It's a Plan",
      body: `{inviter} mengundang Anda untuk bergabung dengan tim {team} sebagai {role}.\n\n${INVITE_NEXT}`,
      button: 'Buka undangan',
    },
    assigned: {
      subject: '{ref}: ditugaskan kepada Anda',
      body: '{actor} menugaskan issue ini kepada Anda.\n\n{ref}: {title}',
      button: 'Buka issue',
    },
    mentioned: {
      subject: '{ref}: Anda disebut',
      body: '{actor} menyebut Anda di issue ini.\n\n{ref}: {title}',
      button: 'Buka issue',
    },
    commented: {
      subject: '{ref}: komentar baru',
      body: '{actor} mengomentari issue ini.\n\n{ref}: {title}',
      button: 'Buka komentar',
    },
    stateChanged: {
      subject: '{ref}: status diubah ke {to}',
      body: '{actor} mengubah status issue ini dari {from} ke {to}.\n\n{ref}: {title}',
      button: 'Buka issue',
    },
    documentMentioned: {
      subject: '{document}: Anda disebut',
      body: '{actor} menyebut Anda di dokumen ini.\n\n{document}',
      button: 'Buka dokumen',
    },
    documentCommentMentioned: {
      subject: '{document}: Anda disebut',
      body: '{actor} menyebut Anda dalam komentar di dokumen ini.\n\n{document}',
      button: 'Buka dokumen',
    },
    test: {
      subject: "Tes email It's a Plan",
      body: "Jika Anda bisa membaca ini, email dari It's a Plan berfungsi.",
      button: '',
    },
  },
};
