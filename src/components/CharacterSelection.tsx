
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CHARACTERS, Character } from "../lib/characters";
import { Sparkles, ChevronRight, User as UserIcon, ShieldCheck, Cpu } from "lucide-react";

interface CharacterSelectionProps {
  onSelect: (characterId: string) => void;
  userName: string;
}

export default function CharacterSelection({ onSelect, userName }: CharacterSelectionProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const currentCharacter = selectedIdx !== null ? CHARACTERS[selectedIdx] : null;

  return (
    <div className="flex min-h-screen bg-[#05070a] items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCharacter?.id || 'default'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[160px] opacity-20"
            style={{ 
              background: `radial-gradient(circle, ${currentCharacter?.color || '#8B5CF6'} 0%, transparent 70%)` 
            }}
          />
          <div 
            className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10"
            style={{ 
              background: `radial-gradient(circle, ${currentCharacter?.secondaryColor || '#06B6D4'} 0%, transparent 70%)` 
            }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="w-full max-w-5xl relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-4 tracking-tight">
            Choose Your <span className="text-primary">Digital Identity</span>
          </h2>
          <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed">
            မင်္ဂလာပါ {userName}။ <br />
            Khittara AI ရဲ့ ခရီးစဉ်မှာ အစ်ကို့ကို လမ်းပြပေးမယ့် ကာရိုက်တာတစ်ခုကို ရွေးချယ်ပေးပါရှင်။ ✨💖
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {CHARACTERS.map((char, idx) => (
            <motion.div
              key={char.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.2 }}
              onClick={() => setSelectedIdx(idx)}
              className={`
                relative cursor-pointer group rounded-[40px] p-1 transition-all duration-500
                ${selectedIdx === idx ? 'scale-105' : 'hover:scale-[1.02]'}
              `}
            >
              {/* Outer Glow Wrapper */}
              <div 
                className={`
                  absolute inset-0 rounded-[40px] blur-xl opacity-0 transition-opacity duration-500
                  ${selectedIdx === idx ? 'opacity-30' : 'group-hover:opacity-10'}
                `}
                style={{ backgroundColor: char.color }}
              />

              <div className={`
                relative h-full glass-panel rounded-[39px] p-8 border backdrop-blur-3xl overflow-hidden
                ${selectedIdx === idx ? 'border-white/20' : 'border-white/5 hover:border-white/10'}
              `}>
                {/* Character Icon / Avatar Area */}
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative">
                    <div 
                      className="w-20 h-20 rounded-3xl flex items-center justify-center p-0.5"
                      style={{ 
                        background: `linear-gradient(135deg, ${char.color}, ${char.secondaryColor})` 
                      }}
                    >
                      <div className="w-full h-full rounded-[22px] bg-[#0c0c0c] flex items-center justify-center">
                        {char.gender === 'male' ? (
                          <UserIcon style={{ color: char.color }} className="w-10 h-10" />
                        ) : (
                          <Sparkles style={{ color: char.color }} className="w-10 h-10" />
                        )}
                      </div>
                    </div>
                    {selectedIdx === idx && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg z-10"
                      >
                        <ShieldCheck size={18} />
                      </motion.div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{char.myanmarName}</h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">{char.name}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1 rounded bg-white/5">
                      <Cpu size={14} className="text-primary/60" />
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed font-light">
                      {char.description}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {char.tone.split(',').map((t, i) => (
                      <span key={i} className="text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/5 text-white/40 uppercase tracking-tighter">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Select Button in Card */}
                <button
                  onClick={() => onSelect(char.id)}
                  className={`
                    w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3
                    ${selectedIdx === idx 
                      ? 'bg-white text-black shadow-2xl scale-[1.02]' 
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}
                  `}
                >
                  Confirm Choice
                  <ChevronRight size={18} className={selectedIdx === idx ? 'translate-x-0' : 'opacity-0'} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action Button for the whole section */}
        <div className="mt-16 text-center">
          <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-medium">
             ဖန်တီးသူ MinThitSarAung
          </p>
        </div>
      </div>
    </div>
  );
}
