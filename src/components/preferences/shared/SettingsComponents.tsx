import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface SettingsFieldProps {
  label: ReactNode;
  children: ReactNode;
  description?: string;
  vertical?: boolean;
}

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SettingsField({ label, children, description, vertical }: SettingsFieldProps) {
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
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
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
