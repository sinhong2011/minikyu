import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface SettingsFieldProps {
  label: string;
  children: ReactNode;
  description?: string;
}

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SettingsField({ label, children, description }: SettingsFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function SettingsSection({ title, children, action }: SettingsSectionProps) {
  return (
    <div className="space-y-4">
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
