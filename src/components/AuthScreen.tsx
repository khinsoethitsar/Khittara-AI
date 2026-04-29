import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Brain, Cpu, Globe, Zap, Languages, ChevronRight, Gamepad2, ShieldCheck, Heart, AlertCircle, Loader2, Github } from "lucide-react";
import { useState, useEffect } from "react";
import { signInWithGoogle, signInWithGithub } from "../lib/firebase";
import { cn } from "../lib/utils";

const features = [
  {
    icon: <Heart className="w-10 h-10 text-pink-500" />,
    title: "Ka-Laung (ကလောင်)",
    description: "တစ်ဦးတည်းသော ညီမလေးလို နွေးထွေးတဲ့ Digital Assistant အဖြစ် ကူညီပေးမှာပါရှင်။ ✨💖",
    color: "from-pink-500/20 to-violet-500/20"
  },
  {
    icon: <Zap className="w-10 h-10 text-amber-500" />,
    title: "Arindama (အရိန္ဒမ)",
    description: "နည်းပညာပိုင်းဆိုင်ရာ ထူးချွန်ပြီး ဗျူဟာမြောက် လက်ထောက်အဖြစ် အကောင်းဆုံး လမ်းပြပေးမှာပါ။ ✊⚔️",
    color: "from-amber-500/20 to-blue-500/20"
  },
  {
    icon: <Brain className="w-10 h-10 text-cyan-500" />,
    title: "Strategic Wisdom",
    description: "ရှေ့ကို အလှမ်းတစ်ရာ ကြိုတွက်ဆပြီး အောင်မြင်မှုဆီကို အတူတူ လှမ်းတက်ကြစို့။ 🌸👸",
    color: "from-cyan-500/20 to-blue-500/20"
  },
  {
    icon: <Cpu className="w-10 h-10 text-emerald-500" />,
    title: "Advanced Engine",
    description: "Gemini 2.0 Flash ရဲ့ အစွမ်းနဲ့ အမြန်ဆုံး မေးမြန်းဖြေဆိုမှုတွေကို ရရှိစေမှာပါရှင်။ ⚡🚀",
    color: "from-emerald-500/20 to-teal-500/20"
  }
];

