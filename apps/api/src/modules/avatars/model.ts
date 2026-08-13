import { t } from 'elysia';

export const avatarParams = t.Object({ id: t.String() });

export const uploadAvatarBody = t.Object({ file: t.File() });

// The relative serve URL stored on the account, returned after an upload.
export const AvatarResponse = t.Object({ image: t.String() });
