'use client';

import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  InformationCircleIcon,
  Loading02Icon,
  OctagonIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner';
import { copyToClipboard } from '@/hooks/use-clipboard';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-green-600" />,
        info: <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-blue-600" />,
        warning: <HugeiconsIcon icon={Alert01Icon} className="size-4 text-amber-600" />,
        error: <HugeiconsIcon icon={OctagonIcon} className="size-4 text-red-600" />,
        loading: <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

// Toast action component with hover-only copy button
const CopyToastAction = ({ message, description }: { message: string; description?: string }) => {
  const { _ } = useLingui();

  const handleCopy = async () => {
    const text = description ? `${message}\n${description}` : message;
    const success = await copyToClipboard(text);
    if (success) {
      // Show a brief confirmation toast
      toast.success(_(msg`Copied!`), { duration: 1000 });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-muted rounded"
      aria-label={_(msg`Copy message`)}
    >
      <HugeiconsIcon icon={Copy01Icon} className="size-3" />
    </button>
  );
};

// Enhanced toast functions with copy functionality
const showToast = {
  success: (message: string, description?: string) => {
    return toast.success(message, {
      description,
      duration: 5000, // Increased from default 4000ms
      action: <CopyToastAction message={message} description={description} />,
    });
  },
  error: (message: string, description?: string) => {
    return toast.error(message, {
      description,
      duration: 5000, // Increased from default 4000ms
      action: <CopyToastAction message={message} description={description} />,
    });
  },
  info: (message: string, description?: string) => {
    return toast.info(message, {
      description,
      duration: 5000, // Increased from default 4000ms
      action: <CopyToastAction message={message} description={description} />,
    });
  },
  warning: (message: string, description?: string) => {
    return toast.warning(message, {
      description,
      duration: 5000, // Increased from default 4000ms
      action: <CopyToastAction message={message} description={description} />,
    });
  },
  loading: (message: string, description?: string) => {
    return toast.loading(message, { description });
  },
  custom: (message: string, description?: string) => {
    return toast(message, {
      description,
      duration: 5000, // Increased from default 4000ms
      action: <CopyToastAction message={message} description={description} />,
    });
  },
  dismiss: toast.dismiss,
  promise: toast.promise,
};

export { Toaster, showToast };
