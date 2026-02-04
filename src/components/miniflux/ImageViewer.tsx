import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Download01Icon,
  SearchAddFreeIcons,
  SearchMinusFreeIcons,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useCallback, useEffect } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Download from 'yet-another-react-lightbox/plugins/download';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import { commands } from '@/lib/tauri-bindings';

interface Image {
  src: string;
  alt?: string;
}

interface ImageViewerProps {
  images: Image[];
  startIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewer({ images, startIndex = 0, open, onOpenChange }: ImageViewerProps) {
  const slides = images.map((image) => ({
    src: image.src,
    alt: image.alt,
  }));

  const resetView = useCallback(() => {
    const lightbox = document.querySelector('.yarl__image');
    if (lightbox) {
      (lightbox as HTMLElement).style.transform = '';
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'r':
        case 'R':
          e.preventDefault();
          resetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, resetView]);

  return (
    <Lightbox
      open={open}
      close={() => onOpenChange(false)}
      index={startIndex}
      slides={slides}
      plugins={[Download, Zoom, Counter, Thumbnails]}
      controller={{
        closeOnBackdropClick: true,
        closeOnPullDown: true,
      }}
      carousel={{
        spacing: '30%',
        imageFit: 'contain',
        padding: '20%',
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        zoomInMultiplier: 2,
        scrollToZoom: true,
        pinchZoomV4: true,
      }}
      thumbnails={{
        border: 1,
        vignette: false,
      }}
      download={{
        download: ({ slide }) => {
          if (!slide?.src) return;

          const fileName = slide.src.split('/').pop() || 'image.jpg';
          commands.downloadFile(slide.src, fileName, 'image');
          // Download Manager is now handled via notifications, don't open automatically
          // setDownloadsOpen(true);
        },
      }}
      render={{
        iconClose: () => <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />,
        iconDownload: () => <HugeiconsIcon icon={Download01Icon} className="h-4 w-4" />,
        iconZoomIn: () => <HugeiconsIcon icon={SearchAddFreeIcons} className="h-4 w-4" />,
        iconZoomOut: () => <HugeiconsIcon icon={SearchMinusFreeIcons} className="h-4 w-4" />,
        iconNext: () => <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />,
        iconPrev: () => <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />,
      }}
      styles={{
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          '--yarl__thumbnails_thumbnail_active_border_color': 'var(--color-primary)',
        },
        container: {
          backgroundColor: 'transparent',
        },
        slide: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        thumbnail: {
          backgroundColor: 'transparent',
        },
        thumbnailsTrack: {
          backgroundColor: 'transparent',
        },
        thumbnailsContainer: {
          backgroundColor: 'transparent',
        },
      }}
    />
  );
}
