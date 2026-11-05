import type { EmailLocaleTexts } from '../types';

const INVITE_NEXT =
  'Abre la invitación para iniciar sesión o crear una cuenta. Si no esperabas esta invitación, puedes ignorar este correo.';

export const esES: EmailLocaleTexts = {
  linkHint: 'O abre este enlace:',
  words: {
    someone: 'Alguien',
    untitled: 'Sin título',
    owner: 'propietario',
    manager: 'administrador',
    member: 'miembro',
  },
  templates: {
    reset: {
      subject: 'Restablece tu contraseña',
      body: 'Usa el enlace de abajo para definir una contraseña nueva. Ignora este correo si no lo has pedido.',
      button: 'Definir una contraseña nueva',
    },
    verify: {
      subject: 'Confirma tu dirección de correo',
      body: 'Usa el enlace de abajo para confirmar esta dirección y terminar el registro.',
      button: 'Confirmar la dirección',
    },
    magic: {
      subject: 'Tu enlace de inicio de sesión',
      body: 'Usa el enlace de abajo para iniciar sesión. Funciona una vez y caduca pronto.',
      button: 'Iniciar sesión',
    },
    inviteProject: {
      subject: "Te han invitado a {project} en It's a Plan",
      body: `{inviter} te ha invitado a unirte a {project} como {role}.\n\n${INVITE_NEXT}`,
      button: 'Abrir la invitación',
    },
    inviteTeam: {
      subject: "Te han invitado a {team} en It's a Plan",
      body: `{inviter} te ha invitado a unirte al equipo {team} como {role}.\n\n${INVITE_NEXT}`,
      button: 'Abrir la invitación',
    },
    assigned: {
      subject: '{ref}: te lo han asignado',
      body: '{actor} te ha asignado este ticket.\n\n{ref}: {title}',
      button: 'Abrir el ticket',
    },
    mentioned: {
      subject: '{ref}: te han mencionado',
      body: '{actor} te ha mencionado en este ticket.\n\n{ref}: {title}',
      button: 'Abrir el ticket',
    },
    commented: {
      subject: '{ref}: comentario nuevo',
      body: '{actor} ha comentado este ticket.\n\n{ref}: {title}',
      button: 'Abrir el comentario',
    },
    stateChanged: {
      subject: '{ref}: estado cambiado a {to}',
      body: '{actor} ha cambiado el estado de este ticket de {from} a {to}.\n\n{ref}: {title}',
      button: 'Abrir el ticket',
    },
    documentMentioned: {
      subject: '{document}: te han mencionado',
      body: '{actor} te ha mencionado en este documento.\n\n{document}',
      button: 'Abrir el documento',
    },
    documentCommentMentioned: {
      subject: '{document}: te han mencionado',
      body: '{actor} te ha mencionado en un comentario de este documento.\n\n{document}',
      button: 'Abrir el documento',
    },
    test: {
      subject: "Prueba de correo de It's a Plan",
      body: "Si puedes leer esto, el correo de It's a Plan funciona.",
      button: '',
    },
  },
};
