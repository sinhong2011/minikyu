import { CheckmarkCircle02Icon, Link02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Integration } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface IntegrationsPaneProps {
  integrations: Integration | null;
  isLoading: boolean;
}

// Integration service metadata
const INTEGRATION_SERVICES = [
  {
    id: 'wallabag',
    name: 'Wallabag',
    description: 'Save and read articles later',
    enabledKey: 'wallabag_enabled' as const,
  },
  {
    id: 'shiori',
    name: 'Shiori',
    description: 'Simple bookmark manager',
    enabledKey: 'shiori_enabled' as const,
  },
  {
    id: 'pocket',
    name: 'Pocket',
    description: 'Bookmarking service',
    enabledKey: 'pocket_enabled' as const,
  },
  {
    id: 'instapaper',
    name: 'Instapaper',
    description: 'Save text for later reading',
    enabledKey: 'instapaper_enabled' as const,
  },
  {
    id: 'pinboard',
    name: 'Pinboard',
    description: 'Social bookmarking',
    enabledKey: 'pinboard_enabled' as const,
  },
  {
    id: 'shaarli',
    name: 'Shaarli',
    description: 'Microblogging platform',
    enabledKey: 'shaarli_enabled' as const,
  },
  {
    id: 'raindrop',
    name: 'Raindrop',
    description: 'All-in-one bookmark manager',
    enabledKey: 'raindrop_enabled' as const,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Send notifications to Discord',
    enabledKey: 'discord_enabled' as const,
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    description: 'Send notifications via Telegram',
    enabledKey: 'telegram_bot_enabled' as const,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications to Slack',
    enabledKey: 'slack_enabled' as const,
  },
  {
    id: 'matrix',
    name: 'Matrix Bot',
    description: 'Send notifications to Matrix',
    enabledKey: 'matrix_bot_enabled' as const,
  },
  {
    id: 'ntfy',
    name: 'Ntfy',
    description: 'Push notifications via Ntfy',
    enabledKey: 'ntfy_enabled' as const,
  },
  {
    id: 'pushover',
    name: 'Pushover',
    description: 'Push notification service',
    enabledKey: 'pushover_enabled' as const,
  },
  {
    id: 'apprise',
    name: 'Apprise',
    description: 'Notification framework',
    enabledKey: 'apprise_enabled' as const,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Send to custom webhook',
    enabledKey: 'webhook_enabled' as const,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Save to Notion database',
    enabledKey: 'notion_enabled' as const,
  },
  {
    id: 'linkace',
    name: 'LinkAce',
    description: 'Link archive manager',
    enabledKey: 'linkace_enabled' as const,
  },
  {
    id: 'linkding',
    name: 'Linkding',
    description: 'Bookmark manager',
    enabledKey: 'linkding_enabled' as const,
  },
  {
    id: 'linkwarden',
    name: 'Linkwarden',
    description: 'Collaborative bookmark manager',
    enabledKey: 'linkwarden_enabled' as const,
  },
  {
    id: 'betula',
    name: 'Betula',
    description: 'Bookmarking software',
    enabledKey: 'betula_enabled' as const,
  },
  {
    id: 'cubox',
    name: 'Cubox',
    description: 'Content collection tool',
    enabledKey: 'cubox_enabled' as const,
  },
  {
    id: 'omnivore',
    name: 'Omnivore',
    description: 'Read-later service',
    enabledKey: 'omnivore_enabled' as const,
  },
  {
    id: 'readeck',
    name: 'Readeck',
    description: 'Bookmark management',
    enabledKey: 'readeck_enabled' as const,
  },
  {
    id: 'readwise',
    name: 'Readwise Reader',
    description: 'Read-later & highlights',
    enabledKey: 'readwise_reader_enabled' as const,
  },
  {
    id: 'nunux_keeper',
    name: 'Nunux Keeper',
    description: 'Link management',
    enabledKey: 'nunux_keeper_enabled' as const,
  },
  {
    id: 'espial',
    name: 'Espial',
    description: 'Link archive service',
    enabledKey: 'espial_enabled' as const,
  },
  {
    id: 'rss_bridge',
    name: 'RSS Bridge',
    description: 'RSS feed generator',
    enabledKey: 'rss_bridge_enabled' as const,
  },
] as const;

export function IntegrationsPane({ integrations, isLoading }: IntegrationsPaneProps) {
  const { _ } = useLingui();

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="text-sm">
          <h3 className="font-semibold">{_(msg`Integration Services`)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {_(msg`Manage third-party service integrations.`)}
          </p>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Skeleton className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Group services by enabled status
  const enabledServices = INTEGRATION_SERVICES.filter((service) =>
    integrations ? integrations[service.enabledKey] : false
  );
  const disabledServices = INTEGRATION_SERVICES.filter((service) =>
    integrations ? !integrations[service.enabledKey] : false
  );

  const enabledCount = enabledServices.length;
  const totalCount = INTEGRATION_SERVICES.length;

  return (
    <section className="min-w-0 space-y-4">
      <div className="text-sm">
        <h3 className="font-semibold">{_(msg`Integration Services`)}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {_(
            msg`Manage third-party service integrations. Configure services in Miniflux settings.`
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Badge variant="secondary">
          {enabledCount} {_(msg`enabled`)}
        </Badge>
        <span className="text-muted-foreground">
          {_(msg`of`)} {totalCount} {_(msg`services`)}
        </span>
      </div>

      {/* Enabled Services */}
      {enabledServices.length > 0 && (
        <div className="min-w-0 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">
            {_(msg`Enabled Services`)}
          </h4>
          <div className="space-y-2">
            {enabledServices.map((service) => (
              <div
                key={service.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3 py-2',
                  'bg-primary/5 border-primary/20'
                )}
              >
                <HugeiconsIcon icon={Link02Icon} className="size-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{service.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {_(msg`Enabled`)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {service.description}
                  </p>
                </div>
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-4 text-primary shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disabled Services */}
      {disabledServices.length > 0 && (
        <div className="min-w-0 space-y-2">
          {enabledServices.length > 0 && (
            <h4 className="text-xs font-semibold text-muted-foreground">
              {_(msg`Available Services`)}
            </h4>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {disabledServices.map((service) => (
              <div key={service.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <HugeiconsIcon icon={Link02Icon} className="size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{service.name}</span>
                  <p className="truncate text-xs text-muted-foreground">{service.description}</p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {_(msg`Disabled`)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {integrations && enabledCount === 0 && (
        <div className="text-center py-8">
          <HugeiconsIcon icon={Link02Icon} className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {_(msg`No integration services enabled`)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {_(msg`Configure services in Miniflux server settings.`)}
          </p>
        </div>
      )}
    </section>
  );
}
