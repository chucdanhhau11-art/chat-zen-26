import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  allImages?: { src: string; alt?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, allImages, initialIndex = 0, onClose }) => {
  const images = allImages && allImages.length > 0 ? allImages : [{ src, alt }];
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  const current = images[index];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex(i => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [images.length, onClose]);

  useEffect(() => { setScale(1); }, [index]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
        onClick={onClose}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10" onClick={e => e.stopPropagation()}>
          <span className="text-white/70 text-sm">
            {images.length > 1 && `${index + 1} / ${images.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.min(3, s + 0.5))} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
              <ZoomIn className="h-5 w-5" />
            </button>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
              <ZoomOut className="h-5 w-5" />
            </button>
            <a href={current.src} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
              <Download className="h-5 w-5" />
            </a>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Nav arrows */}
        {images.length > 1 && index > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setIndex(i => i - 1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {images.length > 1 && index < images.length - 1 && (
          <button
            onClick={e => { e.stopPropagation(); setIndex(i => i + 1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <motion.img
          key={current.src}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          src={current.src}
          alt={current.alt || ''}
          style={{ transform: `scale(${scale})` }}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg transition-transform duration-200 select-none"
          onClick={e => e.stopPropagation()}
          draggable={false}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageLightbox;
