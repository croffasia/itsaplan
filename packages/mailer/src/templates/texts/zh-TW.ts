import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT = '開啟邀請即可登入或建立帳號。如果你並未預期收到此邀請，請忽略這封電子郵件。';

export const zhTW: EmailLocaleTexts = {
  linkHint: '或開啟此連結：',
  words: {
    someone: '某位使用者',
    untitled: '無標題',
    owner: '所有者',
    manager: '管理者',
    member: '成員',
  },
  templates: {
    reset: {
      subject: '重設密碼',
      body: '請使用下方連結設定新密碼。如果這不是你的操作，請忽略這封電子郵件。',
      button: '設定新密碼',
    },
    verify: {
      subject: '驗證你的電子郵件地址',
      body: '請使用下方連結驗證此地址並完成註冊。',
      button: '驗證地址',
    },
    magic: {
      subject: '你的登入連結',
      body: '請使用下方連結登入。此連結只能使用一次，且很快就會失效。',
      button: '登入',
    },
    inviteProject: {
      subject: "你受邀加入 It's a Plan 上的 {project}",
      body: `{inviter} 邀請你以 {role} 身分加入 {project}。\n\n${INVITE_NEXT}`,
      button: '開啟邀請',
    },
    inviteTeam: {
      subject: "你受邀加入 It's a Plan 上的 {team}",
      body: `{inviter} 邀請你以 {role} 身分加入團隊 {team}。\n\n${INVITE_NEXT}`,
      button: '開啟邀請',
    },
    assigned: {
      subject: '{ref}：已指派給你',
      body: '{actor} 將此工作項目指派給你。\n\n{ref}：{title}',
      button: '開啟工作項目',
    },
    mentioned: {
      subject: '{ref}：有人提及了你',
      body: '{actor} 在此工作項目中提及了你。\n\n{ref}：{title}',
      button: '開啟工作項目',
    },
    commented: {
      subject: '{ref}：新留言',
      body: '{actor} 在此工作項目發表了留言。\n\n{ref}：{title}',
      button: '開啟留言',
    },
    stateChanged: {
      subject: '{ref}：狀態已更改為 {to}',
      body: '{actor} 將此工作項目的狀態從 {from} 更改為 {to}。\n\n{ref}：{title}',
      button: '開啟工作項目',
    },
    documentMentioned: {
      subject: '{document}：有人提及了你',
      body: '{actor} 在此文件中提及了你。\n\n{document}',
      button: '開啟文件',
    },
    documentCommentMentioned: {
      subject: '{document}：有人提及了你',
      body: '{actor} 在此文件的留言中提及了你。\n\n{document}',
      button: '開啟文件',
    },
    test: {
      subject: "It's a Plan 電子郵件測試",
      body: "此測試確認 It's a Plan 可以透過已設定的服務供應商傳送電子郵件。",
      button: '',
    },
  },
};
