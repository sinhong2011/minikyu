import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SettingsFieldProps {
  label: ReactNode;
  children: ReactNode;
  description?: string;
  vertical?: boolean;
  /**
   * Stack the control below the label on narrow screens. Use for wide controls
   * (theme pickers, button groups) that would otherwise crush the label column.
   */
  stackOnMobile?: boolean;
}

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SettingsField({
  label,
  children,
  description,
  vertical,
  stackOnMobile,
}: SettingsFieldProps) {
  if (vertical) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-4',
        stackOnMobile
          ? 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
          : 'items-center justify-between'
      )}
    >
      <div className="min-w-0">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className={stackOnMobile ? 'min-w-0 sm:shrink-0' : 'shrink-0'}>{children}</div>
    </div>
  );
}

export function SettingsSection({ title, children, action }: SettingsSectionProps) {
  return (
    <div className="space-y-4 pb-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          {action}
        </div>
        <Separator className="mt-2" />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
