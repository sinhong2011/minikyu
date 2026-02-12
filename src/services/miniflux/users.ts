import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { useIsConnected } from '@/services/miniflux/auth';

const translate = i18n._.bind(i18n);

// Query keys for user data
export const userQueryKeys = {
  all: ['miniflux', 'user'] as const,
  current: () => [...userQueryKeys.all, 'current'] as const,
  users: () => [...userQueryKeys.all, 'users'] as const,
};

/**
 * Hook to get current user data
 * Use this in any component that needs user information
 */
export function useCurrentUser() {
  const { data: isConnected } = useIsConnected();

  return useQuery({
    queryKey: userQueryKeys.current(),
    queryFn: async () => {
      logger.info('[useCurrentUser] Fetching current user data from backend');
      const result = await commands.getCurrentUser();

      if (result.status === 'error') {
        logger.error('[useCurrentUser] Failed to fetch current user', {
          error: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('[useCurrentUser] Current user data fetched successfully', {
        id: result.data.id,
        username: result.data.username,
        isAdmin: result.data.is_admin,
        language: result.data.language,
        timezone: result.data.timezone,
      });
      return result.data;
    },
    enabled: isConnected ?? false,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}

/**
 * Hook to fetch all users (admin endpoint).
 */
export function useMinifluxUsers(enabled: boolean = true) {
  const { data: isConnected } = useIsConnected();

  return useQuery({
    queryKey: userQueryKeys.users(),
    queryFn: async () => {
      logger.info('[useMinifluxUsers] Fetching users from backend');
      const result = await commands.getUsers();

      if (result.status === 'error') {
        logger.error('[useMinifluxUsers] Failed to fetch users', {
          error: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('[useMinifluxUsers] Users fetched successfully', {
        count: result.data.length,
      });
      return result.data;
    },
    enabled: enabled && (isConnected ?? false),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to create a new Miniflux user.
 */
export function useCreateMinifluxUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { username: string; password: string; isAdmin: boolean }) => {
      logger.info('[useCreateMinifluxUser] Creating user', {
        username: input.username,
        isAdmin: input.isAdmin,
      });
      const result = await commands.createUser({
        username: input.username,
        password: input.password,
        // biome-ignore lint/style/useNamingConvention: API field names
        is_admin: input.isAdmin,
      });

      if (result.status === 'error') {
        logger.error('[useCreateMinifluxUser] Failed to create user', {
          error: result.error,
          username: input.username,
        });
        toast.error(translate(msg`Failed to create user`), { description: result.error });
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
      toast.success(translate(msg`User created`));
    },
  });
}

/**
 * Hook to update an existing Miniflux user.
 */
export function useUpdateMinifluxUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      username,
      password,
    }: {
      id: string;
      username?: string;
      password?: string;
    }) => {
      const updates = {
        username: username?.trim() ? username.trim() : undefined,
        password: password?.trim() ? password.trim() : undefined,
      };

      logger.info('[useUpdateMinifluxUser] Updating user', { id });
      const result = await commands.updateUser(id, updates);

      if (result.status === 'error') {
        logger.error('[useUpdateMinifluxUser] Failed to update user', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to update user`), { description: result.error });
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
      toast.success(translate(msg`User updated`));
    },
  });
}

/**
 * Hook to delete a Miniflux user.
 */
export function useDeleteMinifluxUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.info('[useDeleteMinifluxUser] Deleting user', { id });
      const result = await commands.deleteUser(id);

      if (result.status === 'error') {
        logger.error('[useDeleteMinifluxUser] Failed to delete user', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to delete user`), { description: result.error });
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
      toast.success(translate(msg`User deleted`));
    },
  });
}
