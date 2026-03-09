import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useGestureSettings } from '@/hooks/use-gesture-settings';
import { gestureActions } from '@/lib/gesture-actions';
import { SettingsSection } from '../shared/SettingsComponents';

function GestureActionSelect({
  value,
  onValueChange,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
}) {
  const { _ } = useLingui();
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="shrink-0 text-sm font-medium text-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {gestureActions.map((action) => (
            <SelectItem key={action.id} value={action.id}>
              <span className="flex items-center gap-2">
                {action.icon && (
                  <HugeiconsIcon icon={action.icon} className="size-4 text-muted-foreground" />
                )}
                {_(action.label)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function GesturePane() {
  const { _ } = useLingui();
  const {
    swipeLeftAction,
    swipeRightAction,
    pullTopAction,
    pullBottomAction,
    swipeThreshold,
    setSwipeLeftAction,
    setSwipeRightAction,
    setPullTopAction,
    setPullBottomAction,
    setSwipeThreshold,
  } = useGestureSettings();

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`Reading View`)}>
        <div className="space-y-3">
          <GestureActionSelect
            label={_(msg`Swipe left action`)}
            value={swipeLeftAction}
            onValueChange={setSwipeLeftAction}
          />
          <GestureActionSelect
            label={_(msg`Swipe right action`)}
            value={swipeRightAction}
            onValueChange={setSwipeRightAction}
          />
          <GestureActionSelect
            label={_(msg`Pull from top`)}
            value={pullTopAction}
            onValueChange={setPullTopAction}
          />
          <GestureActionSelect
            label={_(msg`Pull from bottom`)}
            value={pullBottomAction}
            onValueChange={setPullBottomAction}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={_(msg`Sensitivity`)}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label className="shrink-0 text-sm font-medium text-foreground">
              {_(msg`Swipe distance`)}
            </Label>
            <Slider
              className="w-56"
              value={[swipeThreshold]}
              min={100}
              max={400}
              step={10}
              onValueChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                setSwipeThreshold(v);
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {_(msg`Distance in pixels required to trigger a swipe action (${swipeThreshold}px)`)}
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
