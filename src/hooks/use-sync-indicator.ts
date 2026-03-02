import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  DatabaseSync01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useSyncStore } from '@/store/sync-store';

type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed';

const iconMap = {
  idle: DatabaseSync01Icon,
  syncing: Loading03Icon,
  completed: CheckmarkCircle01Icon,
  failed: Alert01Icon,
} as const;

export function useSyncIndicator() {
  const { _ } = useLingui();

  const status: SyncStatus = useSyncStore((state) => {
    if (state.syncing) return 'syncing';
    if (state.error || state.currentStage === 'failed') return 'failed';
    if (state.currentStage === 'completed') return 'completed';
    return 'idle';
  });

  const icon = iconMap[status];

  const titleMap: Record<SyncStatus, string> = {
    syncing: _(msg`Syncing...`),
    failed: _(msg`Sync failed`),
    completed: _(msg`Sync completed`),
    idle: _(msg`Sync Progress`),
  };

  return { status, icon, title: titleMap[status] };
}
