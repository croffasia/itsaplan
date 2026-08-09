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

export function useMailboxMessages(projectKey: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mailboxMessages(projectKey),
    queryFn: () => api.listMailboxMessages(projectKey),
    enabled,
    staleTime: 30_000,
  });
}

export function useMailboxMessage(projectKey: string, uid: number | null) {
  return useQuery({
    queryKey: qk.mailboxMessage(projectKey, uid ?? 0),
    queryFn: () => api.getMailboxMessage(projectKey, uid!),
    enabled: uid != null,
  });
}

export function useConnectMailbox(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MailboxSettingsInput) => api.updateMailboxSettings(projectKey, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.mailboxSettings(projectKey) });
      await queryClient.invalidateQueries({ queryKey: qk.mailboxMessages(projectKey) });
      toast.success('Zoho mailbox connected');
    },
  });
}

export function useDisconnectMailbox(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectMailbox(projectKey),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: qk.mailboxMessages(projectKey) });
      await queryClient.invalidateQueries({ queryKey: qk.mailboxSettings(projectKey) });
      toast.success('Mailbox disconnected');
    },
  });
}

export function useMarkMailboxRead(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uid: number) => api.markMailboxMessageRead(projectKey, uid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.mailboxMessages(projectKey) }),
  });
}

export function useSendMailboxMessage(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMailboxMessageInput) => api.sendMailboxMessage(projectKey, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.mailboxMessages(projectKey) });
      toast.success('Email sent');
    },
  });
}
