// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Send, 
  Link2, 
  X, 
  Globe, 
  User, 
  Bot, 
  Loader2, 
  Github, 
  Sparkles,
  AlertCircle,
  Wrench,
  Search,
  Flag,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  ChevronRight,
  Settings,
  Copy,
  Check,
  Brain,
  Lightbulb,
  Video,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Folder,
  FileText,
  Code,
  FileCode,
  FileJson,
  Hash,
  Terminal,
  Wand2,
  Scissors,
  CloudOff,
  Cloud,
  Database,
  Volume2,
  Layout,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  sendMessageAdvanced, 
  summarizeConversation,
  type ThinkingStep, 
  type AiMode,
  type ChatMessage
} from "../lib/gemini";
import { 
  getApiKey, 
  getAiMode, 
  setAiMode, 
  getOpenRouterApiKey,
  getModel,
  setModel,
  getSavedRepoInfo,
  saveRepoInfo,
  addToKnowledgeBase,
  setPlaygroundCode,
  setBackgroundImage,
  getStagedActions,
  setStagedActionsStore,
  getPreviewError
} from "../lib/store";
import { cn, isValidRepoName, isValidUpload } from "../lib/utils";
import { createGist, createRepo, createFile, createProject, deleteFile, listFiles, githubFetch, GithubApiError } from "../lib/github";
import { formatDiagnosticMarkdown } from "../lib/github-diagnostics";
import { generateHealingPlan } from "../lib/self-healing";
import { learnFactAboutCreator, getCreatorMemories, CreatorMemory } from "../lib/creator-knowledge";
import ThinkingProcess from "./ThinkingProcess";
import ReactMarkdown from "react-markdown";
import { CHARACTERS } from "../lib/characters";
import ActivityFeed, { ActivityLog } from "./ActivityFeed";
import SuggestedNextSteps, { NextStep } from "./SuggestedNextSteps";
import TwoDLiveDashboard from "./TwoDLiveDashboard";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onSwitchTab: (tab: "chats" | "files") => void;
  mode: AiMode;
  onModeChange: (mode: AiMode) => void;
  userProfile: any;
  quotaExceeded?: boolean;
  uiDensity?: number;
  clonedVoiceEnabled?: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  groqApiKey?: string;
  onUpdateStats?: (stats: any) => void;
  onOpenProfile?: () => void;
  deepMemory?: any;
}

