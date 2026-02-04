import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';
import { Switch } from '@/components/animate-ui/components/base/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

export function AdvancedPane() {
  const { _ } = useLingui();
  const [exampleAdvancedToggle, setExampleAdvancedToggle] = useState(false);
  const [exampleDropdown, setExampleDropdown] = useState('option1');

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`Example Advanced Settings`)}>
        <SettingsField
          label={_(msg`Example Advanced Toggle`)}
          description={_(msg`This is an example advanced toggle setting (not persisted)`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="example-advanced-toggle"
              checked={exampleAdvancedToggle}
              onCheckedChange={setExampleAdvancedToggle}
            />
            <Label htmlFor="example-advanced-toggle" className="text-sm">
              {exampleAdvancedToggle ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Example Dropdown Setting`)}
          description={_(msg`This is an example dropdown/select setting (not persisted)`)}
        >
          <Select value={exampleDropdown} onValueChange={setExampleDropdown}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">{_(msg`Example Option 1`)}</SelectItem>
              <SelectItem value="option2">{_(msg`Example Option 2`)}</SelectItem>
              <SelectItem value="option3">{_(msg`Example Option 3`)}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
