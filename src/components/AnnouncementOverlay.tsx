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
      <div className="max-w-xl border border-zinc-700 bg-black/95 px-5 py-4 text-center shadow-2xl backdrop-blur-sm">
        <div className="text-[11px] font-mono uppercase tracking-[0.3em] text-zinc-500 mb-2">
          {announcement.title}
        </div>
        <div className="text-sm sm:text-base font-mono leading-relaxed text-white">
          {announcement.message}
        </div>
      </div>
    </motion.div>
  );
}
