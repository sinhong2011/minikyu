import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface FeedAvatarProps {
  domain: string;
  title: string;
  size?: 'sm' | 'lg' | 'default';
  className?: string;
  iconService?: 'google' | 'duckduckgo';
}

export function FeedAvatar({
  domain,
  title,
  size = 'sm',
  className,
  iconService = 'google',
}: FeedAvatarProps) {
  let faviconUrl: string;

  if (iconService === 'duckduckgo') {
    faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } else {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(domain).hostname}&sz=32`;
  }

  return (
    <Avatar size={size} className={cn('rounded-sm', className)}>
      <AvatarImage src={faviconUrl} alt={title} />
      <AvatarFallback className="rounded-sm">{title.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
