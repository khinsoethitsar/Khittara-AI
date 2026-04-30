import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Brain,
  Folder,
  FileText,
  MoreVertical,
  Wand2,
  LogOut,
  Settings,
  CheckCircle2,
  Layout,
  Activity
} from "lucide-react";
import { type ChatSession, type Task } from "../lib/store";
import { cn } from "../lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { logout } from "../lib/firebase";
import TasksList from "./TasksList";

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onNewProject: () => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  isOpen: boolean;
  onToggle: () => void;
  activeTab: "chats" | "files" | "tasks" | "preview";
  onTabChange: (tab: "chats" | "files" | "tasks" | "preview") => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  userProfile: any;
  mode: string;
  onModeChange?: (mode: any) => void;
  uiDensity?: number;
  tasks: Task[];
  onAddTask: (title: string, dueDate?: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export default function Sidebar({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat, 
  onNewProject,
  onDeleteSession,
  onClearHistory,
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  onOpenProfile,
  onOpenSettings,
  userProfile,
  mode,
  onModeChange,
  uiDensity = 16,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showModeSwitcher, setShowModeSwitcher] = useState(false);

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const modes = [
    { id: "kalaung", name: "Ka-Laung", icon: <Sparkles className="w-3.5 h-3.5" />, color: "#EC4899" },
    { id: "arindama", name: "Arindama", icon: <Brain className="w-3.5 h-3.5" />, color: "#D4AF37" },
    { id: "twatgyi", name: "Sayar Ma Twat Gyi", icon: <Activity className="w-3.5 h-3.5" />, color: "#10B981" }
  ];

  // Mock files for now
  const mockFiles = [
    { id: "1", name: "README.md", type: "file" },
    { id: "2", name: "src", type: "folder" },
    { id: "3", name: "package.json", type: "file" },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          width: isOpen ? 280 : 0,
          x: isOpen ? 0 : -280
        }}
        className={cn(
          "fixed lg:relative z-50 h-full bg-[#0c0c0c] border-r border-white/5 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
          !isOpen && "lg:w-0 border-none"
        )}
      >
        {/* Sidebar Header */}
        <div 
          className="space-y-4"
          style={{ padding: `${uiDensity}px` }}
        >
          <div className="relative">
            <div 
              className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-all group"
              onClick={() => setShowModeSwitcher(!showModeSwitcher)}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${modes.find(m => m.id === mode)?.color}20`, color: modes.find(m => m.id === mode)?.color }}
                >
                  {modes.find(m => m.id === mode)?.icon}
                </div>
                <span className="text-xs font-bold text-white/90">
                  {modes.find(m => m.id === mode)?.name}
                </span>
              </div>
              <ChevronRight className={cn("w-3.5 h-3.5 text-white/20 group-hover:text-white transition-all", showModeSwitcher && "rotate-90")} />
            </div>

            <AnimatePresence>
              {showModeSwitcher && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-[#161616] border border-white/10 shadow-2xl z-20 space-y-1"
                >
                  {modes.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onModeChange?.(m.id);
                        setShowModeSwitcher(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                        mode === m.id ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white/60"
                      )}
                    >
                      <div style={{ color: m.color }}>{m.icon}</div>
                      <span className="text-[11px] font-bold">{m.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={onNewProject}
              className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all group"
              title="Reset everything and start fresh"
            >
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
              <span>PROJECT</span>
            </button>
            <button 
              onClick={onNewChat}
              className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-bold text-white/90 hover:bg-white/10 transition-all group"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
              <span>CHAT</span>
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            <button 
              onClick={() => onTabChange("chats")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                activeTab === "chats" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50"
              )}
              title="Chat History"
            >
              <MessageSquare size={14} />
            </button>
            {mode === "arindama" && (
              <button 
                onClick={() => onTabChange("files")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                  activeTab === "files" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50"
                )}
                title="Files"
              >
                <Folder size={14} />
              </button>
            )}
            <button 
              onClick={() => onTabChange("tasks")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                activeTab === "tasks" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50"
              )}
              title="Tasks & Due Dates"
            >
              <CheckCircle2 size={14} />
            </button>
            <button 
              onClick={() => onTabChange("preview")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all",
                activeTab === "preview" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50"
              )}
              title="Live Preview"
            >
              <Layout size={14} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input 
              type="text" 
              placeholder={activeTab === "chats" ? "Search history..." : activeTab === "files" ? "Search files..." : "Search tasks..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white/60 focus:outline-none focus:border-primary/30 transition-all"
            />
          </div>
        </div>

        {/* Content List */}
        <div 
          className="flex-1 overflow-y-auto space-y-1 no-scrollbar"
          style={{ padding: `${uiDensity * 0.5}px` }}
        >
          {activeTab === "chats" && (
            <>
              <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>Recent Chats</span>
                </div>
                {sessions.length > 0 && (
                  <button 
                    onClick={onClearHistory}
                    className="hover:text-rose-500 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
              
              {filteredSessions.length === 0 ? (
                <div className="px-4 py-8 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-white/5 mx-auto" />
                  <div className="text-[11px] text-white/20">No history yet</div>
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <div 
                    key={session.id}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 rounded-xl cursor-pointer transition-all overflow-hidden",
                      currentSessionId === session.id 
                        ? "text-primary" 
                        : "text-white/40 hover:bg-white/5 hover:text-white/60"
                    )}
                    style={{ paddingTop: `${uiDensity * 0.6}px`, paddingBottom: `${uiDensity * 0.6}px` }}
                    onClick={() => onSelectSession(session.id)}
                  >
                    {currentSessionId === session.id && (
                      <motion.div 
                        layoutId="active-session"
                        className="absolute inset-0 bg-primary/10 border-l-2 border-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <MessageSquare className={cn(
                      "w-4 h-4 shrink-0 relative z-10",
                      currentSessionId === session.id ? "text-primary" : "text-white/20"
                    )} />
                    <span className="flex-1 text-xs font-medium truncate pr-6 relative z-10">
                      {session.title || "Untitled Chat"}
                    </span>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-rose-500 transition-all z-20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === "files" && (
            <>
              <div className="px-3 mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/20">
                <Folder className="w-3 h-3" />
                <span>Project Files</span>
              </div>
              
              {mockFiles.map((file) => (
                <div 
                  key={file.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-white/40 hover:bg-white/5 hover:text-white/60 transition-all"
                >
                  {file.type === "folder" ? (
                    <Folder className="w-4 h-4 text-primary/40 group-hover:text-primary transition-colors" />
                  ) : (
                    <FileText className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
                  )}
                  <span className="flex-1 text-xs font-medium truncate">{file.name}</span>
                  <MoreVertical className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              
              <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 mx-2">
                <div className="text-[10px] text-primary/60 leading-relaxed">
                  Arindama Mode မှာ GitHub Repo တွေ ဆောက်လိုက်ရင် ဒီနေရာမှာ File တွေကို စီမံခန့်ခွဲနိုင်မှာ ဖြစ်ပါတယ်ရှင်။
                </div>
              </div>
            </>
          )}

          {activeTab === "tasks" && (
            <div className="px-3 py-2 h-full flex flex-col">
              <TasksList 
                tasks={filteredTasks} 
                onAddTask={onAddTask}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
                uiDensity={uiDensity}
              />
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div 
          className="border-t border-white/5 space-y-2"
          style={{ padding: `${uiDensity}px` }}
        >
          <button 
            onClick={onOpenProfile}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/60 hover:bg-white/5 transition-all"
          >
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
              mode === "kalaung" ? "bg-neon-violet/10" : mode === "twatgyi" ? "bg-emerald-500/10" : "bg-primary/10"
            )}>
              {mode === "kalaung" ? (
                <Sparkles className="w-4 h-4 text-neon-violet" />
              ) : mode === "twatgyi" ? (
                <Activity className="w-4 h-4 text-emerald-500" />
              ) : (
                <Brain className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-bold text-white/80 truncate">
                {userProfile?.displayName || "အစ်ကို MinThitSarAung"}
              </div>
              <div className="text-[10px] text-white/20 truncate">
                {modes.find(m => m.id === mode)?.name} Active
              </div>
            </div>
          </button>

          <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition-all text-xs font-medium"
          >
            <Settings size={14} className="text-primary/60" />
            <span>Settings</span>
          </button>
          
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/30 hover:bg-rose-500/10 hover:text-rose-500 transition-all text-xs font-medium"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Toggle Button (Floating when closed) */}
      {!isOpen && (
        <button 
          onClick={onToggle}
          className="fixed left-4 top-4 z-50 p-2.5 bg-[#161616] border border-white/10 rounded-xl text-white/40 hover:text-white transition-all shadow-xl lg:hidden"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
