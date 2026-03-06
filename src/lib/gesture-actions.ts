import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Globe02Icon,
  MailOpen01Icon,
  StarIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

export interface GestureAction {
  id: string;
  label: MessageDescriptor;
  icon: IconSvgElement | null;
}

export const gestureActions: GestureAction[] = [
  { id: 'open_in_app_browser', label: msg`Open in browser`, icon: Globe02Icon },
  { id: 'open_in_external_browser', label: msg`Open in external browser`, icon: Globe02Icon },
  { id: 'toggle_read', label: msg`Toggle read/unread`, icon: MailOpen01Icon },
  { id: 'toggle_star', label: msg`Toggle star`, icon: StarIcon },
  { id: 'next_article', label: msg`Next article`, icon: ArrowDown01Icon },
  { id: 'prev_article', label: msg`Previous article`, icon: ArrowUp01Icon },
  { id: 'close_browser', label: msg`Close browser`, icon: Cancel01Icon },
  { id: 'none', label: msg`None (disabled)`, icon: null },
];

export function getGestureAction(id: string): GestureAction | undefined {
  return gestureActions.find((a) => a.id === id);
}
