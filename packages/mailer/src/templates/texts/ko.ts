import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  '초대를 열어 로그인하거나 계정을 만드세요. 이 초대를 예상하지 못했다면 이 이메일을 무시해도 됩니다.';

export const ko: EmailLocaleTexts = {
  linkHint: '또는 이 링크를 여세요:',
  words: {
    someone: '누군가',
    untitled: '제목 없음',
    owner: '소유자',
    manager: '관리자',
    member: '멤버',
  },
  templates: {
    reset: {
      subject: '비밀번호 재설정',
      body: '아래 링크를 사용해 새 비밀번호를 설정하세요. 요청한 적이 없다면 이 이메일을 무시하세요.',
      button: '새 비밀번호 설정',
    },
    verify: {
      subject: '이메일 주소를 인증하세요',
      body: '아래 링크를 사용해 이 주소를 인증하고 가입을 완료하세요.',
      button: '주소 인증',
    },
    magic: {
      subject: '로그인 링크',
      body: '아래 링크를 사용해 로그인하세요. 이 링크는 한 번만 작동하며 곧 만료됩니다.',
      button: '로그인',
    },
    inviteProject: {
      subject: "It's a Plan의 {project}에 초대되었습니다",
      body: `{inviter}님이 {role} 역할로 {project}에 참여하도록 초대했습니다.\n\n${INVITE_NEXT}`,
      button: '초대 열기',
    },
    inviteTeam: {
      subject: "It's a Plan의 {team}에 초대되었습니다",
      body: `{inviter}님이 {role} 역할로 {team} 팀에 참여하도록 초대했습니다.\n\n${INVITE_NEXT}`,
      button: '초대 열기',
    },
    assigned: {
      subject: '{ref}: 나에게 배정됨',
      body: '{actor}님이 이 이슈를 나에게 배정했습니다.\n\n{ref}: {title}',
      button: '이슈 열기',
    },
    mentioned: {
      subject: '{ref}: 멘션되었습니다',
      body: '{actor}님이 이 이슈에서 나를 멘션했습니다.\n\n{ref}: {title}',
      button: '이슈 열기',
    },
    commented: {
      subject: '{ref}: 새 댓글',
      body: '{actor}님이 이 이슈에 댓글을 작성했습니다.\n\n{ref}: {title}',
      button: '댓글 열기',
    },
    stateChanged: {
      subject: '{ref}: 상태가 {to}(으)로 변경됨',
      body: '{actor}님이 이 이슈의 상태를 {from}에서 {to}(으)로 변경했습니다.\n\n{ref}: {title}',
      button: '이슈 열기',
    },
    documentMentioned: {
      subject: '{document}: 멘션되었습니다',
      body: '{actor}님이 이 문서에서 나를 멘션했습니다.\n\n{document}',
      button: '문서 열기',
    },
    documentCommentMentioned: {
      subject: '{document}: 멘션되었습니다',
      body: '{actor}님이 이 문서의 댓글에서 나를 멘션했습니다.\n\n{document}',
      button: '문서 열기',
    },
    test: {
      subject: "It's a Plan 이메일 테스트",
      body: "이 테스트는 It's a Plan이 구성된 공급자를 통해 이메일을 보낼 수 있음을 확인합니다.",
      button: '',
    },
  },
};