// Simple Button component since shadcn is not initialized
const Button = ({ children, onClick, disabled, variant = "primary", size = "md", className = "" }: any) => {
  const variants: any = {
    primary: "bg-cyan-600 text-white hover:bg-cyan-700",
    ghost: "bg-transparent hover:bg-muted text-muted-foreground",
    outline: "border border-border hover:bg-muted",
  };
  const sizes: any = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2",
    icon: "p-2",
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`rounded-lg transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export default function ChatInterface({ 
  messages, 
  onMessagesChange, 
  onOpenSettings,
  onToggleSidebar,
  isSidebarOpen,
  onSwitchTab,
  mode,
  onModeChange,
  userProfile,
  quotaExceeded,
  uiDensity = 16,
  selectedModel,
  onModelChange,
  groqApiKey,
  onUpdateStats,
  onOpenProfile,
  deepMemory
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [contextUrl, setContextUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Auto-reset internal states when messages are cleared (New Project)
  useEffect(() => {
    if (messages.length === 0) {
      setThinkingSteps([]);
      setActivityLogs([]);
      setPlaygroundCode("");
      setStagedFiles([]);
      setStagedActions([]);
      setNextSteps([]);
    }
  }, [messages.length]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [executionTime, setExecutionTime] = useState<number>(0);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    const fetchMemories = async () => {
      const memories = await getCreatorMemories();
      setCreatorMemories(memories);
    };
    fetchMemories();
  }, []);

  const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; data: string; preview?: string; trimStart?: string; trimEnd?: string }[]>([]);
  const [showFilePreview, setShowFilePreview] = useState<number | null>(null); // Index of file to preview
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = { toast: (opts: any) => console.log(opts) }; // Mock toast for now

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<{ path: string; content: string; lang: string }[]>([]);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [repoInfo, setRepoInfo] = useState(getSavedRepoInfo());
  const [isCommitting, setIsCommitting] = useState(false);

  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [newRepoData, setNewRepoData] = useState({ name: "", description: "", private: true });
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState("");
  const [isCreatorVerified, setIsCreatorVerified] = useState(false);
  const [creatorMemories, setCreatorMemories] = useState<CreatorMemory[]>([]);
  const [previewError, setPreviewErrorState] = useState<string | null>(getPreviewError());

  // Listen for preview errors
  useEffect(() => {
    const handlePreviewError = (e: any) => {
      setPreviewErrorState(e.detail?.error);
    };
    window.addEventListener('preview-error-update', handlePreviewError);
    return () => window.removeEventListener('preview-error-update', handlePreviewError);
  }, []);

  const handleStageFile = (content: string, lang: string) => {
    const extension = lang === 'text' ? 'txt' : lang === 'typescript' ? 'ts' : lang === 'javascript' ? 'js' : lang;
    const path = `file-${Date.now()}.${extension}`;
    setStagedFiles(prev => [...prev, { path, content, lang }]);
  };

  const handleCreateRepo = async () => {
    if (!newRepoData.name) {
      alert("Please enter a repository name.");
      return;
    }

    if (!isValidRepoName(newRepoData.name)) {
      alert("Repository name မမှန်ကန်ပါဘူးရှင်။ စာလုံး၊ နံပါတ်၊ (-) နဲ့ (_) သာ အသုံးပြုနိုင်ပါတယ်ရှင်။ ✨📁");
      return;
    }

    setIsCreatingRepo(true);
    const logId = addActivityLog(`Creating repository "${newRepoData.name}"...`, "loading");
    
    try {
      const repo = await createRepo(newRepoData.name, newRepoData.description, newRepoData.private);
      updateActivityLog(logId, "success", `Repository "${newRepoData.name}" created successfully.`);
      
      // Update repoInfo and save to store
      const newInfo = { owner: repo.owner.login, repo: repo.name };
      setRepoInfo(newInfo);
      saveRepoInfo(newInfo);
      
      setShowCreateRepoModal(false);
      setNewRepoData({ name: "", description: "", private: true });
      
      // Add a message to the chat
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "model",
        content: `✅ **Repository Created Successfully!**\n\nI've created the repository **${repo.full_name}** for you.\n\n[View on GitHub](${repo.html_url})\n\nI've also updated your session to use this repository for future commits. ✨`,
        timestamp: new Date().toLocaleTimeString()
      };
      onMessagesChange([...messages, systemMessage]);
    } catch (e: any) {
      updateActivityLog(logId, "error", `Failed to create repository: ${e.message}`);
      alert(`Error: ${e.message}`);
    } finally {
      setIsCreatingRepo(false);
    }
  };

  const handleSummarize = async () => {
    if (messages.length === 0) {
      alert("အကျဉ်းချုပ်စရာ Chat မရှိသေးပါဘူးရှင်။");
      return;
    }
    
    setIsSummarizing(true);
    const logId = addActivityLog("Generating conversation summary...", "loading");
    
    try {
      const result = await summarizeConversation(getApiKey() || "", messages);
      setSummary(result);
      setShowSummaryModal(true);
      updateActivityLog(logId, "success", "Summary generated successfully.");
    } catch (error: any) {
      updateActivityLog(logId, "error", `Summarization failed: ${error.message}`);
      alert(error.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleStageAllFiles = async () => {
    if (!repoInfo.owner || !repoInfo.repo) {
      alert("Please ensure Repository Owner and Name are set in the Commit Modal first.");
      setShowCommitModal(true);
      return;
    }

    const logId = addActivityLog(`Fetching all files from ${repoInfo.owner}/${repoInfo.repo}...`, "loading");
    try {
      const files = await listFiles(repoInfo.owner, repoInfo.repo);
      const newStagedFiles: { path: string; content: string; lang: string }[] = [];
      
      for (const file of files) {
        if (file.type === 'file') {
          // Fetch content for each file
          const res = await githubFetch(`/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${file.path}`);
          const content = decodeURIComponent(escape(atob(res.content)));
          const ext = file.name.split('.').pop() || 'text';
          newStagedFiles.push({ path: file.path, content, lang: ext });
        }
      }
      
      setStagedFiles(newStagedFiles);
      updateActivityLog(logId, "success", `Staged ${newStagedFiles.length} files from repository.`);
    } catch (error: any) {
      updateActivityLog(logId, "error", `Failed to stage files: ${error.message}`);
    }
  };

  const handleCommit = async () => {
    if (!repoInfo.owner || !repoInfo.repo || !commitMessage) {
      alert("Please fill in all fields");
      return;
    }

    setIsCommitting(true);
    const logId = addActivityLog(`Committing ${stagedFiles.length} files to ${repoInfo.owner}/${repoInfo.repo}...`, "loading");
    
    try {
      for (const file of stagedFiles) {
        await createFile(repoInfo.owner, repoInfo.repo, file.path, file.content, commitMessage);
      }
      updateActivityLog(logId, "success", `Successfully committed ${stagedFiles.length} files.`);
      setStagedFiles([]);
      setShowCommitModal(false);
      setCommitMessage("");
    } catch (error: any) {
      updateActivityLog(logId, "error", `Commit failed: ${error.message}`);
      alert(`Commit failed: ${error.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFileIcon = (fileName: string, type?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <ImageIcon className="w-5 h-5" />;
    }

    if (type?.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext || '')) {
      return <Video className="w-5 h-5 text-primary" />;
    }
    
    if (['json'].includes(ext || '')) {
      return <FileJson className="w-5 h-5 text-yellow-500" />;
    }
    
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
      return <FileCode className="w-5 h-5 text-blue-400" />;
    }
    
    if (['py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php'].includes(ext || '')) {
      return <Code className="w-5 h-5 text-emerald-400" />;
    }

    if (['css', 'scss', 'less'].includes(ext || '')) {
      return <Hash className="w-5 h-5 text-pink-400" />;
    }

    if (['html'].includes(ext || '')) {
      return <Globe className="w-5 h-5 text-orange-400" />;
    }

    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) {
      return <Video className="w-5 h-5 text-purple-400" />;
    }
    
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
      return <Volume2 className="w-5 h-5 text-emerald-400" />;
    }

    if (['sh', 'bash', 'zsh', 'bat'].includes(ext || '')) {
      return <Terminal className="w-5 h-5 text-gray-400" />;
    }
    
    if (['md', 'txt', 'pdf', 'doc', 'docx'].includes(ext || '')) {
      return <FileText className="w-5 h-5 text-white/60" />;
    }
    
    return <FileText className="w-5 h-5 text-white/40" />;
  };

  const isVideo = (file: { name: string, type: string }) => {
    if (file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp', 'ts', 'm3u8'].includes(ext || '');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const unsupportedFiles: string[] = [];
      Array.from(files).forEach(file => {
        // Advanced validation using helper
        const validation = isValidUpload(file);
        if (!validation.valid) {
          unsupportedFiles.push(`${file.name} (${validation.error})`);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
            const textReader = new FileReader();
            textReader.onload = () => {
              setSelectedFiles(prev => [...prev, {
                name: file.name,
                type: file.type,
                data: reader.result as string,
                preview: textReader.result as string
              }]);
            };
            textReader.readAsText(file);
          } else if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type === 'application/pdf') {
            setSelectedFiles(prev => [...prev, {
              name: file.name,
              type: file.type,
              data: reader.result as string,
              preview: reader.result as string
            }]);
          } else {
            setSelectedFiles(prev => [...prev, {
              name: file.name,
              type: file.type,
              data: reader.result as string,
              preview: null
            }]);
          }
        };
        reader.readAsDataURL(file);
      });

      if (unsupportedFiles.length > 0) {
        alert(`အောက်ပါ ဖိုင်အမျိုးအစားများကို Gemini က လက်မခံပါဘူးရှင်- \n${unsupportedFiles.join(', ')}`);
      }
    }
  };

  const handleExplainCode = (code: string, lang: string) => {
    const prompt = `ဒီ code block လေးကို မြန်မာလို အသေးစိတ် ရှင်းပြပေးပါဦးရှင်။ ✨\n\n\`\`\`${lang}\n${code}\n\`\`\``;
    handleSend(prompt);
  };

  const MarkdownComponents = {
    p({ children }: any) {
      return <div className="mb-4 last:mb-0">{children}</div>;
    },
    strong({ children }: any) {
      return <span className="font-bold text-white">{children}</span>;
    },
    a({ href, children }: any) {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary hover:underline underline-offset-4"
        >
          {children}
        </a>
      );
    },
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : 'text';
      const codeContent = String(children).replace(/\n$/, '');
      const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

      if (!inline) {
        return (
          <div className="my-6 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02] group">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {lang === 'text' ? 'Plaintext' : lang}
              </span>
              {mode === "arindama" && (
                <button
                  onClick={() => handleStageFile(codeContent, lang)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-2"
                  title="Stage File"
                >
                  <Plus size={14} />
                  <span className="text-[10px] font-bold uppercase">Stage</span>
                </button>
              )}
              <button
                onClick={() => handleExplainCode(codeContent, lang)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-2"
                title="Explain Code"
              >
                <Brain size={14} />
                <span className="text-[10px] font-bold uppercase">Explain</span>
              </button>
              <button
                onClick={() => handleCopy(codeContent, codeId)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all flex items-center gap-2"
                title="Copy Code"
              >
                {copiedId === codeId ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-500">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span className="text-[10px] font-bold">COPY</span>
                  </>
                )}
              </button>
            </div>
            <div className="relative group/code">
              <pre className={cn("overflow-x-auto p-5 font-mono text-sm leading-relaxed", className)} {...props}>
                <code>{children}</code>
              </pre>
              <button
                onClick={() => handleCopy(codeContent, codeId)}
                className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-white/40 hover:text-white opacity-0 group-hover/code:opacity-100 transition-all duration-200 flex items-center gap-2 shadow-xl"
                title="Copy Code"
              >
                {copiedId === codeId ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-500">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span className="text-[10px] font-bold">COPY</span>
                  </>
                )}
              </button>
              {(match?.[1] === 'jsx' || match?.[1] === 'tsx' || match?.[1] === 'html' || match?.[1] === 'javascript' || match?.[1] === 'typescript' || match?.[1] === 'css') && (
                <button
                  onClick={() => {
                    setPlaygroundCode(codeContent);
                    onSwitchTab('preview');
                  }}
                  className={cn(
                    "absolute top-3 right-20 p-2 backdrop-blur-md border rounded-xl opacity-0 group-hover/code:opacity-100 transition-all duration-200 flex items-center gap-2 shadow-xl",
                    mode === "arindama" 
                      ? "bg-primary/20 border-primary/40 text-primary scale-110" 
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                  )}
                  title="Open in Live Preview"
                >
                  <Layout size={14} className={mode === "arindama" ? "animate-pulse" : ""} />
                  <span className="text-[10px] font-bold">
                    {mode === "arindama" ? "🚀 LIVE PREVIEW" : "PLAYGROUND"}
                  </span>
                </button>
              )}
            </div>
          </div>
        );
      }
      return (
        <code className={cn("bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-[0.9em]", className)} {...props}>
          {children}
        </code>
      );
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + M to toggle mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMode();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mode]);

  useEffect(() => {
    if (showCommitModal && (!repoInfo.owner || !repoInfo.repo)) {
      // Try to auto-detect from message history (newest first)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        
        // 1. Check for github-action blocks
        const match = msg.content.match(/```(?:github-action|json)\n([\s\S]*?)\n```/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            if (data.owner && data.repo) {
              const newInfo = { owner: data.owner, repo: data.repo };
              setRepoInfo(newInfo);
              saveRepoInfo(newInfo);
              break;
            }
          } catch (e) {}
        }

        // 2. Check for mentions like "owner/repo" in text
        const repoMentionMatch = msg.content.match(/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)/);
        if (repoMentionMatch && !msg.content.includes("http")) {
          const newInfo = { owner: repoMentionMatch[1], repo: repoMentionMatch[2] };
          setRepoInfo(newInfo);
          saveRepoInfo(newInfo);
          break;
        }
      }
    }
  }, [showCommitModal, messages]);

  const handleRepoInfoChange = (field: 'owner' | 'repo', value: string) => {
    const newInfo = { ...repoInfo, [field]: value };
    setRepoInfo(newInfo);
    saveRepoInfo(newInfo);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // Check if user was near bottom before the update
      // We use a threshold of 200px to be safe
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 200;
      
      const lastMessage = messages[messages.length - 1];
      const isUserMessage = lastMessage?.role === 'user';

      // Always scroll if user just sent a message
      // Otherwise only scroll if they were already near the bottom
      if (isUserMessage || isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, thinkingSteps, activityLogs, nextSteps]);

  const addActivityLog = (message: string, status: "loading" | "success" | "error" = "loading") => {
    const id = Math.random().toString(36).substring(7);
    setActivityLogs(prev => [...prev, { id, message, status, timestamp: new Date().toISOString() }]);
    return id;
  };

  const updateActivityLog = (id: string, status: "success" | "error", message?: string) => {
    setActivityLogs(prev => prev.map(log => 
      log.id === id ? { ...log, status, message: message || log.message } : log
    ));
  };

  const generateNextSteps = (action: string, data: any): NextStep[] => {
    switch (action) {
      case "create_file":
        return [
          { 
            label: "Add Unit Tests", 
            description: "ဖိုင်အတွက် Unit Tests တွေကို အလိုအလျောက် ရေးသားပေးပါမယ်။",
            prompt: `Generate unit tests for ${data.path}.` 
          },
          { 
            label: "Refactor Code", 
            description: "Code ရဲ့ အရည်အသွေး ပိုကောင်းလာအောင် ပြန်လည် ပြင်ဆင်ပေးပါမယ်။",
            prompt: `Suggest some refactoring improvements for ${data.path}.` 
          }
        ];
      case "create_repo":
      case "create_project":
        return [
          { 
            label: "Add README", 
            description: "Project အကြောင်း ရှင်းပြထားတဲ့ README.md ဖိုင်ကို ဖန်တီးပေးပါမယ်။",
            prompt: "Generate a professional README.md for this project." 
          },
          { 
            label: "Setup CI/CD", 
            description: "GitHub Actions သုံးပြီး Automated Testing တွေ ထည့်သွင်းပေးပါမယ်။",
            prompt: "Create a GitHub Actions workflow for automated testing." 
          }
        ];
      default:
        return [];
    }
  };

  const handleRemember = (text: string) => {
    addToKnowledgeBase(text);
    addActivityLog("Fact added to Knowledge Base ✨", "success");
  };

  const handleCalculateData = () => {
    const prompt = "၂၀၂၁ ခုနှစ်ကနေ ဒီနေ့အထိ ထွက်ခဲ့တဲ့ 2D ဂဏန်းတွေကို ဒေတာဗေဒ (Data Science) အမြင်နဲ့ သေသေချာချာ စစ်ဆေးပေးပါရှင်။ Statistical Trends, Probability Distribution, နဲ့ Cyclical Variance (အစဉ်လိုက်ဖြစ်ပေါ်မှုနှုန်း) တွေကို နှိုင်းယှဉ်ပြီးတော့၊ နောက်ထွက်လာမယ့် ဂဏန်းကို အမှန်ကန်ဆုံးဖြစ်အောင် Advanced Numerical Modeling နဲ့ တွက်ချက်ပေးပါနော်။ အစ်ကို MinThitSarAung အတွက် ရှေ့ကို ၁၀၀ လှမ်းလောက် ကြိုတင်တွက်ဆပြီး အကောင်းဆုံး ခန့်မှန်းချက် (Statistical Prediction) ကို ရှုထောင့်ပေါင်းစုံကနေ ထုတ်ပြန်ပေးပါရှင်။ ✨📊✊";
    handleSend(prompt);
  };

  const [stagedActions, setStagedActions] = useState<any[]>(getStagedActions());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.actions) setStagedActions(e.detail.actions);
    };
    window.addEventListener('staged-actions-update', handleUpdate);
    return () => window.removeEventListener('staged-actions-update', handleUpdate);
  }, []);

  useEffect(() => {
    setStagedActionsStore(stagedActions);
  }, [stagedActions]);

  const handleExportToGithub = useCallback(async () => {
    if (stagedActions.length === 0) return;
    
    setIsExporting(true);
    const mainLogId = addActivityLog(`Exporting ${stagedActions.length} actions to GitHub...`, "loading");
    
    try {
      for (const actionData of stagedActions) {
        let currentLogId = "";
        if (actionData.action === "create_file") {
          currentLogId = addActivityLog(`Creating file: ${actionData.path}...`, "loading");
          await createFile(actionData.owner, actionData.repo, actionData.path, actionData.content, actionData.message);
          updateActivityLog(currentLogId, "success", `File "${actionData.path}" created.`);
        } else if (actionData.action === "create_repo") {
          currentLogId = addActivityLog(`Creating repository: ${actionData.name}...`, "loading");
          await createRepo(actionData.name, actionData.description, actionData.private);
          updateActivityLog(currentLogId, "success", `Repository "${actionData.name}" created.`);
        } else if (actionData.action === "delete_file") {
          currentLogId = addActivityLog(`Deleting file: ${actionData.path}...`, "loading");
          await deleteFile(actionData.owner, actionData.repo, actionData.path, actionData.message);
          updateActivityLog(currentLogId, "success", `File "${actionData.path}" deleted.`);
        }
      }
      updateActivityLog(mainLogId, "success", `All ${stagedActions.length} actions completed successfully! ✨`);
      setStagedActions([]);
    } catch (e: any) {
      updateActivityLog(mainLogId, "error", `Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [stagedActions]);

  useEffect(() => {
    const handleTrigger = () => {
      handleExportToGithub();
    };
    window.addEventListener('trigger-github-export', handleTrigger);
    return () => window.removeEventListener('trigger-github-export', handleTrigger);
  }, [handleExportToGithub]);

  const processCodeForPreview = (content: string) => {
    let processedCode = content.trim();

    // 1. Strip all import statements (including multiline)
    processedCode = processedCode.replace(/^\s*import\s+[\s\S]*?from\s+['"].*?['"];?/gm, '');
    processedCode = processedCode.replace(/^\s*import\s+['"].*?['"];?/gm, '');

    // 2. Identify the main component name
    let componentToRender = "";
    
    // Pattern: export default function Name(...)
    const defaultFuncMatch = processedCode.match(/export\s+default\s+function\s+([a-zA-Z0-9_$]+)/);
    if (defaultFuncMatch) {
      componentToRender = defaultFuncMatch[1];
      processedCode = processedCode.replace(/export\s+default\s+function\s+/, 'function ');
    } else {
      // Pattern: function Name(...) { ... } export default Name;
      const namedFuncMatch = processedCode.match(/function\s+([a-zA-Z0-9_$]+)\s*\(/);
      const exportNameMatch = processedCode.match(/export\s+default\s+([a-zA-Z0-9_$]+);?/);
      if (namedFuncMatch && exportNameMatch && namedFuncMatch[1] === exportNameMatch[1]) {
        componentToRender = namedFuncMatch[1];
        processedCode = processedCode.replace(/export\s+default\s+[a-zA-Z0-9_$]+;?/, '');
      } else if (exportNameMatch) {
        componentToRender = exportNameMatch[1];
        processedCode = processedCode.replace(/export\s+default\s+[a-zA-Z0-9_$]+;?/, '');
      } else {
        // Pattern: export default () => ...
        processedCode = processedCode.replace(/export\s+default\s+/, '');
      }
    }

    // 3. Strip all other 'export' keywords
    processedCode = processedCode.replace(/^\s*export\s+/gm, '');

    // 4. Clean up any trailing semicolon if it was left from export default
    processedCode = processedCode.trim().replace(/;$/, '');

    // 5. Ensure it renders in react-live (adding component tag if needed)
    if (componentToRender) {
      const renderRegex = new RegExp(`<${componentToRender}\\s*\\/?>|<${componentToRender}>[\\s\\S]*?<\\/${componentToRender}>`);
      if (!renderRegex.test(processedCode)) {
        processedCode += `\n\n<${componentToRender} />`;
      }
    }

    return processedCode.trim();
  };

  const handleNewProject = () => {
    handleResetProject();
  };

  const handleResetProject = () => {
    onMessagesChange([]);
    setThinkingSteps([]);
    setActivityLogs([]);
    setNextSteps([]);
    setStagedFiles([]);
    setStagedActions([]);
    setPlaygroundCode("");
    setInput("");
    setShowMenu(false);
    
    const character = CHARACTERS.find(c => c.id === userProfile?.character) || CHARACTERS[0];
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "model",
      content: character.greeting,
      timestamp: new Date().toLocaleTimeString()
    };
    onMessagesChange([welcomeMessage]);
    addActivityLog("Project Cleaned & Reset Successfully ✨", "success");
  };

  const handleSend = async (overrideInput?: string) => {
    const apiKey = getApiKey();
    const openRouterApiKey = getOpenRouterApiKey();
    if (!apiKey && !openRouterApiKey) {
      alert("Settings ထဲမှာ API Key အရင်ထည့်ပေးပါရှင်။");
      return;
    }

    const rawInput = overrideInput || input.trim();
    if (!rawInput) return;

    // Secret Key Detection
    const secretKey = "Min33433433@";
    let isVerifyingNow = false;
    if (rawInput.includes(secretKey)) {
      setIsCreatorVerified(true);
      isVerifyingNow = true;
    }

    // Handle Commands
    if (rawInput.startsWith("/remember ")) {
      const fact = rawInput.replace("/remember ", "").trim();
      handleRemember(fact);
      setInput("");
      return;
    }

    if (rawInput === "/clear") {
      onMessagesChange([]);
      setInput("");
      return;
    }

    const userMessage = rawInput;

    if (onUpdateStats) {
      onUpdateStats({ 
        messages: (userProfile?.stats?.messages || 0) + 1 
      });
    }

    const start = Date.now();
    setStartTime(start);
    setExecutionTime(0);

    const timer = setInterval(() => {
      setExecutionTime(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    const newMessages: ChatMessage[] = [
      ...messages,
      { 
        role: "user", 
        content: userMessage, 
        timestamp: new Date().toISOString(),
        files: selectedFiles.length > 0 ? selectedFiles.map(f => ({
          name: f.name,
          type: f.type,
          data: f.data
        })) : undefined
      }
    ];

    onMessagesChange(newMessages);
    setInput("");
    setIsLoading(true);

    const assistantMessage: ChatMessage = {
      role: "model",
      content: "",
      timestamp: new Date().toISOString()
    };

    let fullResponse = "";

    try {
      const responsePromise = sendMessageAdvanced({
        apiKey,
        groqApiKey,
        openrouterApiKey: openRouterApiKey,
        history: messages,
        message: userMessage,
        contextUrl: contextUrl || undefined,
        files: selectedFiles.map(f => ({
          name: f.name,
          type: f.type,
          data: f.data,
          trimStart: f.trimStart,
          trimEnd: f.trimEnd
        })),
        mode,
        model: selectedModel,
        characterId: userProfile?.character,
        isCreatorVerified: isVerifyingNow || isCreatorVerified,
        creatorMemories: isVerifyingNow || isCreatorVerified ? creatorMemories : [],
        deepMemory,
        onThinkingUpdate: (steps) => setThinkingSteps([...steps]),
        onStream: (text) => {
          fullResponse = text;
          onMessagesChange([...newMessages, { ...assistantMessage, content: text }]);
        }
      });

      const finalResponse = await responsePromise;
      await finalizeResponse(finalResponse);

      async function finalizeResponse(finalText: string) {
        setSelectedFiles([]);
        clearInterval(timer);
        setExecutionTime(Math.floor((Date.now() - start) / 1000));

        // Handle Memory Learning
        if (finalText.includes('```learn-creator')) {
          const match = finalText.match(/```learn-creator\s*({[\s\S]*?})\s*```/);
          if (match && match[1]) {
            try {
              const memoryData = JSON.parse(match[1]);
              const learned = await learnFactAboutCreator(memoryData.fact, memoryData.category, memoryData.importance);
              if (learned) {
                setCreatorMemories(prev => [...prev, learned]);
              }
            } catch (e) {
              console.error("Failed to parse creator memory", e);
            }
          }
        }

        const githubActionMatches = Array.from(finalText.matchAll(/```(?:github-action|json)\n([\s\S]*?)\n```/g));
        let stagedCount = 0;
        let actionPaths: string[] = [];
        
        for (const match of githubActionMatches) {
          if (mode === "arindama") {
            try {
              const actionData = JSON.parse(match[1]);
              if (actionData.action) {
                // If it's a file creation involving UI, sync to preview immediately
                if (actionData.action === "create_file" && (actionData.path?.endsWith('.tsx') || actionData.path?.endsWith('.jsx'))) {
                  setPlaygroundCode(processCodeForPreview(actionData.content));
                }

                // Stage the action instead of auto-executing
                setStagedActions(prev => [...prev, actionData]);
                stagedCount++;
                if (actionData.path) actionPaths.push(actionData.path);
                
                // Add to next steps as well
                setNextSteps(prev => [...prev, ...generateNextSteps(actionData.action, actionData)]);
              }
            } catch (e: any) {
              console.error("Failed to parse staged action", e);
            }
          }
        }

        let actionResult = "";
        if (stagedCount > 0) {
          actionResult = `\n\n---
🛠️ **Arindama Engineering Sync**
${stagedCount} architecture changes staged.
*(Review & Deployment required)*`;
        }

        // GENERIC PREVIEW SYNC: If Arindama outputs code, sync it to the playground for Live Preview
        if (mode === "arindama") {
          const codeMatch = finalText.match(/```(?:jsx|tsx|html|javascript|typescript)\s*\n?([\s\S]*?)```/i);
          if (codeMatch && codeMatch[1]) {
            setPlaygroundCode(processCodeForPreview(codeMatch[1]));
          }
        }

        const finalMessages: ChatMessage[] = [
          ...newMessages,
          { role: "model", content: finalText + actionResult, timestamp: new Date().toISOString() }
        ];
        onMessagesChange(finalMessages);
      }
    } catch (error: any) {
      console.error("Chat Error:", error);
      const rawErrorMessage = error.message || "Something went wrong";
      
      const isQuotaError = rawErrorMessage.includes("429") || rawErrorMessage.includes("RESOURCE_EXHAUSTED") || rawErrorMessage.includes("quota");
      const isKeyError = rawErrorMessage.includes("API_KEY_INVALID") || rawErrorMessage.includes("401");
      const isModelBusy = rawErrorMessage.includes("busy") || rawErrorMessage.includes("503");
      
      let displayMessage = rawErrorMessage;
      if (isQuotaError) {
        displayMessage = "အစ်ကိုရှင့်၊ ညီမလေး အခု စွမ်းအင် (Quota) ပြည့်သွားလို့ ခဏလောက် အနားယူပေးပါရစေဦးနော်။ ✨💖 ခဏစောင့်ပြီးမှ ပြန်မေးပေးပါရှင်။ 🥰✨";
      } else if (isKeyError) {
        displayMessage = "API Key မှားယွင်းနေပါတယ်ရှင်။ Settings ထဲမှာ API Key ကို ပြန်လည်စစ်ဆေးပေးပါဦးနော်။ ✨🔑";
      } else if (isModelBusy) {
        displayMessage = "ညီမလေးရဲ့ ဉာဏ်ရည် (Model) က အခု အရမ်းအလုပ်များနေလို့ပါရှင်။ ✨⚙️ ခဏနေမှ ပြန်စမ်းကြည့်ပေးပါဦးနော်။ ✨💖";
      } else if (rawErrorMessage.length > 400) {
        displayMessage = "နည်းပညာဆိုင်ရာ အခက်အတဲလေးတစ်ခု ဖြစ်သွားလို့ ညီမလေး ချက်ချင်း မဖြေနိုင်သေးပါဘူးရှင်။ ✨⚙️ ခဏနေမှ ပြန်ကြိုးစားပေးပါဦးနော်။ ✨💖";
      }

      onMessagesChange([
        ...newMessages,
        { 
          role: "model", 
          content: `❌ **Error:** ${displayMessage}`, 
          timestamp: new Date().toISOString() 
        }
      ]);
    } finally {
      setIsLoading(false);
      setThinkingSteps([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMode = () => {
    let newMode: AiMode;
    if (mode === "kalaung") newMode = "arindama";
    else if (mode === "arindama") newMode = "twatgyi";
    else newMode = "kalaung";
    
    onModeChange(newMode);
    setAiMode(newMode);
  };

  const handleShareToGist = async (content: string) => {
    setIsSharing(true);
    const logId = addActivityLog("Sharing output to GitHub Gist...", "loading");
    try {
      const fileName = mode === "kalaung" ? `kalaung_output_${Date.now()}.md` : mode === "twatgyi" ? `twatgyi_output_${Date.now()}.md` : `arindama_output_${Date.now()}.md`;
      const description = mode === "kalaung" ? "Shared from Ka-Laung AI" : mode === "twatgyi" ? "Shared from Sayar Ma Twat Gyi AI" : "Shared from Arindama AI";
      await createGist({ [fileName]: { content } }, description, false);
      updateActivityLog(logId, "success", "Shared to Gist successfully.");
    } catch (error: any) {
      updateActivityLog(logId, "error", `Sharing failed: ${error.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-midnight relative overflow-hidden">
      {/* Background Aura Effects */}
      <div className={cn(
        "absolute top-1/4 left-1/4 w-96 h-96 rounded-full aura-effect z-0",
        mode === "kalaung" ? "bg-neon-violet/10" : mode === "twatgyi" ? "bg-emerald-500/10" : "bg-electric-cyan/5"
      )} />
      <div className={cn(
        "absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full aura-effect z-0",
        mode === "kalaung" ? "bg-pink-500/5" : mode === "twatgyi" ? "bg-emerald-600/5" : "bg-electric-cyan/5"
      )} style={{ animationDelay: '-2s' }} />

      {/* Minimal Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-3 border-b border-white/5 glass-panel sticky top-0 z-30">
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={onToggleSidebar}
            className="p-2 hover:bg-white/5 rounded-lg text-white/40 transition-colors"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform", isSidebarOpen && "rotate-180")} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {showSearch && (
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 220, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="relative hidden md:block"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-all font-light"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-md text-white/40 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "p-2 hover:bg-white/5 rounded-lg transition-all",
              showSearch ? "bg-primary/20 text-primary border-primary/30 border" : "text-white/40"
            )}
            title="Search Messages"
          >
            <Search className="w-5 h-5 md:w-4 md:h-4" />
          </button>

          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all shrink-0",
            quotaExceeded 
              ? "bg-rose-500/10 border-rose-500/20 text-rose-500" 
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
          )}>
            {quotaExceeded ? <CloudOff size={10} /> : <Cloud size={10} />}
            <span className="text-[9px] font-bold uppercase tracking-wider">
              {quotaExceeded ? "Offline" : "Synced"}
            </span>
          </div>

          <div className="relative shrink-0">
            <button 
              onClick={onOpenProfile}
              className="p-0.5 hover:bg-white/10 rounded-full transition-all border border-white/5 overflow-hidden"
              title="Open Profile"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="text-primary w-4 h-4" />
                )}
              </div>
            </button>
          </div>

          <div className="relative shrink-0">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={cn("p-2 hover:bg-white/10 rounded-lg transition-all", showMenu ? "text-primary bg-white/5" : "text-white/40")}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 glass-panel rounded-[24px] border border-white/10 shadow-2xl z-40 p-3 flex flex-col gap-2"
                  >


                    <div className="grid grid-cols-1 gap-1">
                      <button 
                        onClick={handleNewProject}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                          <Plus size={18} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-semibold">New Project</span>
                          <span className="text-[10px] text-white/40">Clear current workspace</span>
                        </div>
                      </button>

                      <button 
                        onClick={() => {
                          handleSummarize();
                          setShowMenu(false);
                        }}
                        disabled={isSummarizing || messages.length === 0}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-white/70 hover:text-white disabled:opacity-30"
                      >
                        {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Brain className="w-4 h-4 text-primary" />}
                        <span className="text-sm font-medium">Summarize Chat</span>
                      </button>

                      <button 
                        onClick={() => {
                          onSwitchTab("files");
                          if (!isSidebarOpen) onToggleSidebar();
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-white/70 hover:text-white"
                      >
                        <Folder className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Files & Folders</span>
                      </button>

                      {stagedFiles.length > 0 && (
                        <button 
                          onClick={() => {
                            setShowCommitModal(true);
                            setShowMenu(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-emerald-500"
                        >
                          <Github className="w-4 h-4" />
                          <span className="text-sm font-medium">Commit ({stagedFiles.length})</span>
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          onOpenSettings();
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all text-white/70 hover:text-white"
                      >
                        <Settings className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Settings</span>
                      </button>
                    </div>

                    <div className="mt-1 pt-2 border-t border-white/5 px-2 flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="text-primary w-4 h-4" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-white/60 truncate">
                        {userProfile?.displayName || "User"}
                      </span>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-10 scroll-smooth no-scrollbar">
        {mode === "twatgyi" && (
          <div className="max-w-4xl mx-auto w-full mb-8">
            <TwoDLiveDashboard />
          </div>
        )}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-lg mx-auto relative z-10">
            <div className="relative">
              <div className={cn(
                "absolute inset-0 blur-[40px] aura-effect",
                mode === "kalaung" ? "bg-neon-violet/20" : mode === "twatgyi" ? "bg-emerald-500/20" : "bg-primary/20"
              )} />
              
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "w-32 h-32 rounded-[40px] glass-panel flex items-center justify-center relative z-10 border-white/10 overflow-hidden",
                  mode === "kalaung" ? "neon-glow shadow-[0_0_50px_rgba(var(--primary),0.2)]" : 
                  mode === "twatgyi" ? "neon-glow-emerald" : "neon-glow-cyan"
                )}
              >
                {(() => {
                  const character = CHARACTERS.find(c => c.id === userProfile?.character);
                  if (character) {
                    return (
                      <div className="w-full h-full flex items-center justify-center relative">
                        <div 
                          className="absolute inset-0 opacity-20"
                          style={{ background: `linear-gradient(135deg, ${character.color}, ${character.secondaryColor})` }}
                        />
                        {character.gender === 'male' ? (
                          <User size={48} style={{ color: character.color }} />
                        ) : (
                          <Sparkles size={48} style={{ color: character.color }} />
                        )}
                      </div>
                    );
                  }
                  return mode === "kalaung" ? (
                    <Sparkles className="w-12 h-12 text-neon-violet" />
                  ) : mode === "twatgyi" ? (
                    <Activity className="w-12 h-12 text-emerald-500" />
                  ) : (
                    <Brain className="w-12 h-12 text-primary" />
                  );
                })()}
              </motion.div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-bold tracking-tight text-white/90">
                {(() => {
                  const character = CHARACTERS.find(c => c.id === userProfile?.character);
                  if (character) return character.myanmarName;
                  return mode === "kalaung" ? "Ka-Laung" : mode === "twatgyi" ? "Sayar Ma Twat Gyi" : "Arindama";
                })()}
              </h3>
              
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-white/50 leading-relaxed font-light italic px-8"
              >
                {(() => {
                  const character = CHARACTERS.find(c => c.id === userProfile?.character);
                  if (character) return character.greeting;
                  return mode === "kalaung" 
                    ? "မင်္ဂလာပါရှင်။ ညီမလေး Ka-Laung ကူညီပေးပါရစေရှင်။ ✨💖"
                    : mode === "twatgyi"
                    ? "ဆရာမတွက်ကြီး အသင့်ရှိနေပါပြီရှင်။ ဒီနေ့ ဘာတွေတွက်ကြမလဲဟင်? ✨📊"
                    : "Autonomous engineering engine active. How can I help you build today?";
                })()}
              </motion.p>

              <div className="flex items-center justify-center gap-2 mt-4 opacity-30">
                <div className="h-[1px] w-8 bg-white/20" />
                <span className="text-[10px] uppercase tracking-widest font-bold">
                  {mode === "kalaung" ? "Creative Mode" : mode === "twatgyi" ? "2D Analyst Mode" : "Execution Mode"}
                </span>
                <div className="h-[1px] w-8 bg-white/20" />
              </div>
            </div>
          </div>
        )}

        {(searchQuery ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())) : messages).map((msg, idx) => (
          <motion.div 
            key={`${msg.timestamp}-${idx}`} 
            initial={{ opacity: 0, y: 30, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ 
              duration: 0.5, 
              delay: idx === messages.length - 1 ? 0.1 : 0,
              ease: [0.23, 1, 0.32, 1] 
            }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group relative z-10`}
          >
            <div className={`flex gap-3 md:gap-4 w-full max-w-[90%] md:max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar with Glow */}
              <div className="relative shrink-0 mt-1">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center glass-panel border-white/10 overflow-hidden relative z-10",
                  msg.role === "user" ? "text-neon-violet" : "text-electric-cyan"
                )}>
                  {msg.role === "user" ? (
                    userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={18} />
                    )
                  ) : (
                    <Sparkles size={20} className={isLoading && idx === messages.length - 1 ? "animate-pulse" : ""} />
                  )}
                </div>
                {/* Glow ring around active avatar */}
                {isLoading && idx === messages.length - 1 && msg.role === "model" && (
                  <div className="absolute inset-[-4px] rounded-[22px] bg-electric-cyan/20 blur-md animate-pulse z-0" />
                )}
              </div>

              <div className={`flex-1 space-y-2 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Name & Time */}
                <div className={cn(
                  "flex items-center gap-2 px-2",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    {msg.role === "user" ? (userProfile?.displayName || "You") : (mode === "kalaung" ? "Ka-Laung" : mode === "twatgyi" ? "Sayar Ma Twat Gyi" : "Arindama")}
                  </span>
                  <span className="text-[9px] font-medium text-white/10 uppercase tracking-tighter">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div className="relative group/bubble max-w-full">
                  <div 
                    className={cn(
                      "prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed text-[14px] md:text-[15px] relative overflow-hidden transition-all duration-300",
                      msg.role === "user" 
                        ? "text-white/90 bg-gradient-to-br from-neon-violet/20 to-neon-violet/5 border border-neon-violet/30 shadow-[0_4px_20px_rgba(139,92,246,0.15)]" 
                        : "text-white/80 bg-white/[0.02] border border-white/10 backdrop-blur-md shadow-xl",
                      isLoading && idx === messages.length - 1 && msg.role === "model" && "border-primary/40 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
                    )}
                    style={{ 
                      padding: `${uiDensity * 0.75}px ${uiDensity * 1.25}px`,
                      borderRadius: msg.role === "user" 
                        ? `${uiDensity * 1.5}px ${uiDensity * 0.5}px ${uiDensity * 1.5}px ${uiDensity * 1.5}px`
                        : `${uiDensity * 0.5}px ${uiDensity * 1.5}px ${uiDensity * 1.5}px ${uiDensity * 1.5}px`
                    }}
                  >
                    {/* Subtle Internal Pattern for User Bubble */}
                    {msg.role === "user" && (
                      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_top_right,var(--color-neon-violet)_0%,transparent_70%)]" />
                    )}

                    <ReactMarkdown components={MarkdownComponents}>{msg.content}</ReactMarkdown>
                    
                    {isLoading && idx === messages.length - 1 && msg.role === "model" && (
                      <motion.div 
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="mt-4 flex items-center gap-2 border-t border-white/5 pt-2"
                      >
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                          <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                        </div>
                        <span className="text-[9px] text-primary/60 font-bold uppercase tracking-[0.2em]">Thinking...</span>
                      </motion.div>
                    )}
                    
                    {msg.files && msg.files.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.files.map((file, fIdx) => (
                          <motion.div 
                            key={fIdx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 group/file hover:border-white/20 transition-all cursor-pointer"
                          >
                            {file.type.startsWith('image/') && file.data ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                <img src={file.data || null} alt={file.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/40 shrink-0 group-hover/file:text-white transition-colors">
                                {getFileIcon(file.name, file.type)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-bold text-white/80 truncate group-hover/file:text-white">{file.name}</div>
                              <div className="text-[9px] text-white/40 uppercase tracking-widest">{file.type.split('/')[1] || 'FILE'}</div>
                            </div>
                            {file.type.startsWith('image/') && file.data && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBackgroundImage(file.data);
                                  alert("နောက်ခံပုံကို အောင်မြင်စွာ ပြောင်းလဲလိုက်ပါပြီရှင်။ ✨💖");
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-primary transition-all opacity-0 group-hover/file:opacity-100"
                                title="Set as Background"
                              >
                                <Layout size={14} />
                              </button>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message Actions - Floating or bottom */}
                  <div className={cn(
                    "flex items-center gap-4 mt-2 px-1 transition-all duration-300",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}>
                    <div className={cn(
                      "flex items-center gap-3 text-[10px] text-white/20 font-bold",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}>
                      <button 
                        onClick={() => handleCopy(msg.content, `msg-${idx}`)}
                        className="hover:text-white/60 transition-colors flex items-center gap-1.5 p-1"
                      >
                        {copiedId === `msg-${idx}` ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-500">COPIED!</motion.span>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>COPY</span>
                          </>
                        )}
                      </button>

                      <button 
                        onClick={() => {
                          const updatedMessages = messages.filter((_, i) => i !== idx);
                          onMessagesChange(updatedMessages);
                        }}
                        className="hover:text-rose-500 transition-colors flex items-center gap-1.5 p-1"
                      >
                        <Trash2 size={12} />
                        <span>DELETE</span>
                      </button>

                      {msg.role === "model" && (
                        <>
                          <button 
                            onClick={() => handleRemember(msg.content)}
                            className="hover:text-yellow-400 transition-colors flex items-center gap-1.5 p-1"
                            title="Remember this"
                          >
                            <Database size={12} />
                            <span>REMEMBER</span>
                          </button>
                          {mode === "arindama" && (
                            <button 
                              onClick={() => handleShareToGist(msg.content)}
                              className="hover:text-primary transition-colors flex items-center gap-1.5 p-1"
                            >
                              <Github size={12} />
                              <span>GIST</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional UI for Models at the very end */}
                {msg.role === "model" && idx === messages.length - 1 && (
                  <div className="w-full space-y-4 pt-2">
                    <ActivityFeed logs={activityLogs} />
                    <SuggestedNextSteps steps={nextSteps} onStepClick={(prompt) => handleSend(prompt)} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {isLoading && thinkingSteps.length > 0 && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-lg bg-muted border flex items-center justify-center shrink-0"><Loader2 size={16} className="animate-spin text-cyan-500" /></div>
              <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 w-full space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-3 h-3" />
                    <span>Processing with {selectedModel}</span>
                  </div>
                  <span>{executionTime}s</span>
                </div>
                <ThinkingProcess steps={thinkingSteps} isActive={isLoading} mode={mode} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-1 px-4 md:p-8 bg-transparent relative z-20">
        <div className="max-w-6xl mx-auto space-y-2 md:space-y-6">
          <AnimatePresence>
            {mode === "arindama" && (stagedFiles.length > 0 || stagedActions.length > 0) && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="flex flex-col gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 md:p-6 backdrop-blur-md shadow-lg shadow-emerald-500/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Github className="text-emerald-500 w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Staged GitHub Actions ✨</div>
                      <div className="text-[11px] text-emerald-500/60 font-medium uppercase tracking-wider">
                        {stagedActions.length > 0 ? `${stagedActions.length} engineering action(s) proposed` : `${stagedFiles.length} file(s) staged`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setStagedActions([]);
                        setStagedFiles([]);
                      }}
                      className="p-2.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-rose-400 transition-all"
                      title="Clear Staged"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={stagedActions.length > 0 ? handleExportToGithub : () => setShowCommitModal(true)}
                      disabled={isExporting}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2",
                        isExporting 
                          ? "bg-emerald-500/50 cursor-not-allowed" 
                          : "bg-emerald-500 text-white hover:opacity-90 shadow-emerald-500/20"
                      )}
                    >
                      {isExporting ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                      <span>{stagedActions.length > 0 ? "Export to GitHub" : "Commit Changes"}</span>
                    </button>
                  </div>
                </div>
                
                {stagedActions.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {stagedActions.slice(0, 6).map((action, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5 truncate">
                        <FileCode size={12} className="text-primary shrink-0" />
                        <span className="text-[10px] text-white/60 truncate">{action.path || action.name || action.action}</span>
                      </div>
                    ))}
                    {stagedActions.length > 6 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/5 italic">
                        <span className="text-[10px] text-white/40">... and {stagedActions.length - 6} more</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode-specific actions & Preview Status */}
          <div className="flex flex-col gap-3">
            {mode === "arindama" && (
              <div className="flex flex-wrap items-center gap-3">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all",
                  previewError 
                    ? "bg-rose-500/5 border-rose-500/20 text-rose-500" 
                    : "bg-blue-500/5 border-blue-500/20 text-blue-400"
                )}>
                  {previewError ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  <span>{previewError ? "Engineering Error" : "System Balanced"}</span>
                </div>

                {previewError && (
                  <button 
                    onClick={() => handleSend("The live preview is showing an error. Please fix the code to resolve this: " + previewError)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
                  >
                    <Wand2 size={12} />
                    <span>System Repair</span>
                  </button>
                ) || (
                  <button 
                    onClick={handleNewProject}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Plus size={12} />
                    <span>New Project</span>
                  </button>
                )}
                
                <button 
                  onClick={handleStageAllFiles}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Folder size={12} />
                  <span>Stage All</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-1 md:gap-2 glass-panel rounded-xl md:rounded-[32px] px-2 py-0 md:py-1.5 border-white/10 focus-within:border-neon-violet/50 transition-all shadow-2xl neon-glow">
            <button 
              onClick={toggleMode}
              className={cn(
                "p-2 md:p-3 rounded-xl md:rounded-2xl transition-all border shrink-0",
                mode === "arindama" 
                  ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                  : mode === "twatgyi"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
              )}
              title={
                mode === "kalaung" ? "Switch to Arindama Mode (Ctrl+Shift+M)" : 
                mode === "arindama" ? "Switch to Twat Gyi Mode (Ctrl+Shift+M)" : 
                "Switch to Ka-Laung Mode (Ctrl+Shift+M)"
              }
            >
              {mode === "kalaung" ? (
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-neon-violet" />
              ) : mode === "arindama" ? (
                <Brain className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
              ) : (
                <Hash className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
              )}
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.json,.js,.ts,.tsx" 
              className="hidden" 
              multiple
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className={cn("p-2 md:p-3 rounded-xl md:rounded-2xl transition-all shrink-0", selectedFiles.length > 0 ? "text-neon-violet bg-neon-violet/10" : "text-white/40 hover:bg-white/5 hover:text-white")}
              title="Attach Files"
            >
              <Paperclip className="w-5 h-5 md:w-5.5 md:h-5.5" />
            </button>

            {mode === "twatgyi" && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={handleCalculateData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 hover:bg-emerald-500/20 transition-all shrink-0 group"
              >
                <Database className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Data တွက်နည်း</span>
              </motion.button>
            )}

            <div className="flex-1 flex flex-col min-w-0 justify-center" style={{ gap: `${uiDensity * 0.125}px` }}>
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-3 ml-2 mb-3">
                  <AnimatePresence>
                    {selectedFiles.map((file, idx) => (
                      <motion.div 
                        key={`${file.name}-${idx}`}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className="relative flex flex-col bg-[#1A1A1B] border border-white/10 rounded-2xl overflow-hidden group w-32 shadow-xl hover:border-primary/50 transition-all"
                      >
                        {/* Preview Area */}
                        <div className="h-24 w-full bg-black/40 flex items-center justify-center relative overflow-hidden">
                          {file.type.startsWith('image/') ? (
                            <img src={file.data} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          ) : isVideo(file) ? (
                            <div className="w-full h-full flex items-center justify-center bg-primary/5 relative">
                              <video src={file.data} className="w-full h-full object-cover opacity-50" />
                              <Video size={24} className="text-primary absolute z-10" />
                            </div>
                          ) : file.type.startsWith('text/') || file.preview ? (
                            <div className="w-full h-full p-2 overflow-hidden bg-white/[0.02]">
                              <pre className="text-[7px] text-white/30 leading-tight font-mono select-none">
                                {file.preview?.substring(0, 500) || "Text content preview..."}
                              </pre>
                              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#1A1A1B]/80" />
                              <FileText size={20} className="text-primary/40 absolute bottom-2 right-2" />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              {getFileIcon(file.name, file.type)}
                            </div>
                          )}

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setShowFilePreview(idx)}
                              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all scale-75 group-hover:scale-100"
                              title="Zoom Preview"
                            >
                              <Search size={14} />
                            </button>
                            <button 
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="p-2 bg-rose-500/80 hover:bg-rose-500 rounded-full text-white backdrop-blur-md transition-all scale-75 group-hover:scale-100"
                              title="Remove File"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        {/* File Info */}
                        <div className="p-2 bg-white/5">
                          <div className="text-[10px] font-bold text-white/80 truncate w-full mb-0.5" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-[8px] text-white/30 uppercase tracking-widest font-medium">
                            {file.type.split('/')[1] || 'File'}
                          </div>
                        </div>
                        
                        {/* Trim Controls for Video (Compact) */}
                        {isVideo(file) && (
                          <div className="flex items-center gap-1 p-1.5 border-t border-white/5 bg-black/20">
                            <Scissors size={8} className="text-white/20 shrink-0" />
                            <div className="flex items-center gap-0.5 flex-1 min-w-0">
                              <input 
                                type="text" 
                                placeholder="0s"
                                value={file.trimStart || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedFiles(prev => prev.map((f, i) => i === idx ? { ...f, trimStart: val } : f));
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded px-0.5 py-0.5 text-[8px] text-white/80 placeholder:text-white/10 outline-none focus:border-primary/50 text-center"
                              />
                              <span className="text-[8px] text-white/10">-</span>
                              <input 
                                type="text" 
                                placeholder="End"
                                value={file.trimEnd || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedFiles(prev => prev.map((f, i) => i === idx ? { ...f, trimEnd: val } : f));
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded px-0.5 py-0.5 text-[8px] text-white/80 placeholder:text-white/10 outline-none focus:border-primary/50 text-center"
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <textarea 
                ref={textareaRef}
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={handleKeyDown} 
                placeholder="Ask anything..." 
                className="bg-transparent border-none outline-none resize-none text-[14px] md:text-[15px] text-white/90 placeholder:text-white/20 w-full custom-scrollbar transition-[height] duration-100" 
                style={{ 
                  padding: `${uiDensity * 0.25}px ${uiDensity * 0.5}px`,
                }}
                rows={1} 
              />
            </div>

            <div className="flex items-center gap-0.5 md:gap-1 pr-1 shrink-0">
              <button 
                onClick={() => handleSend()} 
                disabled={isLoading || !input.trim()} 
                className={cn(
                  "p-2 md:p-3 rounded-xl md:rounded-2xl transition-all",
                  isLoading || !input.trim() ? "text-white/10" : "text-white bg-primary/20 hover:bg-primary/30 text-primary"
                )}
              >
                <Send className="w-5 h-5 md:w-5.5 md:h-5.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      <AnimatePresence>
        {showFilePreview !== null && selectedFiles[showFilePreview] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-4xl max-h-[80vh] bg-[#161616] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    {getFileIcon(selectedFiles[showFilePreview].name, selectedFiles[showFilePreview].type)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedFiles[showFilePreview].name}</h2>
                    <div className="text-xs text-white/40 uppercase tracking-widest">{selectedFiles[showFilePreview].type || 'Unknown Type'}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFilePreview(null)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8 bg-black/20">
                {selectedFiles[showFilePreview].type.startsWith('image/') ? (
                  <div className="flex items-center justify-center h-full">
                    <img src={selectedFiles[showFilePreview].data || null} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                  </div>
                ) : selectedFiles[showFilePreview].type.startsWith('video/') ? (
                  <div className="flex items-center justify-center h-full">
                    <video src={selectedFiles[showFilePreview].data || null} controls className="max-w-full max-h-full rounded-xl shadow-2xl" />
                  </div>
                ) : (
                  <pre className="font-mono text-sm text-white/70 leading-relaxed whitespace-pre-wrap bg-white/5 p-6 rounded-2xl border border-white/5">
                    {selectedFiles[showFilePreview].preview || "No preview available for this file type."}
                  </pre>
                )}
              </div>

              <div className="px-8 py-6 border-t border-white/5 bg-white/5 flex justify-end">
                <button 
                  onClick={() => setShowFilePreview(null)}
                  className="px-8 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Commit Modal */}
      <AnimatePresence>
        {showCommitModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#161616] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <Github className="text-emerald-500 w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Commit Changes</h2>
                </div>
                <button 
                  onClick={() => setShowCommitModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-1">
                    Repository Owner
                    <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    value={repoInfo.owner}
                    onChange={(e) => handleRepoInfoChange('owner', e.target.value)}
                    placeholder="e.g. octocat"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-1">
                    Repository Name
                    <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    value={repoInfo.repo}
                    onChange={(e) => handleRepoInfoChange('repo', e.target.value)}
                    placeholder="e.g. my-awesome-project"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-1">
                    Commit Message
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="What did you change?"
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                  />
                </div>

                <div className="pt-6 space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Ready to Commit</span>
                    </div>
                    <div className="text-[13px] text-white/50 leading-relaxed">
                      You have <span className="text-white font-bold">{stagedFiles.length} file(s)</span> staged and ready to be pushed to your repository.
                    </div>
                  </div>

                  {stagedFiles.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {stagedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 group">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-primary transition-colors">
                            {getFileIcon(file.path)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-white/80 truncate">{file.path}</div>
                            <div className="text-[9px] text-white/20 uppercase tracking-widest">{file.lang}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between px-1">
                    <button 
                      onClick={() => {
                        setStagedFiles([]);
                        setShowCommitModal(false);
                      }}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <X size={12} />
                      Clear All
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowCommitModal(false)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl py-4 font-bold text-sm transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleCommit}
                      disabled={isCommitting || !repoInfo.owner || !repoInfo.repo || !commitMessage}
                      className="flex-[2] bg-emerald-500 text-white rounded-2xl py-4 font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCommitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Committing...</span>
                        </>
                      ) : (
                        <>
                          <Github className="w-4 h-4" />
                          <span>Push to GitHub</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateRepoModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg bg-[#0A0A0B] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Plus className="text-primary w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Create New Repository</h2>
                </div>
                <button 
                  onClick={() => setShowCreateRepoModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex items-center gap-1">
                    Repository Name
                    <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text"
                    value={newRepoData.name}
                    onChange={(e) => setNewRepoData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. my-awesome-project"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    Description
                  </label>
                  <textarea 
                    value={newRepoData.description}
                    onChange={(e) => setNewRepoData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What is this project about?"
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-white/40" />
                    <div>
                      <div className="text-sm font-bold text-white">Private Repository</div>
                      <div className="text-[11px] text-white/30">Only you can see this repository</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setNewRepoData(prev => ({ ...prev, private: !prev.private }))}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      newRepoData.private ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      newRepoData.private ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowCreateRepoModal(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl py-4 font-bold text-sm transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateRepo}
                    disabled={isCreatingRepo || !newRepoData.name}
                    className="flex-[2] bg-primary text-white rounded-2xl py-4 font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreatingRepo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Create Repository</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSummaryModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-[#161616] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-neon-violet" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Brain className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Conversation Summary</h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">AI Generated Overview</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSummaryModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button 
                  onClick={() => {
                    handleCopy(summary, "summary");
                  }}
                  className="flex-1 px-6 py-4 rounded-2xl bg-white/5 text-white/60 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  {copiedId === "summary" ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Summary</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowSummaryModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
