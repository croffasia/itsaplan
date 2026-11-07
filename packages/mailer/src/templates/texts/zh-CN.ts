import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT = '打开邀请即可登录或创建账户。如果你没有预期收到此邀请，请忽略这封邮件。';

export const zhCN: EmailLocaleTexts = {
  linkHint: '或打开此链接：',
  words: {
    someone: '某位用户',
    untitled: '无标题',
    owner: '所有者',
    manager: '管理员',
    member: '成员',
  },
  templates: {
    reset: {
      subject: '重置密码',
      body: '请使用下方链接设置新密码。如果这不是你的操作，请忽略这封邮件。',
      button: '设置新密码',
    },
    verify: {
      subject: '验证你的邮箱地址',
      body: '请使用下方链接验证此地址并完成注册。',
      button: '验证地址',
    },
    magic: {
      subject: '你的登录链接',
      body: '请使用下方链接登录。此链接只能使用一次，并将很快失效。',
      button: '登录',
    },
    inviteProject: {
      subject: "你受邀加入 It's a Plan 上的 {project}",
      body: `{inviter} 邀请你以 {role} 身份加入 {project}。\n\n${INVITE_NEXT}`,
      button: '打开邀请',
    },
    inviteTeam: {
      subject: "你受邀加入 It's a Plan 上的 {team}",
      body: `{inviter} 邀请你以 {role} 身份加入团队 {team}。\n\n${INVITE_NEXT}`,
      button: '打开邀请',
    },
    assigned: {
      subject: '{ref}：已分配给你',
      body: '{actor} 将此工作项分配给了你。\n\n{ref}：{title}',
      button: '打开工作项',
    },
    mentioned: {
      subject: '{ref}：有人提及了你',
      body: '{actor} 在此工作项中提及了你。\n\n{ref}：{title}',
      button: '打开工作项',
    },
    commented: {
      subject: '{ref}：新评论',
      body: '{actor} 评论了此工作项。\n\n{ref}：{title}',
      button: '打开评论',
    },
    stateChanged: {
      subject: '{ref}：状态已更改为 {to}',
      body: '{actor} 将此工作项的状态从 {from} 更改为 {to}。\n\n{ref}：{title}',
      button: '打开工作项',
    },
    documentMentioned: {
      subject: '{document}：有人提及了你',
      body: '{actor} 在此文档中提及了你。\n\n{document}',
      button: '打开文档',
    },
    documentCommentMentioned: {
      subject: '{document}：有人提及了你',
      body: '{actor} 在此文档的评论中提及了你。\n\n{document}',
      button: '打开文档',
    },
    test: {
      subject: "It's a Plan 邮件测试",
      body: "如果你能看到这封邮件，说明 It's a Plan 的邮件功能正常。",
      button: '',
    },
  },
};