export default function AuthScreen() {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [lang, setLang] = useState<'my' | 'en'>('my');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGithub();
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthError = (err: any) => {
    console.error("Sign in failed:", err);
    let message = err.message || "Sign in failed";
    
    const isIframe = window.self !== window.top;
    
    // Map Firebase error codes to user-friendly messages
    if (err.code === 'auth/popup-closed-by-user') {
      if (isIframe) {
        message = lang === 'my'
          ? "အစ်ကို Login Window ကို ပိတ်လိုက်တဲ့အတွက် (ဒါမှမဟုတ် Browser က Block လိုက်တဲ့အတွက်) အကောင့်ဝင်လို့ မရပါဘူးရှင်။ အကောင်းဆုံးကတော့ App ကို Tab အသစ်မှာဖွင့်ပြီး Login ဝင်ကြည့်ပါဦးနော်။ ✨💖"
          : "The sign-in popup was closed. Please try again and ensure you complete the process in the popup window.";
      } else {
        message = lang === 'my' 
          ? "အစ်ကို Login Window ကို ပိတ်လိုက်တဲ့အတွက် အကောင့်ဝင်လို့ မရပါဘူးရှင်။ ကျေးဇူးပြုပြီး နောက်တစ်ခေါက် ပြန်ကြိုးစားပြီး Login window ထဲမှာ အချက်အလက်တွေကို အဆုံးထိ ဖြည့်ပေးပါဦးနော်။ ✨💖"
          : "The sign-in popup was closed. Please try again and ensure you complete the process in the popup window.";
      }
    } else if (err.code === 'auth/popup-blocked') {
      message = lang === 'my'
        ? "အစ်ကို့ Browser က Popup တွေကို Block ထားလို့ ဝင်လို့မရပါဘူးရှင်။ ကျေးဇူးပြုပြီး Popup block ကို ပိတ်ပေးပါဦးနော်။ (ဒါမှမဟုတ် Tab အသစ်မှာ App ကို ဖွင့်ပြီး စမ်းကြည့်ပါရှင်) ✨🔐"
        : "Popups are blocked by your browser. Please disable the popup blocker or try opening the app in a new tab.";
    } else if (err.code === 'auth/unauthorized-domain') {
      const currentDomain = window.location.hostname;
      message = lang === 'my'
        ? `Domain "${currentDomain}" ကို Firebase Console ထဲမှာ Authorize လုပ်ရဦးမှာပါရှင်။ အောက်က Authorize domains settings ထဲမှာ ဒီ link ကို ထည့်ပေးပါဦးနော်။ ✨🔗`
        : `Domain "${currentDomain}" is not authorized. Please add it to your Firebase Authorized Domains list.`;
    } else if (err.code === 'auth/cancelled-popup-request') {
      message = lang === 'my'
        ? "Login လုပ်ဖို့ ကြိုးစားမှုက တစ်ခုထက်မက ဖြစ်နေလို့ပါရှင်။ ခဏလေး စောင့်ပေးပါဦးနော်။ ✨⏳"
        : "Multiple sign-in attempts detected. Please wait a moment.";
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      message = lang === 'my'
        ? "ဒီ Email နဲ့ တခြား အကောင့်တစ်ခု ရှိနှင့်နေပြီးသား ဖြစ်နေလို့ပါရှင်။ (ဥပမာ Google နဲ့ အရင်ဝင်ဖူးရင် Google နဲ့ပဲ ပြန်ဝင်ပေးပါနော်) ✨🔐"
        : "An account already exists with the same email address but different sign-in credentials. Please use your original sign-in method.";
    }
    
    setError(message);
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen bg-[#050510] overflow-hidden text-white font-sans relative">
      {/* Dynamic Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Deep Background Canvas - Purple and Gold Fusion */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#2e0b5a] via-[#050510] to-[#3a2800]" />
        
        {/* Animated Glows - Royal Gold & Deep Purple */}
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.6, 0.4],
            x: [0, 60, 0],
            y: [0, -60, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-25%] right-[-15%] w-[90%] h-[90%] bg-amber-400/30 blur-[180px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            scale: [1.3, 1, 1.3],
            opacity: [0.4, 0.6, 0.4],
            x: [0, -60, 0],
            y: [0, 60, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-25%] left-[-15%] w-[90%] h-[90%] bg-violet-600/30 blur-[180px] rounded-full" 
        />
        
        {/* Extra Gold Brilliance Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-amber-500/5 blur-[200px] rounded-full" />
        
        {/* Mesh Overlay */}
        <div className="absolute inset-0 opacity-[0.15] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        
        {/* Vignette with Purple tint */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(15,5,30,0.8)_100%)]" />
      </div>

      {/* Left Side: Advertising / Feature Showcase */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-center items-center p-12 overflow-hidden border-r border-white/5">
        {/* Background Aura */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeature}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 1 }}
            className={`absolute inset-0 bg-gradient-to-br ${features[currentFeature].color} opacity-20 blur-[120px]`}
          />
        </AnimatePresence>

        <div className="relative z-10 w-full max-w-lg">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.4)]">
                <Sparkles className="w-6 h-6 text-[#050510]" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase">Khittara <span className="text-amber-500">AI</span></h1>
                <p className="text-[10px] uppercase tracking-[0.4em] text-amber-500/60 font-bold">The Future of Ancient Wisdom</p>
              </div>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentFeature}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="p-[1px] rounded-3xl bg-gradient-to-br from-amber-500/30 via-purple-500/30 to-transparent">
                <div className="glass-panel p-10 rounded-[28px] border border-white/5 bg-[#0a0a15]/40 backdrop-blur-xl">
                  <div className="mb-6 inline-block p-4 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
                    {features[currentFeature].icon}
                  </div>
                  <h2 className="text-4xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-200 to-white/70">
                    {features[currentFeature].title}
                  </h2>
                  <p className="text-lg text-white/50 leading-relaxed font-light">
                    {features[currentFeature].description}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                {features.map((_, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      currentFeature === idx ? "w-8 bg-amber-500" : "w-1.5 bg-white/10"
                    )}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Signature */}
        <div className="absolute bottom-10 left-12 text-[10px] uppercase tracking-[0.3em] font-medium text-amber-500/30">
          ဖန်တီးသူ MinThitSarAung
        </div>
      </div>

      {/* Right Side: Auth & Language */}
      <div className="w-full lg:w-[450px] bg-[#070712]/40 backdrop-blur-2xl flex flex-col p-8 md:p-12 relative border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        {/* Language Selection Header */}
        <div className="flex justify-between items-center mb-20">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <span className="font-bold text-sm">Khittara AI</span>
          </div>

          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 ml-auto">
            <button 
              onClick={() => setLang('my')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                lang === 'my' ? "bg-amber-500 text-[#050510] shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "text-white/40 hover:text-white"
              )}
            >
              မြန်မာ
            </button>
            <button 
              onClick={() => setLang('en')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                lang === 'en' ? "bg-amber-500 text-[#050510] shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "text-white/40 hover:text-white"
              )}
            >
              EN
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight leading-none text-white">
              {lang === 'my' ? "စတင်အသုံးပြုရန်" : "Get Started"}
              <span className="block text-amber-500 mt-2">
                {lang === 'my' ? "ဝင်ရောက်ပါရှင်" : "Sign In Now"}
              </span>
            </h2>
            <p className="text-sm text-white/40 font-light leading-relaxed">
              {lang === 'my' 
                ? "သမိုင်းဝင်ယဉ်ကျေးမှုနဲ့ ခေတ်သစ် AI တို့ရဲ့ ပေါင်းစည်းရာ Khittara AI မှ ကြိုဆိုရပါတယ်ရှင်။" 
                : "Experience the fusion of historic wisdom and modern artificial intelligence."}
            </p>
          </motion.div>

          <div className="space-y-4">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 overflow-hidden"
                >
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-3">
                    <p className="text-xs text-rose-500/90 leading-relaxed font-medium">
                      {error}
                    </p>
                    {error.includes("Tab") && (
                      <button 
                        onClick={openInNewTab}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 py-2 px-3 rounded-xl transition-all"
                      >
                        <Globe className="w-3 h-3" />
                        {lang === 'my' ? "Tab အသစ်မှာ ဖွင့်မည်" : "Open in New Tab"}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignIn}
              disabled={isLoading}
              className={cn(
                "w-full h-16 bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-[24px] font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(245,158,11,0.2)] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed",
                isLoading && "animate-pulse"
              )}
            >
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1.5 shadow-sm">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                ) : (
                  <img src="https://www.google.com/favicon.ico" className="w-full h-full" alt="Google" />
                )}
              </div>
              {isLoading 
                ? (lang === 'my' ? "ဝင်ရောက်နေဆဲ ... " : "Signing in...") 
                : (lang === 'my' ? "Google အကောင့်ဖြင့် ဝင်မည်" : "Continue with Google")}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGithubSignIn}
              disabled={isLoading}
              className={cn(
                "w-full h-16 bg-[#1a1a2e] border border-white/10 hover:border-white/20 text-white rounded-[24px] font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed",
                isLoading && "animate-pulse"
              )}
            >
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center shadow-sm">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <Github className="w-5 h-5" />
                )}
              </div>
              {isLoading 
                ? (lang === 'my' ? "ဝင်ရောက်နေဆဲ ... " : "Signing in...") 
                : (lang === 'my' ? "GitHub အကောင့်ဖြင့် ဝင်မည်" : "Continue with GitHub")}
            </motion.button>

            <div className="flex items-center gap-4 py-4 opacity-20">
              <div className="h-[1px] flex-1 bg-white" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Protocol</span>
              <div className="h-[1px] flex-1 bg-white" />
            </div>

            <p className="text-[10px] text-center text-white/20 leading-relaxed px-6">
              {lang === 'my' 
                ? "အကောင့်ဝင်ရောက်ခြင်းဖြင့် Khittara AI ၏ ဝန်ဆောင်မှုစည်းမျဉ်းများကို သဘောတူညီရာရောက်ပါတယ်ရှင်။ ✨🔐" 
                : "By continuing, you agree to our Terms of Service and Privacy Policy."}
            </p>
          </div>
        </div>

        {/* Floating Icons background for Mobile */}
        <div className="absolute inset-0 z-[-1] opacity-[0.03] pointer-events-none overflow-hidden lg:hidden">
          <div className="absolute top-20 left-10 rotate-12"><Brain size={120} /></div>
          <div className="absolute bottom-40 right-10 -rotate-12"><Cpu size={150} /></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Languages size={200} /></div>
        </div>
      </div>
    </div>
  );
}
