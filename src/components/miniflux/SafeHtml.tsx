import { CheckmarkCircle01Icon, CopyIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import DOMPurify from 'dompurify';
import parse, {
  attributesToProps,
  domToReact,
  Element,
  type HTMLReactParserOptions,
} from 'html-react-parser';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';
import { ImageViewer } from './ImageViewer';

interface Image {
  src: string;
  alt?: string;
}

interface SafeHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

function CodeBlock({ children, text }: { children: React.ReactNode; text: string }) {
  const { copy, copied } = useClipboard();

  return (
    <div className="group relative my-6 first:mt-0 last:mb-0">
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-background"
          onClick={() => copy(text)}
          title="Copy code"
        >
          <HugeiconsIcon
            icon={copied ? CheckmarkCircle01Icon : CopyIcon}
            className={cn('h-4 w-4', copied && 'text-green-500')}
          />
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-muted/50 p-4 font-mono text-sm leading-relaxed border border-border/40">
        {children}
      </pre>
    </div>
  );
}

export function SafeHtml({ html, className, style }: SafeHtmlProps) {
  const [viewerImages, setViewerImages] = useState<Image[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showViewer, setShowViewer] = useState(false);

  const options: HTMLReactParserOptions = {
    replace: (domNode) => {
      if (!(domNode instanceof Element)) return;

      if (domNode.name === 'a' && domNode.children.length === 1) {
        const child = domNode.children[0];
        if (child instanceof Element && child.name === 'img') {
          const imgProps = attributesToProps(child.attribs);
          const src = typeof imgProps.src === 'string' ? imgProps.src : '';
          const alt = typeof imgProps.alt === 'string' ? imgProps.alt : 'Image';

          const handleImageClick = () => {
            const imgElements = Array.from(document.querySelectorAll('.safe-html-content img'));
            const images: Image[] = imgElements.map((img) => ({
              src: (img as HTMLImageElement).src,
              alt: (img as HTMLImageElement).alt,
            }));

            const clickedIndex = imgElements.findIndex(
              (img) => (img as HTMLImageElement).src === src
            );

            setViewerImages(images);
            setViewerIndex(clickedIndex >= 0 ? clickedIndex : 0);
            setShowViewer(true);
          };

          return (
            <button type="button" onClick={handleImageClick} className="cursor-pointer group/img">
              <img
                {...imgProps}
                src={src}
                alt={alt}
                className={cn(
                  'rounded-2xl transition-all group-hover/img:ring-4 group-hover/img:ring-primary/10 max-w-full h-auto mx-auto',
                  imgProps.className as string
                )}
              />
            </button>
          );
        }
      }

      if (domNode.name === 'img') {
        const props = attributesToProps(domNode.attribs);
        const src = typeof props.src === 'string' ? props.src : '';
        const alt = typeof props.alt === 'string' ? props.alt : 'Image';

        const handleImageClick = () => {
          const imgElements = Array.from(document.querySelectorAll('.safe-html-content img'));
          const images: Image[] = imgElements.map((img) => ({
            src: (img as HTMLImageElement).src,
            alt: (img as HTMLImageElement).alt,
          }));

          const clickedIndex = imgElements.findIndex(
            (img) => (img as HTMLImageElement).src === src
          );

          setViewerImages(images);
          setViewerIndex(clickedIndex >= 0 ? clickedIndex : 0);
          setShowViewer(true);
        };

        return (
          <button type="button" onClick={handleImageClick} className="cursor-pointer group/img">
            <img
              {...props}
              src={src}
              alt={alt}
              className={cn(
                'rounded-2xl transition-all group-hover/img:ring-4 group-hover/img:ring-primary/10 max-w-full h-auto mx-auto',
                props.className as string
              )}
            />
          </button>
        );
      }

      if (domNode.name === 'pre') {
        const getTextContent = (node: any): string => {
          if (node.type === 'text') return node.data;
          if (node.children) return node.children.map(getTextContent).join('');
          return '';
        };
        const textContent = getTextContent(domNode);

        return (
          <CodeBlock text={textContent}>{domToReact(domNode.children as any, options)}</CodeBlock>
        );
      }

      if (domNode.name === 'table') {
        return (
          <div className="my-6 overflow-x-auto rounded-xl border border-border/60 bg-muted/20">
            <table className="w-full border-collapse text-left text-sm">
              {domToReact(domNode.children as any, options)}
            </table>
          </div>
        );
      }

      if (domNode.name === 'th') {
        return (
          <th className="border-b border-border/60 bg-muted/40 px-4 py-3 font-semibold text-foreground">
            {domToReact(domNode.children as any, options)}
          </th>
        );
      }

      if (domNode.name === 'td') {
        return (
          <td className="border-b border-border/40 px-4 py-3">
            {domToReact(domNode.children as any, options)}
          </td>
        );
      }

      return undefined;
    },
  };

  const sanitizedHtml = useMemo(() => {
    return DOMPurify.sanitize(html, {
      // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
      USE_PROFILES: { html: true },
      // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
      ADD_ATTR: ['target', 'rel'],
    });
  }, [html]);

  return (
    <>
      <div className={cn('safe-html-content', className)} style={style}>
        {parse(sanitizedHtml, options)}
      </div>

      <ImageViewer
        images={viewerImages}
        startIndex={viewerIndex}
        open={showViewer}
        onOpenChange={(open) => {
          if (!open) {
            setShowViewer(false);
            setTimeout(() => {
              setViewerImages([]);
              setViewerIndex(0);
            }, 200);
          }
        }}
      />
    </>
  );
}
