import { motion } from 'motion/react';
import { AnnouncementItem } from '../hooks/useAnnouncementQueue';
import { getSharedTransition } from '../utils/motion';

export function AnnouncementOverlay({
  announcement,
  reduced,
  className,
}: {
  announcement: AnnouncementItem;
  reduced: boolean;
  className: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: reduced ? 1 : 0.97, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: reduced ? 1 : 0.99, y: reduced ? 0 : -6 }}
      transition={getSharedTransition(reduced, 'normal')}
      className={className}
    >
      <div className="theme-panel max-w-xl px-5 py-4 text-center backdrop-blur-sm">
        <div className="theme-eyebrow mb-2 text-[11px]">
          {announcement.title}
        </div>
        <div className="theme-title text-sm sm:text-base leading-relaxed">
          {announcement.message}
        </div>
      </div>
    </motion.div>
  );
}
