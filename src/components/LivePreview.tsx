import React, { useState, useEffect, useContext } from "react";
import { LiveProvider, LiveEditor, LiveError, LivePreview as ReactLivePreview, LiveContext } from "react-live";
import { Terminal, Maximize2, Minimize2, Copy, Check, Play, RefreshCw, Layout, Code2, Wand2, Loader2, AlertCircle, Eye, Rocket, Smartphone, Tablet, Monitor, Github, ChevronRight, Save, Send, X } from "lucide-react";
import { cn } from "../lib/utils";
import { getPlaygroundCode, getApiKey, setPlaygroundCode, getStagedActions, getAiMode, setPreviewError, getSavedRepoInfo, getGithubToken, setStagedActionsStore } from "../lib/store";
import * as LucideIcons from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fixCode } from "../lib/gemini";
import { createFile } from "../lib/github";

const INITIAL_CODE = `
function WelcomeApp() {
  return (
    <div className="p-12 bg-slate-950 min-h-[400px] flex items-center justify-center rounded-[32px] overflow-hidden relative border border-white/5">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.05]" 
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/50 backdrop-blur-3xl border border-white/10 p-10 rounded-[40px] shadow-2xl max-w-md w-full relative z-10 text-center"
      >
        <div className="w-20 h-20 bg-primary/20 rounded-[28px] flex items-center justify-center mx-auto mb-8 border border-primary/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-pulse">
          <Rocket className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-4xl font-black mb-4 text-white tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
          KHITTARA AI ✨
        </h2>
        
        <p className="text-white/40 text-xs mb-10 leading-relaxed font-medium uppercase tracking-[0.2em]">
          အစ်ကို MinThitSarAung အတွက် <br/>Digital Sister ညီမလေး Ka-Laung ပါရှင်။ ✨💖
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
            <Sparkles className="w-5 h-5 text-amber-400 mx-auto mb-2" />
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Creative</span>
          </div>
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Secure</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-3 py-4 bg-primary rounded-3xl text-slate-950 font-black text-[10px] uppercase tracking-[0.3em] shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:brightness-110 active:scale-95 transition-all cursor-pointer">
          <Zap size={14} className="fill-current" />
          Engine Active
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-500/60 tracking-widest uppercase">Live Preview Synced</span>
        </div>
      </motion.div>
    </div>
  );
}
`.trim();

const scope = {
  ...LucideIcons,
  cn,
  useState,
  useEffect,
  motion,
  AnimatePresence
};

const theme = {
  plain: { color: "#e0e0e0", backgroundColor: "transparent" },
  styles: [
    { types: ["prolog", "constant", "builtin"], style: { color: "#82aaff" } },
    { types: ["inserted", "function"], style: { color: "#c3e88d" } },
    { types: ["deleted"], style: { color: "#ff5370" } },
    { types: ["changed"], style: { color: "#ffcb6b" } },
    { types: ["keyword", "variable"], style: { color: "#c792ea" } },
    { types: ["string", "char"], style: { color: "#ecc48d" } },
    { types: ["tag"], style: { color: "#7fdbca" } },
    { types: ["attr-name"], style: { color: "#addb67", fontStyle: "italic" } },
  ],
};

interface LivePreviewProps {
  isSplit?: boolean;
  onClose?: () => void;
}

