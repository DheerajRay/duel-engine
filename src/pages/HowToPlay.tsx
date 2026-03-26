import React, { useState } from 'react';
import { ArrowLeft, Sword, Shield, Zap, Sparkles, Ban, Clock, Skull, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSharedTransition, useMotionPreference } from '../utils/motion';

interface HowToPlayProps {
  onBack: () => void;
}

export default function HowToPlay({ onBack }: HowToPlayProps) {
  const { reduced } = useMotionPreference();
  const [activeTab, setActiveTab] = useState<'basics' | 'cards' | 'phases'>('basics');

  return (
    <div className="h-dvh md:h-screen box-border overflow-hidden bg-black text-white font-sans flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:p-0">
      {/* Header */}
      <div className="h-14 md:h-12 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 bg-black z-10 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <motion.button 
            onClick={onBack}
            whileTap={{ scale: reduced ? 1 : 0.98 }}
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> Back
          </motion.button>
          <div className="h-4 w-px bg-zinc-800 mx-2"></div>
          <h1 className="text-xs font-mono text-zinc-500 uppercase tracking-widest hidden sm:block">How to Play</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
        
        {/* Navigation Sidebar */}
        <div className="w-full sm:w-64 bg-black border-b sm:border-b-0 sm:border-r border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-zinc-800 flex justify-center items-center shrink-0 hidden sm:flex">
            <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Navigation</h2>
          </div>
          <div className="p-3 sm:p-4 flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {[
              { id: 'basics', label: 'The Basics', icon: <Sword size={14} /> },
              { id: 'cards', label: 'Card Types', icon: <Sparkles size={14} /> },
              { id: 'phases', label: 'Turn Phases', icon: <Clock size={14} /> },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                whileTap={{ scale: reduced ? 1 : 0.985 }}
                className={`flex items-center justify-center sm:justify-start gap-3 px-4 py-3 text-[10px] sm:text-xs font-mono uppercase tracking-widest transition-colors border border-transparent whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-zinc-900 text-white border-zinc-700' 
                    : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300 hover:border-zinc-800'
                }`}
              >
                {tab.icon}
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-zinc-950 overflow-y-auto p-4 md:p-12 min-h-0">
          <div className="max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              
              {activeTab === 'basics' && (
                <motion.div
                  key="basics"
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                  transition={getSharedTransition(reduced, 'normal')}
                  className="space-y-12"
                >
                <section>
                  <h2 className="text-xs font-mono uppercase tracking-widest mb-6 text-zinc-400 border-b border-zinc-800 pb-2">The Objective</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-black border border-zinc-800 p-6 flex flex-col items-center text-center gap-4">
                      <div className="w-10 h-10 border border-zinc-700 flex items-center justify-center text-white">
                        <Heart size={16} />
                      </div>
                      <h3 className="text-xs font-mono uppercase tracking-widest text-white">Life Points (LP)</h3>
                      <p className="text-zinc-500 text-xs leading-relaxed">
                        Both players start with <strong className="text-white">8000 LP</strong>. The first player to reduce their opponent's LP to 0 wins the duel.
                      </p>
                    </div>
                    <div className="bg-black border border-zinc-800 p-6 flex flex-col items-center text-center gap-4">
                      <div className="w-10 h-10 border border-zinc-700 flex items-center justify-center text-white">
                        <Skull size={16} />
                      </div>
                      <h3 className="text-xs font-mono uppercase tracking-widest text-white">Deck Out</h3>
                      <p className="text-zinc-500 text-xs leading-relaxed">
                        If a player must draw a card but has <strong className="text-white">0 cards</strong> left in their deck, they instantly lose the duel.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xs font-mono uppercase tracking-widest mb-6 text-zinc-400 border-b border-zinc-800 pb-2">Core Rules</h2>
                  <ul className="space-y-4">
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">1</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">Summoning Limits:</strong> You can only perform <strong className="text-white">one Normal Summon or Set</strong> per turn. High-level monsters (Level 5+) require you to Tribute monsters you already control.</p>
                    </li>
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">2</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">Field Limits:</strong> You can have a maximum of <strong className="text-white">5 Monsters</strong> and <strong className="text-white">5 Spells/Traps</strong> on the field at once.</p>
                    </li>
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">3</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">Battling (Attack vs Attack):</strong> When attacking an Attack Position monster, compare ATK values. The monster with lower ATK is destroyed, and its controller loses LP equal to the difference.</p>
                    </li>
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">4</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">Battling (Attack vs Defense):</strong> When attacking a Defense Position monster, compare your ATK to their DEF. If your ATK is higher, it's destroyed, but the opponent takes <strong className="text-white">no LP damage</strong>.</p>
                    </li>
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">5</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">Direct Attacks:</strong> If your opponent controls no monsters, your monsters can attack directly, dealing their full ATK as damage to the opponent's LP.</p>
                    </li>
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">6</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">First Turn Restrictions:</strong> The player who goes first cannot declare an attack on their very first turn.</p>
                    </li>
                    <li className="flex gap-4 items-start bg-black p-4 border border-zinc-800">
                      <div className="mt-0.5 w-5 h-5 bg-white text-black flex items-center justify-center font-mono font-bold text-[10px] shrink-0">7</div>
                      <p className="text-zinc-500 text-xs leading-relaxed"><strong className="text-white">Fusion Summoning:</strong> You can Fusion Summon a monster from your Extra Deck by activating a Fusion Spell Card (like Polymerization) and sending the listed Fusion Materials from your hand or field to the Graveyard.</p>
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
                <div className="border border-zinc-800 bg-black">
                  <div className="border-b border-zinc-800 p-4 flex items-center gap-3 bg-zinc-950">
                    <Sword size={14} className="text-white" />
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest">Monster Cards</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 text-zinc-500 text-xs leading-relaxed">
                      <p>Used to attack your opponent and defend your Life Points. They have Attack (ATK) and Defense (DEF) stats.</p>
                      
                      <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-3">
                        <h3 className="font-bold text-white uppercase text-[10px] tracking-widest font-mono">Effect Types</h3>
                        <ul className="space-y-2">
                          <li><strong className="text-white">Normal:</strong> Monsters with no special abilities.</li>
                          <li><strong className="text-white">Effect:</strong> Monsters with special abilities that can trigger or be activated.</li>
                          <li><strong className="text-white">Fusion:</strong> Powerful monsters stored in your Extra Deck. They require specific materials and a Fusion Spell (like Polymerization) to summon.</li>
                        </ul>
                      </div>

                      <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-3">
                        <h3 className="font-bold text-white uppercase text-[10px] tracking-widest font-mono">Positions</h3>
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-6 bg-zinc-800 border border-zinc-600 shrink-0"></div>
                          <span><strong className="text-white">Attack:</strong> Face-up vertical. Uses ATK stat. Can declare attacks.</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-4 bg-zinc-800 border border-zinc-600 shrink-0"></div>
                          <span><strong className="text-white">Defense:</strong> Face-down horizontal. Uses DEF stat. Cannot attack.</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-3 h-fit">
                      <h3 className="font-bold text-white uppercase text-[10px] tracking-widest font-mono">Tribute Summoning</h3>
                      <p className="text-xs text-zinc-500">High-level monsters require you to send monsters from your field to the Graveyard to summon them.</p>
                      <ul className="text-xs space-y-2 text-zinc-500 mt-4 font-mono">
                        <li className="flex justify-between border-b border-zinc-800 pb-2">
                          <span>Level 1-4</span>
                          <span className="text-white">No Tributes</span>
                        </li>
                        <li className="flex justify-between border-b border-zinc-800 pb-2">
                          <span>Level 5-6</span>
                          <span className="text-white">1 Tribute</span>
                        </li>
                        <li className="flex justify-between pb-1">
                          <span>Level 7+</span>
                          <span className="text-white">2 Tributes</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Spell Cards */}
                <div className="border border-zinc-800 bg-black">
                  <div className="border-b border-zinc-800 p-4 flex items-center gap-3 bg-zinc-950">
                    <Sparkles size={14} className="text-white" />
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest">Spell Cards</h2>
                  </div>
                  <div className="p-6 text-zinc-500 text-xs leading-relaxed space-y-6">
                    <p>Powerful magic cards that can be played directly from your hand during your Main Phase.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-zinc-950 p-4 border border-zinc-800">
                        <strong className="text-white block mb-1 font-mono text-[10px] tracking-widest uppercase">Activate</strong>
                        Play face-up to trigger its effect immediately.
                      </div>
                      <div className="bg-zinc-950 p-4 border border-zinc-800">
                        <strong className="text-white block mb-1 font-mono text-[10px] tracking-widest uppercase">Set</strong>
                        Place face-down on the field to use later.
                      </div>
                    </div>

                    <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-3">
                      <h3 className="font-bold text-white uppercase text-[10px] tracking-widest font-mono">Spell Types</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        <li><strong className="text-white">Normal:</strong> One-time use, goes to Graveyard.</li>
                        <li><strong className="text-white">Equip:</strong> Attaches to a monster to boost it.</li>
                        <li><strong className="text-white">Continuous:</strong> Stays on the field indefinitely.</li>
                        <li><strong className="text-white">Field:</strong> Affects the whole board, placed in Field Zone.</li>
                        <li><strong className="text-white">Quick-Play:</strong> Can be played during opponent's turn if set.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Trap Cards */}
                <div className="border border-zinc-800 bg-black">
                  <div className="border-b border-zinc-800 p-4 flex items-center gap-3 bg-zinc-950">
                    <Ban size={14} className="text-white" />
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest">Trap Cards</h2>
                  </div>
                  <div className="p-6 text-zinc-500 text-xs leading-relaxed space-y-6">
                    <p>Surprise cards used to disrupt your opponent. They <strong className="text-white">must be Set (face-down) first</strong> and cannot be activated on the turn they are set.</p>
                    
                    <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-3">
                      <h3 className="font-bold text-white uppercase text-[10px] tracking-widest font-mono">Trap Types</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        <li><strong className="text-white">Normal:</strong> One-time use, goes to Graveyard.</li>
                        <li><strong className="text-white">Continuous:</strong> Stays on the field indefinitely.</li>
                        <li><strong className="text-white">Counter:</strong> Fastest speed, used to negate other actions.</li>
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
                <h2 className="text-xs font-mono uppercase tracking-widest mb-6 text-zinc-400 border-b border-zinc-800 pb-2">Turn Structure</h2>
                
                <div className="space-y-0">
                  {[
                    { id: 'DP', name: 'Draw Phase', desc: 'The turn player automatically draws 1 card from their deck.' },
                    { id: 'M1', name: 'Main Phase 1', desc: 'Summon/Set monsters, activate Spells, and Set Traps. You can change monster battle positions here.' },
                    { id: 'BP', name: 'Battle Phase', desc: 'Declare attacks with your Attack Position monsters. Each monster can attack once.' },
                    { id: 'M2', name: 'Main Phase 2', desc: 'Second chance to Summon/Set or play Spells/Traps if you haven\'t already used your limits.' },
                    { id: 'EP', name: 'End Phase', desc: 'The turn ends and passes to the opponent.' },
                  ].map((phase, i) => (
                    <div key={phase.id} className="flex gap-6 group">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-black border border-zinc-800 flex items-center justify-center font-mono font-bold text-white group-hover:bg-white group-hover:text-black transition-colors shrink-0 text-[10px] tracking-widest">
                          {phase.id}
                        </div>
                        {i < 4 && <div className="w-px h-8 bg-zinc-800 my-2"></div>}
                      </div>
                      <div className="pb-8 pt-2">
                        <h3 className="text-[10px] font-mono uppercase tracking-widest text-white mb-2">{phase.name}</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed">{phase.desc}</p>
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
