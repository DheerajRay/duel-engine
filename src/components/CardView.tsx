import React from 'react';
import { GameCard } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import { Sword, Sparkles, Ban, ChevronUp, Wand2, Zap } from 'lucide-react';
import { CARD_SPRING, getSharedTransition, useMotionPreference } from '../utils/motion';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';
import { getLocalizedCardText } from '../services/cardLocalization';

interface CardViewProps {
  card: GameCard | null;
  isHidden?: boolean;
  onClick?: () => void;
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  action?: 'attack' | 'activate' | null;
  onActionClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isHidden,
  onClick,
  className = '',
  isSelectable,
  isSelected,
  action,
  onActionClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { reduced } = useMotionPreference();
  const { language } = useAppPreferences();

  const renderCenterIcon = (activeCard: GameCard) => {
    if (action === 'attack') {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onActionClick?.(e); }}
          className="w-5 h-5 sm:w-6 sm:h-6 border border-white rounded flex items-center justify-center hover:bg-white hover:text-black transition-colors"
        >
          <ChevronUp size={12} />
        </button>
      );
    }

    if (action === 'activate') {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onActionClick?.(e); }}
          className="w-5 h-5 sm:w-6 sm:h-6 border border-white rounded flex items-center justify-center hover:bg-white hover:text-black transition-colors"
        >
          {activeCard.type === 'Spell' ? <Wand2 size={12} /> : <Zap size={12} />}
        </button>
      );
    }

    if (activeCard.type === 'Monster') return <Sword size={12} className="opacity-50" />;
    if (activeCard.type === 'Spell') return <Sparkles size={12} className="opacity-50" />;
    if (activeCard.type === 'Trap') return <Ban size={12} className="opacity-50" />;
    return null;
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {card ? (
        (() => {
          const localizedCard = getLocalizedCardText(card, language);
          return (
        <motion.div
          key={`${card.instanceId}-${card.position ?? 'unset'}-${isHidden ? 'hidden' : 'shown'}`}
          layout
          initial={{ opacity: 0, y: reduced ? 0 : 8, scale: reduced ? 1 : 0.98 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            rotate: card.position === 'defense' || card.position === 'set-monster' ? -90 : 0,
          }}
          exit={{ opacity: 0, y: reduced ? 0 : -6, scale: reduced ? 1 : 0.98 }}
          whileTap={{ scale: reduced ? 1 : 0.985 }}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded border cursor-pointer overflow-hidden flex flex-col p-1.5
            ${isSelected ? 'border-white ring-1 ring-white text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]' : isSelectable ? 'border-zinc-400 border-dashed text-zinc-300' : 'border-zinc-700 text-zinc-400'}
            ${isHidden || card.position === 'set-monster' || card.position === 'set-spell' ? 'bg-zinc-900' : 'bg-black'}
            ${className}
          `}
          transition={CARD_SPRING}
          style={{ transformOrigin: 'center' }}
        >
          {isHidden || card.position === 'set-monster' || card.position === 'set-spell' ? (
            <div className="w-full h-full flex items-center justify-center relative">
              <div className="w-6 h-6 border border-zinc-500 rotate-45 opacity-30" />
              {action && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {renderCenterIcon(card)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-col gap-1">
                <div className="text-[9px] sm:text-[10px] font-bold leading-tight uppercase tracking-wider line-clamp-2 text-white">{localizedCard.name}</div>
                {card.type === 'Monster' && (
                  <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] text-yellow-500 font-mono">
                    <span>&#9733;</span>
                    <span>{card.level}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center">
                {renderCenterIcon(card)}
              </div>

              {card.type === 'Monster' && (
                <div className="flex flex-col text-[8px] sm:text-[9px] font-mono opacity-80">
                  <span>A - {card.atk}</span>
                  <span>D - {card.def}</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
          );
        })()
      ) : (
        <motion.div
          key="empty-slot"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={getSharedTransition(reduced, 'fast')}
          className={`w-16 h-24 sm:w-20 sm:h-28 border border-dashed border-zinc-800 rounded bg-zinc-950/50 ${className}`}
          onClick={onClick}
        />
      )}
    </AnimatePresence>
  );
};