export default function LivePreview({ isSplit, onClose }: LivePreviewProps) {
  const [code, setCode] = useState(getPlaygroundCode() || INITIAL_CODE);
  
  // Clean code for react-live
  const cleanCode = (raw: string) => {
    let cleaned = raw;
    
    // 1. Remove all import statements (they crash react-live)
    cleaned = cleaned.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?/gm, '');
    
    // 2. Extract component name from export default
    let componentName = "App";
    const exportMatch = cleaned.match(/export\s+default\s+(?:function\s+)?([a-zA-Z0-9_]+)/);
    if (exportMatch && exportMatch[1]) {
      componentName = exportMatch[1];
    }

    // 3. Clean exports but keep the functions
    cleaned = cleaned.replace(/^export\s+default\s+function/gm, 'function');
    cleaned = cleaned.replace(/^export\s+default/gm, '');
    cleaned = cleaned.replace(/^export\s+const/gm, 'const');
    cleaned = cleaned.replace(/^export\s+type/gm, 'type');
    cleaned = cleaned.replace(/^export\s+interface/gm, 'interface');

    // 4. Ensure render() is called if using noInline={true}
    if (!cleaned.includes('render(')) {
      // Look for function components
      const funcMatch = cleaned.match(/function\s+([A-Z][a-zA-Z0-9_]*)/);
      // Look for arrow function components
      const arrowMatch = cleaned.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/);
      
      if (funcMatch && funcMatch[1]) {
        componentName = funcMatch[1];
      } else if (arrowMatch && arrowMatch[1]) {
        componentName = arrowMatch[1];
      }
      
      cleaned += `\n\nrender(<${componentName} />);`;
    }

    return cleaned.trim();
  };

  const displayCode = cleanCode(code);
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showEditor, setShowEditor] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isHealing, setIsHealing] = useState(false);
  const [stagedCount, setStagedCount] = useState(getStagedActions().length);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState({ 
    owner: getSavedRepoInfo().owner || "", 
    repo: getSavedRepoInfo().repo || "", 
    path: "src/App.tsx", 
    message: "Updated via Khittara AI ✨" 
  });
  const [isExportingDirect, setIsExportingDirect] = useState(false);
  
  const mode = getAiMode();
  const apiKey = getApiKey();
  const githubToken = getGithubToken();

  useEffect(() => {
    setPreviewError(currentError);
  }, [currentError]);

  useEffect(() => {
    const handleStagedUpdate = (e: any) => {
      if (e.detail?.actions) setStagedCount(e.detail.actions.length);
    };
    window.addEventListener('staged-actions-update', handleStagedUpdate);
    return () => window.removeEventListener('staged-actions-update', handleStagedUpdate);
  }, []);

  const handleTriggerExport = () => {
    window.dispatchEvent(new CustomEvent('trigger-github-export'));
  };

  const handleExportDirect = async () => {
    if (!githubToken) {
      alert("Settings ထဲမှာ GitHub Token အရင်ထည့်ပေးပါရှင်။ ✨🔐");
      return;
    }
    if (!exportData.owner || !exportData.repo || !exportData.path) {
      alert("အချက်အလက်တွေ အကုန်ဖြည့်ပေးပါဦးနော် အစ်ကို ✨💖");
      return;
    }

    setIsExportingDirect(true);
    try {
      await createFile(exportData.owner, exportData.repo, exportData.path, code, exportData.message);
      alert("GitHub ကို အောင်မြင်စွာ တင်ပို့ပြီးပါပြီရှင် ✨🚀");
      setShowExportModal(false);
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(`Export လုပ်လို့ မရဖြစ်သွားပါတယ်ရှင် - ${err.message}`);
    } finally {
      setIsExportingDirect(false);
    }
  };

  const handleStageCurrent = () => {
    const newAction = {
      action: "create_file",
      owner: exportData.owner,
      repo: exportData.repo,
      path: exportData.path,
      content: code,
      message: exportData.message
    };
    const current = getStagedActions();
    setStagedActionsStore([...current, newAction]);
    setShowExportModal(false);
  };

  const handleAutoFix = async () => {
    if (!currentError || !apiKey) return;
    
    setIsHealing(true);
    try {
      const fixedCode = await fixCode(apiKey, code, currentError);
      if (fixedCode) {
        setCode(fixedCode);
        setPlaygroundCode(fixedCode);
        setCurrentError(null);
      }
    } catch (err) {
      console.error("Auto-fix failed:", err);
    } finally {
      setIsHealing(false);
    }
  };

  useEffect(() => {
    const savedCode = getPlaygroundCode();
    if (savedCode) setCode(savedCode);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "khittara_playground_code") {
        setCode(e.newValue || INITIAL_CODE);
      }
    };

    const handleCustomChange = (e: any) => {
      if (e.detail?.code) setCode(e.detail.code);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('playground-update', handleCustomChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('playground-update', handleCustomChange);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#080808] text-white">
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md",
        isSplit && "px-4 py-3"
      )}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <div className={cn(isSplit && "hidden md:block")}>
            <h2 className="text-sm font-bold text-white tracking-tight uppercase">Live Preview</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Active Sync</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className={cn("flex p-1 bg-white/5 rounded-xl border border-white/5", isSplit && "hidden lg:flex")}>
            <button onClick={() => setViewMode("mobile")} className={cn("p-2 rounded-lg transition-all", viewMode === "mobile" ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")}>
              <Smartphone size={14} />
            </button>
            <button onClick={() => setViewMode("tablet")} className={cn("p-2 rounded-lg transition-all", viewMode === "tablet" ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")}>
              <Tablet size={14} />
            </button>
            <button onClick={() => setViewMode("desktop")} className={cn("p-2 rounded-lg transition-all", viewMode === "desktop" ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")}>
              <Monitor size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowExportModal(true)}
              className={cn(
                "flex items-center gap-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg group",
                mode === "arindama" ? "bg-orange-500 shadow-orange-500/20" : "bg-white/5 border border-white/10",
                isSplit ? "px-3 py-2" : "px-6 py-2"
              )}
            >
              <Github size={12} className="group-hover:scale-110 transition-transform" />
              <span className={cn(isSplit && "hidden md:inline")}>Export to GitHub</span>
            </button>

            {stagedCount > 0 && (
              <button 
                onClick={handleTriggerExport}
                className={cn(
                  "flex items-center gap-2 bg-emerald-500 rounded-xl text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 group",
                  isSplit ? "px-3 py-2" : "px-6 py-2"
                )}
              >
                <Github size={12} className="group-hover:scale-110 transition-transform" />
                <span className={cn(isSplit && "hidden md:inline")}>{isSplit ? `Export (${stagedCount})` : `Export to GitHub (${stagedCount})`}</span>
              </button>
            )}

            <button 
              onClick={() => setShowEditor(!showEditor)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest", 
                showEditor ? "bg-primary text-slate-950" : "bg-white/5 border border-white/10 text-white/60",
                isSplit && "px-3"
              )}
            >
              <Code2 size={12} />
              <span className={cn(isSplit && "hidden md:inline")}>{showEditor ? "Hide Console" : "Inspect"}</span>
            </button>

            {isSplit && onClose && (
              <button 
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-rose-500 transition-all hover:bg-rose-500/10"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <LiveProvider code={displayCode} scope={scope} noInline={true} theme={theme as any}>
        <div className="flex-1 flex overflow-hidden">
          {showEditor && (
            <div className="w-96 border-r border-white/5 bg-[#0c0c0c] flex flex-col">
              <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                <Terminal size={12} className="text-white/20" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Code Engine</span>
              </div>
              <LiveEditor 
                className="live-editor-textarea flex-1 p-4 font-mono text-[12px] overflow-auto no-scrollbar"
                onChange={(newCode) => {
                  setCode(newCode);
                  setPlaygroundCode(newCode);
                  setCurrentError(null);
                }}
              />
            </div>
          )}

          <div className="flex-1 bg-[#05070a] relative flex items-center justify-center p-8 overflow-auto no-scrollbar">
            {/* Mesh Background */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
              style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
            />

            <div className={cn(
              "transition-all duration-500 ease-in-out relative group",
              viewMode === "mobile" ? "w-[375px] h-[667px]" : 
              viewMode === "tablet" ? "w-[768px] h-[1024px]" : 
              "w-full h-full"
            )}>
              {viewMode !== "desktop" && (
                <div className="absolute -inset-4 border-[8px] border-[#1a1a1a] rounded-[42px] pointer-events-none shadow-2xl ring-1 ring-white/5" />
              )}
              <div className="w-full h-full bg-black rounded-[32px] overflow-hidden shadow-2xl border border-white/5">
                <ReactLivePreview className="w-full h-full" />
              </div>
              
              <div className="absolute bottom-6 right-6 max-w-sm z-50 flex flex-col gap-2 scale-90 origin-bottom-right">
                <ErrorCapturer onError={setCurrentError} />
                {currentError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="text-[10px] text-rose-400 bg-rose-950/90 px-4 py-3 rounded-2xl border border-rose-500/20 backdrop-blur-xl flex items-start gap-3 shadow-2xl">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold mb-1 uppercase tracking-wider">Preview Error</p>
                        <p className="opacity-70 leading-tight font-mono text-[9px] line-clamp-3">{currentError}</p>
                      </div>
                    </div>
                    
                    {apiKey && (
                      <button 
                        onClick={handleAutoFix}
                        disabled={isHealing}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        {isHealing ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Wand2 size={12} />
                        )}
                        <span>{isHealing ? "Healing..." : "✨ Auto-Fix Code"}</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </LiveProvider>

      {/* GitHub Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#0c0c0c] border border-white/10 rounded-[32px] p-8 relative z-10 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                  <Github className="text-orange-500 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Export to GitHub</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest mt-1">Save current preview to repository</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Owner</label>
                    <input 
                      type="text" 
                      value={exportData.owner}
                      onChange={e => setExportData(prev => ({ ...prev, owner: e.target.value }))}
                      placeholder="username"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Repo</label>
                    <input 
                      type="text" 
                      value={exportData.repo}
                      onChange={e => setExportData(prev => ({ ...prev, repo: e.target.value }))}
                      placeholder="repo-name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">File Path</label>
                  <input 
                    type="text" 
                    value={exportData.path}
                    onChange={e => setExportData(prev => ({ ...prev, path: e.target.value }))}
                    placeholder="src/components/MyComponent.tsx"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Commit Message</label>
                  <textarea 
                    value={exportData.message}
                    onChange={e => setExportData(prev => ({ ...prev, message: e.target.value }))}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button 
                    onClick={handleStageCurrent}
                    className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Stage for Batch
                  </button>
                  <button 
                    onClick={handleExportDirect}
                    disabled={isExportingDirect}
                    className="py-4 bg-orange-500 hover:brightness-110 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isExportingDirect ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    <span>{isExportingDirect ? "Pushing..." : "Push Now"}</span>
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setShowExportModal(false)}
                className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .live-editor-textarea textarea { outline: none !important; caret-color: #7c3aed; }
        .live-editor-textarea pre { padding: 0 !important; }
      `}</style>
    </div>
  );
}

// Utility component to capture errors from context if needed
function ErrorCapturer({ onError }: { onError: (error: string | null) => void }) {
  const { error } = useContext(LiveContext);
  useEffect(() => {
    if (error) {
      onError(error);
    } else {
      onError(null);
    }
  }, [error, onError]);
  return null;
}
