import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getSharedTransition, useMotionPreference } from '../../utils/motion';

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  maxHeightClassName?: string;
  compactHeightClassName?: string;
  showBackdrop?: boolean;
  className?: string;
}

export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  expandable = false,
  expanded = false,
  onToggleExpanded,
  maxHeightClassName = 'max-h-[84vh]',
  compactHeightClassName = 'max-h-[56vh]',
  showBackdrop = true,
  className = '',
}: MobileBottomSheetProps) {
  const { reduced } = useMotionPreference();
  const activeHeightClassName = expanded ? maxHeightClassName : compactHeightClassName;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={getSharedTransition(reduced, 'fast')}
          className="fixed inset-0 z-50 flex items-end md:hidden"
        >
          {showBackdrop && (
            <button
              type="button"
              aria-label="Close mobile sheet"
              onClick={onClose}
              className="absolute inset-0 bg-black/70"
            />
          )}
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 18 }}
            transition={getSharedTransition(reduced, 'normal')}
            className={`relative z-10 w-full rounded-t-[22px] border-t border-zinc-700 bg-zinc-950 shadow-[0_-16px_48px_rgba(0,0,0,0.45)] ${activeHeightClassName} ${maxHeightClassName} overflow-hidden ${className}`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-1.5 w-10 rounded-full bg-zinc-700" />
                {title ? (
                  <div className="truncate text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500">
                    {title}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {expandable ? (
                  <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="rounded-full border border-zinc-800 p-1 text-zinc-500"
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
