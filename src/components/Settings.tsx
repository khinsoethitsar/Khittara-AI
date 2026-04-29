import React, { useState, useEffect } from 'react';
import { Key, Save, CheckCircle, X, Palette, Image as ImageIcon, Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getApiKey, setApiKey as saveToStore, getOpenRouterApiKey, setOpenRouterApiKey, getBackgroundImage, setBackgroundImage } from '../lib/store';
import { cn } from '../lib/utils';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'appearance'>('general');
  const [bgPrompt, setBgPrompt] = useState('');
  const [currentBg, setCurrentBg] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setApiKey(getApiKey());
    setOpenRouterKey(getOpenRouterApiKey());
    setCurrentBg(getBackgroundImage());
  }, [isOpen]);

  const handleSave = () => {
    saveToStore(apiKey);
    setOpenRouterApiKey(openRouterKey);
    onSave(apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearBg = () => {
    setBackgroundImage(null);
    setCurrentBg(null);
  };

  const handleGenerateBg = () => {
    if (!bgPrompt.trim()) return;
    setIsGenerating(true);
    // In a real app, this would trigger an agent action or API call
    // For now, we guide the user to ask the assistant
    alert("အစ်ကို MinThitSarAung ရှင်... ကလောင်က Background ကို generate လုပ်ပေးဖို့ အဆင်သင့်ရှိပါတယ်ရှင်။ Chat ထဲမှာ 'generate background: " + bgPrompt + "' လို့ ပြောပေးပါဦးနော်။ ✨💖");
    setIsGenerating(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg overflow-hidden bg-white shadow-2xl rounded-3xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex border-b border-zinc-100 dark:border-zinc-800">
              <button 
                onClick={() => setActiveTab('general')}
                className={cn(
                  "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all",
                  activeTab === 'general' ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/30 dark:bg-blue-900/10" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                )}
              >
                <Key size={16} />
                General
              </button>
              <button 
                onClick={() => setActiveTab('appearance')}
                className={cn(
                  "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all",
                  activeTab === 'appearance' ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/30 dark:bg-purple-900/10" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                )}
              >
                <Palette size={16} />
                Appearance
              </button>
            </div>

            <div className="relative p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <button 
                onClick={onClose}
                className="absolute p-2 transition-colors rounded-full top-4 right-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 z-10"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              {activeTab === 'general' ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                      <Key size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold dark:text-white">API Configuration</h3>
                      <p className="text-sm text-zinc-500">Manage your credentials</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Google Gemini API Key
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter your API Key here..."
                          className="w-full px-4 py-3 pl-11 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        />
                        <Key className="absolute w-5 h-5 -translate-y-1/2 left-4 top-1/2 text-zinc-400" />
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google AI Studio</a>.
                      </p>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        OpenRouter API Key
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          value={openRouterKey}
                          onChange={(e) => setOpenRouterKey(e.target.value)}
                          placeholder="Enter your OpenRouter API Key here..."
                          className="w-full px-4 py-3 pl-11 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        />
                        <Key className="absolute w-5 h-5 -translate-y-1/2 left-4 top-1/2 text-zinc-400" />
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Get your key from <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-blue-500 underline">OpenRouter</a>.
                      </p>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSave}
                      className={cn(
                        "w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg",
                        isSaved ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                      )}
                    >
                      {isSaved ? <><CheckCircle size={18} /> Saved!</> : <><Save size={18} /> Save Settings</>}
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl text-purple-600 dark:text-purple-400">
                      <ImageIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold dark:text-white">Wallpapers & Backgrounds</h3>
                      <p className="text-sm text-zinc-500">Design your digital space</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-3xl">
                      <label className="block mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        <Sparkles size={14} className="text-purple-500" />
                        AI Background Generator
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={bgPrompt}
                          onChange={(e) => setBgPrompt(e.target.value)}
                          placeholder="Describe your perfect background..."
                          className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white"
                        />
                        <button 
                          onClick={handleGenerateBg}
                          className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all shadow-sm"
                          title="Generate Background"
                        >
                          <Sparkles size={18} />
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-zinc-400">Example: "aesthetic dark tech workspace with neon lights"</p>
                    </div>

                    <div className="relative group overflow-hidden rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 aspect-video flex flex-col items-center justify-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/20">
                      {currentBg ? (
                        <>
                          <img src={currentBg} alt="Current Background" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button 
                              onClick={handleClearBg}
                              className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg"
                              title="Remove Background"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={32} className="text-zinc-300 dark:text-zinc-700" />
                          <span className="text-xs text-zinc-400">No custom background set</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Settings;
