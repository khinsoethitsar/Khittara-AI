import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [sparkles, setSparkles] = useState<{ id: number; top: number; left: number; size: number; delay: number; duration: number }[]>([]);

  useEffect(() => {
    // Generate fine golden sparkles
    const newSparkles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: 0.5 + Math.random() * 2,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 3
    }));
    setSparkles(newSparkles);

    const timer = setTimeout(() => {
      onComplete();
    }, 5500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-[#0B1120] flex flex-col items-center justify-between overflow-hidden font-sans py-12 px-6"
    >
      {/* Dynamic Celestial Aura Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#00F5FF]/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Fine Gold Star Dust */}
        {sparkles.map((sparkle) => (
          <motion.div
            key={sparkle.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0] }}
            transition={{ duration: sparkle.duration, delay: sparkle.delay, repeat: Infinity }}
            className="absolute bg-[#D4AF37] rounded-full"
            style={{
              top: `${sparkle.top}%`,
              left: `${sparkle.left}%`,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
              boxShadow: '0 0 4px rgba(212, 175, 55, 0.6)'
            }}
          />
        ))}
      </div>

      {/* Subtle Ancient Geometric Web (Fixed Layer) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-screen">
        <svg width="100%" height="100%">
          <pattern id="techPyuPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#D4AF37" strokeWidth="0.5" />
            <path d="M50 2 L50 98 M2 50 L98 50" stroke="#00F5FF" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#techPyuPattern)" />
        </svg>
      </div>

      {/* Top Section: Branding */}
      <div className="relative z-30 flex flex-col items-center justify-center text-center mt-10">
        <motion.div
          initial={{ opacity: 0, letterSpacing: "0.5em" }}
          animate={{ opacity: 1, letterSpacing: "0.15em" }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="relative px-8"
        >
          <h1 className="text-5xl md:text-7xl font-bold uppercase text-transparent bg-clip-text bg-gradient-to-b from-[#F7E7CE] via-[#D4AF37] to-[#B8860B] drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]">
            Khittara AI
          </h1>
          
          <motion.div 
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2, delay: 0.8 }}
            className="w-full h-[1px] mt-4 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-60" 
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.8, y: 0 }}
          transition={{ duration: 1.2, delay: 2.2 }}
          className="mt-6 text-[#D4AF37]/60 text-xs md:text-sm font-light tracking-[0.5em] uppercase"
        >
          Heritage meets Intelligence
        </motion.p>
      </div>

      {/* Main Branding Section (Stylized 'K') */}
      <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-72 h-72 md:w-[400px] md:h-[400px] flex items-center justify-center"
        >
          {/* Rotating Pulse Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 opacity-10"
          >
            <svg viewBox="0 0 512 512" className="w-full h-full fill-none stroke-[#D4AF37] stroke-[0.5]">
              <circle cx="256" cy="256" r="240" />
              <path d="M256 16 L256 64 M256 448 L256 496 M16 256 L64 256 M448 256 L496 256" />
            </svg>
          </motion.div>

          {/* Central Stylized 'K' Symbol */}
          <svg viewBox="0 0 512 512" className="w-full h-full filter drop-shadow-[0_0_40px_rgba(0,245,255,0.2)]">
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F7E7CE" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#B8860B" />
              </linearGradient>
              <linearGradient id="tealGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00F5FF" />
                <stop offset="100%" stopColor="#1DE9B6" />
              </linearGradient>
            </defs>

            <g transform="translate(140, 100) scale(0.8)">
              {/* Vertical Spine: Circuit Board Style */}
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
                d="M50 0 L50 400" 
                stroke="url(#tealGradient)" 
                strokeWidth="20" 
                strokeLinecap="round" 
                fill="none"
              />
              {/* Circuit Nodes */}
              <motion.circle initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} cx="50" cy="0" r="10" fill="#00F5FF" />
              <motion.circle initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} cx="50" cy="200" r="10" fill="#00F5FF" />
              <motion.circle initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} cx="50" cy="400" r="10" fill="#00F5FF" />
              
              {/* Top Branch: Kanote Bloom */}
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                d="M50 200 C150 150 250 50 300 0 Q350 -50 280 -20 Q220 20 250 50" 
                stroke="url(#goldGradient)" 
                strokeWidth="15" 
                strokeLinecap="round" 
                fill="none"
              />
              
              {/* Bottom Branch: Kanote Scroll */}
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: 0.8, ease: "easeInOut" }}
                d="M50 200 C150 250 250 350 300 400 Q350 450 280 420 Q220 380 250 350" 
                stroke="url(#goldGradient)" 
                strokeWidth="15" 
                strokeLinecap="round" 
                fill="none"
              />
            </g>
          </svg>
          
          {/* Ambient Glow */}
          <motion.div
            animate={{ opacity: [0.02, 0.1, 0.02], scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute w-48 h-48 bg-[#00F5FF]/10 rounded-full blur-[60px]"
          />
        </motion.div>
      </div>

      {/* Footer Branding Area */}
      <div className="w-full flex flex-col items-center gap-6 z-30">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 3.5 }}
          className="flex flex-col items-center"
        >
          <div className="text-[10px] tracking-[0.8em] text-[#D4AF37]/50 uppercase font-light mb-2">
            AI Evolution
          </div>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1, delay: 4.5 }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-[10px] tracking-[0.2em] text-[#F7E7CE] font-bold">
            ဖန်တီးသူ MinThitSarAung
          </span>
          <span className="text-[8px] tracking-[0.4em] text-white/20 uppercase font-light">
            Khittara AI Developer
          </span>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift {
          from { background-position: 0 0; }
          to { background-position: 120px 120px; }
        }
        .animate-drift {
          animation: drift 60s linear infinite;
        }
      `}} />

      {/* Lighting Effects */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </motion.div>
  );
}
