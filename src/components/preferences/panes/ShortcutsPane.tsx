import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { useShortcutConfig } from '@/hooks/use-shortcut-config';
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_GROUP_LABELS,
  SHORTCUT_GROUP_ORDER,
} from '@/lib/shortcut-registry';
import { KeyCapture } from '../KeyCapture';
import { SettingsSection } from '../shared/SettingsComponents';

export function ShortcutsPane() {
  const { _ } = useLingui();
  const { getShortcut, setShortcut, resetAll, overrides } = useShortcutConfig();

  const hasOverrides = overrides && Object.keys(overrides).length > 0;

  return (
    <div className="space-y-6">
      {SHORTCUT_GROUP_ORDER.map((groupId) => {
        const actions = SHORTCUT_ACTIONS.filter((a) => a.group === groupId);
        if (actions.length === 0) return null;

        return (
          <SettingsSection key={groupId} title={_(SHORTCUT_GROUP_LABELS[groupId])}>
            <div className="space-y-0.5">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.07] transition-colors"
                >
                  <span className="text-sm text-muted-foreground">{_(action.label)}</span>
                  <KeyCapture
                    value={getShortcut(action.id)}
                    defaultValue={action.defaultKey}
                    onChange={(shortcut) => setShortcut(action.id, shortcut)}
                  />
                </div>
              ))}
            </div>
          </SettingsSection>
        );
      })}

      {hasOverrides && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={resetAll}>
            {_(msg`Reset all to defaults`)}
          </Button>
        </div>
      )}
    </div>
  );
}
