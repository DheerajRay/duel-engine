import React, { useState } from 'react';
import { ArrowLeft, Sword, Shield, Zap, Sparkles, Ban, Clock, Skull, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '../hooks/useIsMobile';
import { getSharedTransition, useMotionPreference } from '../utils/motion';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';

interface HowToPlayProps {
  onBack: () => void;
  embeddedInShell?: boolean;
}

export default function HowToPlay({ onBack, embeddedInShell = false }: HowToPlayProps) {
  const { reduced } = useMotionPreference();
  const { t } = useAppPreferences();
  const isMobile = useIsMobile();
  const mobileLayout = embeddedInShell && isMobile;
  const [activeTab, setActiveTab] = useState<'basics' | 'cards' | 'phases'>('basics');
  const sectionTabs = [
    { id: 'basics', label: t('basics'), icon: <Sword size={11} /> },
    { id: 'cards', label: t('cardTypes'), icon: <Sparkles size={11} /> },
    { id: 'phases', label: t('turnPhases'), icon: <Clock size={11} /> },
  ] as const;

  return (
    <div className={`${mobileLayout ? 'theme-screen flex h-full min-h-0 flex-col' : 'theme-screen h-dvh md:h-screen box-border overflow-hidden font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0'}`}>
      {!mobileLayout && (
        <div className="theme-screen theme-divider h-14 md:h-12 border-b flex items-center justify-between px-3 md:px-6 z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <motion.button 
              onClick={onBack}
              whileTap={{ scale: reduced ? 1 : 0.98 }}
              className="theme-subtle hover:text-[var(--app-text-primary)] transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
            >
              <ArrowLeft size={14} /> {t('back')}
            </motion.button>
            <div className="theme-divider mx-2 h-4 w-px"></div>
            <h1 className="theme-eyebrow hidden sm:block text-xs">{t('howToPlay')}</h1>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 flex ${mobileLayout ? 'flex-col' : 'flex-col sm:flex-row'} overflow-hidden min-h-0`}>
        
        {/* Navigation Sidebar */}
        <div className={`theme-screen theme-divider w-full ${mobileLayout ? '' : 'sm:w-64'} ${mobileLayout ? 'border-b' : 'border-b sm:border-b-0 sm:border-r'} flex flex-col shrink-0 overflow-y-auto`}>
          <div className="theme-divider p-4 border-b flex justify-center items-center shrink-0 hidden sm:flex">
            <h2 className="theme-eyebrow text-[10px]">{t('helpNavigation')}</h2>
          </div>
          {mobileLayout ? (
            <div className="border-b border-[var(--app-border)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="theme-eyebrow text-[8px]">{t('duelRules')}</div>
                  <div className="theme-title mt-1 text-[12px] uppercase tracking-[0.04em]">{t('gameplayRules')}</div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {sectionTabs.map((tab) => (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      whileTap={{ scale: reduced ? 1 : 0.985 }}
                      className={`flex h-8 w-8 items-center justify-center border transition-colors ${
                        activeTab === tab.id ? 'theme-button' : 'theme-button-subtle'
                      }`}
                      aria-label={tab.label}
                    >
                      {tab.icon}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div
            className="flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-visible p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {sectionTabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: reduced ? 1 : 0.985 }}
                className={`flex min-w-0 items-center justify-center sm:justify-start gap-2 px-2 py-1.5 text-xs font-mono uppercase tracking-[0.16em] transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'theme-chip-active' : 'theme-chip'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </motion.button>
            ))}
          </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className={`theme-screen flex-1 ${mobileLayout ? 'overflow-y-auto px-3 py-3' : 'overflow-y-auto p-4 md:p-12'} min-h-0`}>
          <div className={`${mobileLayout ? 'mx-auto max-w-2xl' : 'max-w-3xl mx-auto'}`}>
            <AnimatePresence mode="wait">
              
              {activeTab === 'basics' && (
                <motion.div
                  key="basics"
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className={`${mobileLayout ? 'space-y-8' : 'space-y-12'}`}
                >
                <section>
                  <h2 className="theme-eyebrow theme-divider mb-6 border-b pb-2 text-xs">{t('objective')}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`theme-elevated flex flex-col items-center text-center ${mobileLayout ? 'gap-3 p-5' : 'gap-4 p-6'}`}>
                      <div className="theme-button-subtle w-10 h-10 flex items-center justify-center">
                        <Heart size={16} />
                      </div>
                      <h3 className="theme-title text-xs uppercase tracking-widest">{t('lifePoints')}</h3>
                      <p className="theme-muted text-xs leading-relaxed">
                        {t('helpObjectiveLifePointsBody')}
                      </p>
                    </div>
                    <div className={`theme-elevated flex flex-col items-center text-center ${mobileLayout ? 'gap-3 p-5' : 'gap-4 p-6'}`}>
                      <div className="theme-button-subtle w-10 h-10 flex items-center justify-center">
                        <Skull size={16} />
                      </div>
                      <h3 className="theme-title text-xs uppercase tracking-widest">{t('deckOut')}</h3>
                      <p className="theme-muted text-xs leading-relaxed">
                        {t('helpObjectiveDeckOutBody')}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="theme-eyebrow theme-divider mb-6 border-b pb-2 text-xs">{t('helpCoreRules')}</h2>
                  <ul className="space-y-4">
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">1</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleSummonLimits')}</p>
                    </li>
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">2</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleFieldLimits')}</p>
                    </li>
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">3</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleBattleAttackAttack')}</p>
                    </li>
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">4</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleBattleAttackDefense')}</p>
                    </li>
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">5</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleDirectAttacks')}</p>
                    </li>
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">6</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleFirstTurn')}</p>
                    </li>
                    <li className="theme-elevated flex gap-4 items-start p-4">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">7</div>
                      <p className="theme-muted text-xs leading-relaxed">{t('helpRuleFusion')}</p>
                    </li>
                  </ul>
                </section>
              </motion.div>
            )}

            {activeTab === 'cards' && (
              <motion.div
                key="cards"
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                transition={getSharedTransition(reduced, 'normal')}
                className="space-y-8"
              >
                {/* Monster Cards */}
                <div className="theme-panel border">
                  <div className="theme-divider p-4 flex items-center gap-3 border-b">
                    <Sword size={14} className="text-white" />
                    <h2 className="theme-title text-xs font-bold uppercase tracking-widest">{t('helpMonsterCards')}</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="theme-muted space-y-4 text-xs leading-relaxed">
                      <p>{t('helpMonsterBody')}</p>
                      
                      <div className="theme-elevated p-4 space-y-3">
                        <h3 className="theme-title font-bold uppercase text-[10px] tracking-widest">{t('helpEffectTypes')}</h3>
                        <ul className="space-y-2">
                          <li>{t('helpEffectNormal')}</li>
                          <li>{t('helpEffectEffect')}</li>
                          <li>{t('helpEffectFusion')}</li>
                        </ul>
                      </div>

                      <div className="theme-elevated p-4 space-y-3">
                        <h3 className="theme-title font-bold uppercase text-[10px] tracking-widest">{t('helpPositions')}</h3>
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-6 bg-zinc-800 border border-zinc-600 shrink-0"></div>
                          <span>{t('helpPositionAttack')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-4 bg-zinc-800 border border-zinc-600 shrink-0"></div>
                          <span>{t('helpPositionDefense')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="theme-elevated h-fit p-4 space-y-3">
                      <h3 className="theme-title font-bold uppercase text-[10px] tracking-widest">{t('helpTributeSummoning')}</h3>
                      <p className="theme-muted text-xs">{t('helpTributeBody')}</p>
                      <ul className="theme-muted text-xs space-y-2 mt-4 font-mono">
                        <li className="flex justify-between border-b border-zinc-800 pb-2">
                          <span>{t('helpLevel14')}</span>
                          <span className="text-white">{t('helpNoTributes')}</span>
                        </li>
                        <li className="flex justify-between border-b border-zinc-800 pb-2">
                          <span>{t('helpLevel56')}</span>
                          <span className="text-white">{t('helpOneTribute')}</span>
                        </li>
                        <li className="flex justify-between pb-1">
                          <span>{t('helpLevel7plus')}</span>
                          <span className="text-white">{t('helpTwoTributes')}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Spell Cards */}
                <div className="theme-panel border">
                  <div className="theme-divider p-4 flex items-center gap-3 border-b">
                    <Sparkles size={14} className="text-white" />
                    <h2 className="theme-title text-xs font-bold uppercase tracking-widest">{t('helpSpellCards')}</h2>
                  </div>
                  <div className="theme-muted p-6 text-xs leading-relaxed space-y-6">
                    <p>{t('helpSpellBody')}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="theme-elevated p-4">
                        <strong className="theme-title block mb-1 font-mono text-[10px] tracking-widest uppercase">{t('helpActivate')}</strong>
                        {t('helpActivateBody')}
                      </div>
                      <div className="theme-elevated p-4">
                        <strong className="theme-title block mb-1 font-mono text-[10px] tracking-widest uppercase">{t('helpSet')}</strong>
                        {t('helpSetBody')}
                      </div>
                    </div>

                    <div className="theme-elevated p-4 space-y-3">
                      <h3 className="theme-title font-bold uppercase text-[10px] tracking-widest">{t('helpSpellTypes')}</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        <li>{t('helpSpellNormal')}</li>
                        <li>{t('helpSpellEquip')}</li>
                        <li>{t('helpSpellContinuous')}</li>
                        <li>{t('helpSpellField')}</li>
                        <li>{t('helpSpellQuickPlay')}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Trap Cards */}
                <div className="theme-panel border">
                  <div className="theme-divider p-4 flex items-center gap-3 border-b">
                    <Ban size={14} className="text-white" />
                    <h2 className="theme-title text-xs font-bold uppercase tracking-widest">{t('helpTrapCards')}</h2>
                  </div>
                  <div className="theme-muted p-6 text-xs leading-relaxed space-y-6">
                    <p>{t('helpTrapBody')}</p>
                    
                    <div className="theme-elevated p-4 space-y-3">
                      <h3 className="theme-title font-bold uppercase text-[10px] tracking-widest">{t('helpTrapTypes')}</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        <li>{t('helpTrapNormal')}</li>
                        <li>{t('helpTrapContinuous')}</li>
                        <li>{t('helpTrapCounter')}</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'phases' && (
              <motion.div
                key="phases"
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                transition={getSharedTransition(reduced, 'normal')}
                className="space-y-6"
              >
                <h2 className="theme-eyebrow theme-divider mb-6 border-b pb-2 text-xs">{t('turnPhases')}</h2>
                <p className="theme-muted mb-6 text-xs leading-relaxed">{t('helpPhasesBody')}</p>
                
                <div className="space-y-0">
                  {[
                    { id: t('phaseDP'), name: t('phaseDraw'), desc: t('helpPhaseDrawBody') },
                    { id: t('phaseM1'), name: t('phaseMain1'), desc: t('helpPhaseM1Body') },
                    { id: t('phaseBP'), name: t('phaseBattle'), desc: t('helpPhaseBattleBody') },
                    { id: t('phaseM2'), name: t('phaseMain2'), desc: t('helpPhaseM2Body') },
                    { id: t('phaseEP'), name: t('phaseEnd'), desc: t('helpPhaseEndBody') },
                  ].map((phase, i) => (
                    <div key={phase.id} className="flex gap-6 group">
                      <div className="flex flex-col items-center">
                        <div className="theme-elevated group-hover:bg-[var(--app-accent)] group-hover:text-[var(--app-accent-contrast)] flex h-10 w-10 items-center justify-center font-mono font-bold transition-colors shrink-0 text-[10px] tracking-widest">
                          {phase.id}
                        </div>
                        {i < 4 && <div className="theme-divider my-2 h-8 w-px"></div>}
                      </div>
                      <div className="pb-8 pt-2">
                        <h3 className="theme-title mb-2 text-[10px] uppercase tracking-widest">{phase.name}</h3>
                        <p className="theme-muted text-xs leading-relaxed">{phase.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
