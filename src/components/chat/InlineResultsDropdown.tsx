import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image as ImageIcon, Film, MapPin, Music, Globe } from 'lucide-react';

interface InlineResult {
  id: string;
  bot_id: string;
  result_id: string;
  result_type: string;
  title: string;
  description: string | null;
  content: string | null;
  thumbnail_url: string | null;
  reply_markup: any;
}

interface InlineResultsDropdownProps {
  results: InlineResult[];
  botUsername: string;
  onSelectResult: (result: InlineResult) => void;
  onClose: () => void;
}

const typeIcon: Record<string, React.ReactNode> = {
  article: <FileText className="h-4 w-4 text-primary" />,
  photo: <ImageIcon className="h-4 w-4 text-primary" />,
  video: <Film className="h-4 w-4 text-primary" />,
  gif: <Film className="h-4 w-4 text-primary" />,
  audio: <Music className="h-4 w-4 text-primary" />,
  file: <FileText className="h-4 w-4 text-primary" />,
  location: <MapPin className="h-4 w-4 text-primary" />,
};

const InlineResultsDropdown: React.FC<InlineResultsDropdownProps> = ({
  results, botUsername, onSelectResult, onClose,
}) => {
  if (results.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="px-4 py-2 border-t border-border bg-tg-sidebar"
      >
        <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border bg-secondary/50 flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Results from <span className="text-primary font-semibold">@{botUsername}</span>
            </span>
          </div>

          {/* Results */}
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onSelectResult(result)}
              className="flex items-start gap-3 w-full px-3 py-2.5 hover:bg-tg-hover transition-colors text-left border-b border-border/50 last:border-0"
            >
              {result.thumbnail_url ? (
                <img
                  src={result.thumbnail_url}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {typeIcon[result.result_type] || typeIcon.article}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{result.title}</p>
                {result.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{result.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InlineResultsDropdown;
