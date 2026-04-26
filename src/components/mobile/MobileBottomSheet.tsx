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
              aria-label={t('closeMobileSheet')}
              onClick={onClose}
              className="ui-overlay absolute inset-0"
            />
          )}
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 18 }}
            transition={getSharedTransition(reduced, 'normal')}
            className={`ui-sheet theme-panel relative z-10 w-full border-t ${activeHeightClassName} ${maxHeightClassName} overflow-hidden ${className}`}
          >
            <div className="theme-divider flex min-h-[var(--ui-sheet-header-height)] items-center justify-between border-b px-3 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-[2px] w-4 rounded-sm bg-[var(--app-border-strong)]" />
                {title ? (
                  <div className="ui-eyebrow truncate">
                    {title}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {expandable ? (
                  <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="theme-button-subtle flex h-7 w-7 items-center justify-center p-0 text-[var(--app-text-muted)]"
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-mono-label theme-subtle px-1 text-[8px]"
                >
                  {t('close')}
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2.5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
