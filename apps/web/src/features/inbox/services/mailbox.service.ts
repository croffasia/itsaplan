import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type MailboxSettingsInput, type SendMailboxMessageInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useMailboxSettings(projectKey: string, enabled = true) {
  return useQuery({
    queryKey: qk.mailboxSettings(projectKey),
    queryFn: () => api.getMailboxSettings(projectKey),
    enabled,
  });
}

// Every folder is one round trip to Zoho, so the counts are not refetched on every
// window focus.
export function useMailboxFolders(projectKey: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mailboxFolders(projectKey),
    queryFn: () => api.listMailboxFolders(projectKey),
    enabled,
    staleTime: 60_000,
  });
}

export function useMailboxMessages(projectKey: string, folder: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mailboxMessages(projectKey, folder),
    queryFn: () => api.listMailboxMessages(projectKey, folder),
    enabled,
    staleTime: 30_000,
  });
}

// A uid only means something inside its own folder, so both are part of the key.
export function useMailboxMessage(projectKey: string, folder: string, uid: number | null) {
  return useQuery({
    queryKey: qk.mailboxMessage(projectKey, folder, uid ?? 0),
    queryFn: () => api.getMailboxMessage(projectKey, uid!, folder),
    enabled: uid != null,
  });
}

export function useConnectMailbox(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MailboxSettingsInput) => api.updateMailboxSettings(projectKey, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.mailboxSettings(projectKey) });
      await queryClient.invalidateQueries({ queryKey: ['mailboxMessages', projectKey] });
      toast.success('Zoho mailbox connected');
    },
  });
}

export function useDisconnectMailbox(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectMailbox(projectKey),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['mailboxMessages', projectKey] });
      await queryClient.invalidateQueries({ queryKey: qk.mailboxSettings(projectKey) });
      toast.success('Mailbox disconnected');
    },
  });
}

export function useMarkMailboxRead(projectKey: string, folder: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uid: number) => api.markMailboxMessageRead(projectKey, uid, folder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.mailboxMessages(projectKey, folder) });
      void queryClient.invalidateQueries({ queryKey: qk.mailboxFolders(projectKey) });
    },
  });
}

export function useSendMailboxMessage(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMailboxMessageInput) => api.sendMailboxMessage(projectKey, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mailboxMessages', projectKey] });
      void queryClient.invalidateQueries({ queryKey: qk.mailboxFolders(projectKey) });
      toast.success('Email sent');
    },
  });
}
