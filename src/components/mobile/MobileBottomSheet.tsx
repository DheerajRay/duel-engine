import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getSharedTransition, useMotionPreference } from '../../utils/motion';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider';

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
  const { t } = useAppPreferences();
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
            className={`theme-panel relative z-10 w-full rounded-t-[22px] border-t ${activeHeightClassName} ${maxHeightClassName} overflow-hidden ${className}`}
          >
            <div className="theme-divider flex items-center justify-between border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-1.5 w-10 rounded-full bg-[var(--app-border-strong)]" />
                {title ? (
                  <div className="theme-eyebrow truncate text-[10px]">
                    {title}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {expandable ? (
                  <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="theme-button-subtle rounded-full p-1"
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="theme-subtle text-[10px] font-mono uppercase tracking-[0.2em]"
                >
                  {t('close')}
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
