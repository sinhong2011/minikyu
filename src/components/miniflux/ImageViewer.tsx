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
  onRequestClose?: () => void;
  onViewIndexChange?: (index: number) => void;
}

export function ImageViewer({
  images,
  startIndex = 0,
  open,
  onOpenChange,
  onRequestClose,
  onViewIndexChange,
}: ImageViewerProps) {
  const slides = images.map((image) => ({
    src: image.src,
    alt: image.alt,
  }));
  const requestClose = useCallback(() => {
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    onOpenChange(false);
  }, [onOpenChange, onRequestClose]);
  const isBackdropAreaClick = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    if (
      target.closest('.yarl__slide_image') ||
      target.closest('.yarl__toolbar') ||
      target.closest('.yarl__thumbnails') ||
      target.closest('.yarl__navigation_prev') ||
      target.closest('.yarl__navigation_next') ||
      target.closest('.yarl__button')
    ) {
      return false;
    }

    return true;
  }, []);

  const resetView = useCallback(() => {
    const lightbox = document.querySelector('.yarl__slide_image');
    if (lightbox) {
      (lightbox as HTMLElement).style.transform = '';
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        requestClose();
        return;
      }

      switch (e.key) {
        case 'r':
        case 'R':
          e.preventDefault();
          resetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, requestClose, resetView]);

  useEffect(() => {
    const handleBackdropPointer = (target: EventTarget | null) => {
      if (!open) {
        return false;
      }

      if (!(target instanceof Element)) {
        return false;
      }

      if (!target.closest('.yarl__portal')) {
        return false;
      }

      if (!isBackdropAreaClick(target)) {
        return false;
      }

      requestClose();
      return true;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!handleBackdropPointer(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!handleBackdropPointer(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!handleBackdropPointer(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('touchstart', handleTouchStart, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('touchstart', handleTouchStart, true);
    };
  }, [isBackdropAreaClick, open, requestClose]);

  const handleSlidePointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isBackdropAreaClick(event.target)) {
        return;
      }

      if (!open) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestClose();
    },
    [isBackdropAreaClick, open, requestClose]
  );

  return (
    <Lightbox
      open={open}
      close={requestClose}
      index={startIndex}
      slides={slides}
      animation={{
        fade: 420,
      }}
      on={{
        view: ({ index }) => {
          onViewIndexChange?.(index);
        },
      }}
      plugins={[Download, Zoom, Counter, Thumbnails]}
      controller={{
        closeOnBackdropClick: false,
        closeOnPullDown: false,
      }}
      carousel={{
        spacing: '30%',
        imageFit: 'contain',
        padding: '8%',
      }}
      zoom={{
        maxZoomPixelRatio: 4,
        zoomInMultiplier: 2,
        scrollToZoom: true,
        pinchZoomV4: true,
      }}
      thumbnails={{
        border: 1,
        borderColor: 'transparent',
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
        buttonClose: () => (
          <button
            key="custom-close-button"
            type="button"
            className="yarl__button"
            aria-label="Close"
            onClick={requestClose}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        ),
        slideContainer: ({ children }) => (
          <div className="yarl__fullsize" onPointerDownCapture={handleSlidePointerDownCapture}>
            {children}
          </div>
        ),
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
          // biome-ignore lint/style/useNamingConvention: vendor-prefixed CSS property
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          '--yarl__fade_animation_duration': '420ms',
          '--yarl__fade_animation_timing_function': 'cubic-bezier(0.22, 1, 0.36, 1)',
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
