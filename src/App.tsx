// Khittara AI - Creative & Strategic Assistant ✨
import { useState, useEffect, useRef } from "react";
import ChatInterface from "./components/ChatInterface";
import Sidebar from "./components/Sidebar";
import SplashScreen from "./components/SplashScreen";
import ProfilePage from "./components/ProfilePage";
import CharacterSelection from "./components/CharacterSelection";
import AuthScreen from "./components/AuthScreen";
import LiveChat from "./components/LiveChat";
import { PREFERRED_MODELS, GROQ_MODELS, OPENROUTER_MODELS, ChatMessage, type AiMode, validateApiKey } from "./lib/gemini";
import { Settings, Github, Key, X, Brain, Sparkles, Database, Zap, Trash2, LogOut, Loader2, Check, AlertCircle, Type, User as UserIcon, ChevronRight, Maximize, Cpu, Terminal, Image as ImageIcon, ShieldCheck, Compass, Layout, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  getApiKey, 
  setApiKey, 
  getGroqApiKey,
  setGroqApiKey,
  getOpenRouterApiKey,
  setOpenRouterApiKey,
  getOpenAiApiKey,
  setOpenAiApiKey,
  getGithubToken, 
  setGithubToken, 
  getChatHistory, 
  saveChatSession, 
  deleteChatSession,
  getKnowledgeBase,
  setKnowledgeBase,
  getEvolutionDirectives,
  setEvolutionDirectives,
  getAiMode,
  getFontSize,
  setFontSize,
  getUiDensity,
  setUiDensity,
  getModel,
  setModel,
  getTasks,
  saveTasks,
  getDeepMemory,
  setDeepMemory,
  getBackgroundImage,
  getActiveSessionId,
  setActiveSessionId,
  ChatSession,
  Task,
  UserMemory
} from "./lib/store";
import { extractMemory } from "./services/memoryService";
import { v4 as uuidv4 } from "uuid";
import { cn, isValidGeminiKey, isValidGitHubToken } from "./lib/utils";
import CommandPalette from "./components/CommandPalette";
import LivePreview from "./components/LivePreview";
import { auth, signInWithGoogle, logout, onAuthStateChanged, User, db, collection, doc, setDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, disableNetwork, enableNetwork } from "./lib/firebase";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const isQuotaError = message.includes('resource-exhausted') || message.includes('Quota exceeded');
  
  if (isQuotaError) {
    // Dispatch a custom event so the App component can react to quota issues
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    return; // Suppress throwing for quota errors to prevent app crashes
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeFirestoreData(data: any): any {
  // Deep clone
  const cloned = JSON.parse(JSON.stringify(data));
  
  // Strip ALL base64 data to save quota and storage
  // Firestore free tier is very sensitive to document size (1 write unit per 1KB)
  if (cloned.messages) {
    cloned.messages.forEach((m: any) => {
      if (m.files) {
        m.files.forEach((f: any) => {
          // We keep the metadata (name, type) but remove the heavy base64 data
          // The data is still available in the user's local state/localStorage
          f.data = ""; 
        });
      }
    });
  }
  
  return cloned;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const activeId = getActiveSessionId();
    if (activeId) {
      const history = getChatHistory();
      const session = history.find(s => s.id === activeId);
      return session ? session.messages : [];
    }
    return [];
  });
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(getApiKey());
  const [groqKey, setGroqKey] = useState(getGroqApiKey());
  const [openRouterKey, setOpenRouterKey] = useState(getOpenRouterApiKey());
  const [openaiKey, setOpenAiKey] = useState(getOpenAiApiKey());
  const [githubToken, setGithubTokenState] = useState(getGithubToken());
  
  const [validationStatus, setValidationStatus] = useState<Record<string, "idle" | "loading" | "success" | "error">>({
    google: "idle",
    groq: "idle",
    openrouter: "idle",
    openai: "idle"
  });
  const [knowledgeBase, setKnowledgeBaseState] = useState(getKnowledgeBase());
  const [evolutionDirectives, setEvolutionDirectivesState] = useState(getEvolutionDirectives());
  const [fontSize, setFontSizeState] = useState(getFontSize());
  const [uiDensity, setUiDensityState] = useState(getUiDensity());
  const [selectedModel, setSelectedModel] = useState(getModel());
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  
  const [sessions, setSessions] = useState<ChatSession[]>(getChatHistory());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(getActiveSessionId());
  const [tasks, setTasks] = useState<Task[]>(getTasks());
  const hasAutoLoadedLatest = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "files" | "tasks" | "preview">("chats");
  const [isSplitView, setIsSplitView] = useState(false);
  const [mode, setMode] = useState<AiMode>(getAiMode());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [deepMemory, setDeepMemoryState] = useState<UserMemory | null>(getDeepMemory());
  const [isExtractingMemory, setIsExtractingMemory] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    setBgImage(getBackgroundImage());
    
    // Polling or listener for background changes from Settings
    const interval = setInterval(() => {
      const current = getBackgroundImage();
      if (current !== bgImage) {
        setBgImage(current);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [bgImage]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
  }, []);

  useEffect(() => {
    if (quotaExceeded) {
      disableNetwork(db).catch(err => console.error("Error disabling network:", err));
    } else {
      enableNetwork(db).catch(err => console.error("Error enabling network:", err));
    }
  }, [quotaExceeded]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      
      // Clear local state on logout to prevent data leakage and fulfill "preserved history" per user
      if (!currentUser) {
        setMessages([]);
        setCurrentSessionId(null);
        setSessions([]);
        hasAutoLoadedLatest.current = false;
      }
      
      // If user is logged in but hasn't set keys, show key setup
      if (currentUser && !getApiKey()) {
        setShowKeySetup(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync User Profile
  useEffect(() => {
    if (!user || quotaExceeded) {
      if (!user) setUserProfile(null);
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserProfile(data);
        
        // Show character selection if character is not set
        if (!data.character && !showSplash) {
          setShowCharacterSelection(true);
        } else {
          setShowCharacterSelection(false);
          // Sync mode with character if available
          if (data.character && (data.character === 'kalaung' || data.character === 'arindama' || data.character === 'twatgyi')) {
            setMode(data.character as AiMode);
          }
        }
      } else {
        // Create initial profile if it doesn't exist
        const initialProfile = {
          uid: user.uid,
          displayName: user.displayName || "Anonymous",
          photoURL: user.photoURL || "",
          email: user.email || "",
          updatedAt: new Date().toISOString()
        };
        
        try {
          await setDoc(userDocRef, initialProfile);
          setUserProfile(initialProfile);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    });

    return () => unsubscribe();
  }, [user, quotaExceeded]);

  // Real-time Firestore sync
  useEffect(() => {
    if (!user || quotaExceeded) {
      if (!user) setSessions([]);
      return;
    }

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreSessions = snapshot.docs.map(doc => doc.data() as ChatSession);
      setSessions(firestoreSessions);
      
      // If we just logged in and have sessions, auto-load the most recent one
      // but only if we don't have a current session id and messages are empty
      if (firestoreSessions.length > 0 && !currentSessionId && messages.length === 0 && !hasAutoLoadedLatest.current) {
        const latest = firestoreSessions[0]; // Already ordered by updatedAt desc
        setMessages(latest.messages);
        setCurrentSessionId(latest.id);
        hasAutoLoadedLatest.current = true;
      }
      
      // Update current session if it changed in Firestore
      if (currentSessionId) {
        const current = firestoreSessions.find(s => s.id === currentSessionId);
        // Only update local messages if Firestore version is newer or significantly different
        if (current && JSON.stringify(current.messages) !== JSON.stringify(messages)) {
          // Check if we are currently in the middle of a local update to avoid overwriting
          // For now, we'll just update if the lengths are different or it's a new session
          if (current.messages.length > messages.length) {
            setMessages(current.messages);
          }
        }
      }
    }, (error: any) => {
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      } else {
        handleFirestoreError(error, OperationType.LIST, "sessions");
      }
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  // Tasks Synchronization
  useEffect(() => {
    if (!user || quotaExceeded) {
      if (!user) setTasks([]);
      return;
    }

    const q = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreTasks = snapshot.docs.map(doc => doc.data() as Task);
      setTasks(firestoreTasks);
      saveTasks(firestoreTasks);
    }, (error: any) => {
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      } else {
        handleFirestoreError(error, OperationType.LIST, "tasks");
      }
    });

    return () => unsubscribe();
  }, [user, quotaExceeded]);

  // Deep Memory Sync from Firestore
  useEffect(() => {
    if (!user || quotaExceeded) return;

    const unsub = onSnapshot(doc(db, "memories", user.uid), (snap) => {
      if (snap.exists()) {
        const memData = snap.data() as UserMemory;
        setDeepMemoryState(memData);
        setDeepMemory(memData);
      }
    }, (err) => {
      console.warn("Memory sync error:", err);
    });

    return () => unsub();
  }, [user, quotaExceeded]);

  // Memory Extraction Logic
  useEffect(() => {
    if (!user || messages.length < 5 || isExtractingMemory || quotaExceeded) return;

    // Trigger every 5-10 messages, or when session changes
    const timer = setTimeout(async () => {
      setIsExtractingMemory(true);
      try {
        const extracted = await extractMemory(messages, deepMemory || undefined);
        if (extracted) {
          const updatedMemory = {
            ...extracted,
            userId: user.uid,
            updatedAt: new Date().toISOString()
          };
          
          // Save locally
          setDeepMemoryState(updatedMemory as any);
          setDeepMemory(updatedMemory as any);
          
          // Save to Firestore
          await setDoc(doc(db, "memories", user.uid), updatedMemory);
        }
      } catch (err) {
        console.error("Memory Extraction Execution Error:", err);
      } finally {
        setIsExtractingMemory(false);
      }
    }, 30000); // 30s debounce to avoid frequent AI calls

    return () => clearTimeout(timer);
  }, [messages.length, user, deepMemory, isExtractingMemory, quotaExceeded]);

  useEffect(() => {
    if (mode === 'kalaung' && sidebarTab === 'files') {
      setSidebarTab('chats');
    }
    // Auto-enable split view in arindama mode on desktop
    if (mode === 'arindama' && window.innerWidth >= 1280) {
      setIsSplitView(true);
    } else {
      setIsSplitView(false);
    }
  }, [mode, sidebarTab]);

  // Local persistence sync
  useEffect(() => {
    setActiveSessionId(currentSessionId);
    
    if (messages.length > 0 && currentSessionId) {
      const firstUserMessage = messages.find(m => m.role === "user")?.content || "New Chat";
      const title = firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? "..." : "");

      const session: ChatSession = {
        id: currentSessionId,
        title: title,
        messages: messages,
        updatedAt: new Date().toISOString()
      };

      saveChatSession(session);
      
      // If not logged in, update the local sessions list for the sidebar
      if (!user) {
        setSessions(getChatHistory());
      }
    }
  }, [messages, currentSessionId, user]);

  // Debounced save to Firestore
  useEffect(() => {
    if (!user || quotaExceeded) return;

    // Only save if there are messages
    if (messages.length === 0) return;

    const timer = setTimeout(async () => {
      // sessionId is guaranteed by handleMessagesChange
      const sessionId = currentSessionId;
      if (!sessionId) return;

      // Check if this session already exists and if messages have actually changed
      const existingSession = sessions.find(s => s.id === sessionId);
      if (existingSession && JSON.stringify(existingSession.messages) === JSON.stringify(messages)) {
        return; // No meaningful change, skip write to save quota
      }

      const firstUserMessage = messages.find(m => m.role === "user")?.content || "New Chat";
      const title = firstUserMessage.slice(0, 30) + (firstUserMessage.length > 30 ? "..." : "");

      const session: ChatSession & { userId: string } = {
        id: sessionId,
        userId: user.uid,
        title: title,
        messages: messages,
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, "sessions", sessionId), sanitizeFirestoreData(session));
      } catch (error: any) {
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          setQuotaExceeded(true);
        } else {
          handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}`);
        }
      }
    }, 5000); // Reduced debounce to 5s for better responsiveness while still saving quota

    return () => clearTimeout(timer);
  }, [messages, currentSessionId, user, quotaExceeded, sessions]);

  const handleSaveSettings = async () => {
    // Basic validation before saving
    if (!geminiKey) {
      alert("Gemini API Key က မရှိမဖြစ် လိုအပ်ပါတယ်ရှင်။ ✨💖");
      return;
    }
    
    if (geminiKey && !isValidGeminiKey(geminiKey)) {
      alert("Gemini API Key format မမှန်ကန်ပါဘူးရှင်။ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပေးပါဦးနော်။ ✨💖");
      return;
    }

    if (githubToken && !isValidGitHubToken(githubToken)) {
      alert("GitHub Token format မမှန်ကန်ပါဘူးရှင်။ 'ghp_' သို့မဟုတ် 'github_pat_' နဲ့ စရပါမယ်ရှင်။ ✨🔐");
      return;
    }

    setIsSavingSettings(true);
    setSaveSettingsSuccess(false);
    
    try {
      setApiKey(geminiKey);
      setGroqApiKey(groqKey);
      setOpenRouterApiKey(openRouterKey);
      setOpenAiApiKey(openaiKey);
      setGithubToken(githubToken);
      setKnowledgeBase(knowledgeBase);
      setEvolutionDirectives(evolutionDirectives);
      setFontSize(fontSize);
      setUiDensity(uiDensity);
      setModel(selectedModel);
      
      setSaveSettingsSuccess(true);
      setTimeout(() => {
        setSaveSettingsSuccess(false);
        setShowSettings(false);
        setShowKeySetup(false);
      }, 1500);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleMessagesChange = (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    if (newMessages.length > 0 && !currentSessionId) {
      setCurrentSessionId(uuidv4());
    }
  };

  const handleClearHistory = async () => {
    if (!user || quotaExceeded) return;
    
    setIsSavingSettings(true);
    try {
      const q = query(collection(db, "sessions"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(sessionDoc => deleteDoc(doc(db, "sessions", sessionDoc.id)));
      await Promise.all(deletePromises);
      
      handleNewChat();
      setShowClearConfirm(false);
    } catch (error) {
      console.error("Error clearing history:", error);
      alert("History ဖျက်လို့ မရဖြစ်နေပါတယ်ရှင်။ ✨💖");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleNewProject = () => {
    if (window.confirm("ပရောဂျက်အသစ် စတင်ချင်တာ သေချာပါသလားရှင်? Chat histories နဲ့ Actions တွေ အားလုံးကို ဖျက်ပေးမှာ ဖြစ်ပါတယ်ရှင်။ ✨📁")) {
      handleNewChat();
      // Additional reset logic will be handled by ChatInterface via a prop
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setActiveSessionId(null);
  };

  const handleSelectSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setMessages(session.messages);
      setCurrentSessionId(session.id);
      setActiveSessionId(session.id);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (quotaExceeded) {
      alert("Quota ပြည့်သွားတဲ့အတွက် Cloud ပေါ်ကနေ ဖျက်လို့မရသေးပါဘူးရှင်။");
      return;
    }
    try {
      await deleteDoc(doc(db, "sessions", id));
      if (currentSessionId === id) {
        handleNewChat();
      }
    } catch (error: any) {
      if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      } else {
        handleFirestoreError(error, OperationType.DELETE, `sessions/${id}`);
      }
    }
  };

  const handleCharacterSelect = async (characterId: string) => {
    if (!user || quotaExceeded) return;
    
    const userDocRef = doc(db, "users", user.uid);
    try {
      await setDoc(userDocRef, { 
        character: characterId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setMode(characterId as AiMode);
      setShowCharacterSelection(false);
      
      // If keys are also missing, that will be handled by the onAuthStateChanged effect
      // but let's double check here to be smooth
      if (!getApiKey()) {
        setShowKeySetup(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleAddTask = async (title: string, dueDate?: string) => {
    if (!user) return;
    const taskId = uuidv4();
    const newTask: Task = {
      id: taskId,
      userId: user.uid,
      title,
      completed: false,
      dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Optimistic update
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    if (quotaExceeded) return;

    try {
      await setDoc(doc(db, "tasks", taskId), newTask);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const updatedTask = { 
      ...task, 
      completed: !task.completed,
      updatedAt: new Date().toISOString()
    };

    // Optimistic update
    const updatedTasks = tasks.map(t => t.id === id ? updatedTask : t);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    if (!user || quotaExceeded) return;

    try {
      await setDoc(doc(db, "tasks", id), updatedTask, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    // Optimistic update
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    if (!user || quotaExceeded) return;

    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  if (isAuthLoading) return null;

  const handleValidateKey = async (provider: "google" | "groq" | "openrouter" | "openai", key: string) => {
    if (!key) return;
    setValidationStatus(prev => ({ ...prev, [provider]: "loading" }));
    const isValid = await validateApiKey(provider, key);
    setValidationStatus(prev => ({ ...prev, [provider]: isValid ? "success" : "error" }));
    
    if (!isValid) {
      alert(`${provider.toUpperCase()} API Key မှားယွင်းနေပါတယ်ရှင်။ ကျေးဇူးပြု၍ ပြန်လည်စစ်ဆေးပေးပါရှင်။`);
    }
  };

  if (!user && !showSplash) {
    return <AuthScreen />;
  }

  if (showCharacterSelection && !showSplash) {
    return (
      <CharacterSelection 
        userName={user?.displayName || "အစ်ကို"} 
        onSelect={handleCharacterSelect} 
      />
    );
  }

  if (showKeySetup && !showSplash) {
    return (
      <div className="flex min-h-screen bg-[#0c0c0c] items-center justify-center p-4 overflow-y-auto py-12">
        <div className="w-full max-w-xl glass-panel rounded-[32px] p-6 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Decorative background for BYUOK */}
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Key size={120} className="text-primary rotate-12" />
          </div>

          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Key className="text-primary w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Bring Your Own Key</h2>
              <p className="text-xs text-white/40 italic">Set up your API keys to start chatting with Khittara AI</p>
            </div>
          </div>
          
          <div className="space-y-8 relative z-10">
            {/* Gemini Setup */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                    <Key className="w-3 h-3" /> Gemini API Key (Required)
                  </label>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Get Key <ChevronRight size={10} />
                  </a>
                </div>
                <div className="relative group">
                  <textarea 
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value.trim())}
                    placeholder="AIzaSy..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none font-mono"
                  />
                  {geminiKey && (
                    <button 
                      onClick={() => handleValidateKey("google", geminiKey)}
                      disabled={validationStatus.google === "loading"}
                      className="absolute right-3 top-3 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 rounded-xl text-primary text-[10px] font-bold uppercase transition-all flex items-center gap-2"
                    >
                      {validationStatus.google === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                      Validate
                    </button>
                  )}
                </div>
              </div>

              {/* Groq Setup */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                    <Terminal className="w-3 h-3" /> Groq API Key (Optional)
                  </label>
                  <a href="https://console.groq.com/keys" target="_blank" className="text-[10px] text-emerald-500 hover:underline flex items-center gap-1">
                    Get Key <ChevronRight size={10} />
                  </a>
                </div>
                <div className="relative group">
                  <textarea 
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value.trim())}
                    placeholder="gsk_..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all resize-none font-mono"
                  />
                  {groqKey && (
                    <button 
                      onClick={() => handleValidateKey("groq", groqKey)}
                      disabled={validationStatus.groq === "loading"}
                      className="absolute right-3 top-3 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-emerald-500 text-[10px] font-bold uppercase transition-all flex items-center gap-2"
                    >
                      {validationStatus.groq === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                      Validate
                    </button>
                  )}
                </div>
              </div>

              {/* OpenAI Setup */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> OpenAI API Key (Image Gen)
                  </label>
                  <a href="https://platform.openai.com/api-keys" target="_blank" className="text-[10px] text-purple-500 hover:underline flex items-center gap-1">
                    Get Key <ChevronRight size={10} />
                  </a>
                </div>
                <div className="relative group">
                  <textarea 
                    value={openaiKey}
                    onChange={(e) => setOpenAiKey(e.target.value.trim())}
                    placeholder="sk-..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all resize-none font-mono"
                  />
                  {openaiKey && (
                    <button 
                      onClick={() => handleValidateKey("openai", openaiKey)}
                      disabled={validationStatus.openai === "loading"}
                      className="absolute right-3 top-3 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-500 text-[10px] font-bold uppercase transition-all flex items-center gap-2"
                    >
                      {validationStatus.openai === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                      Validate
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <button 
                onClick={handleSaveSettings}
                disabled={!geminiKey || isSavingSettings}
                className="w-full bg-primary text-white rounded-2xl py-4 md:py-5 font-bold text-base hover:opacity-90 transition-all shadow-xl shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Let's Start Ka-Laung
              </button>
              
              <div className="flex items-center justify-center gap-8">
                <button 
                  onClick={logout}
                  className="text-white/30 text-[11px] font-bold uppercase tracking-widest hover:text-rose-500 transition-colors flex items-center gap-2"
                >
                  <LogOut size={12} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex h-screen bg-[#05070a] text-foreground overflow-hidden relative selection:bg-primary/30 selection:text-white transition-colors duration-1000",
        mode === "kalaung" ? "theme-kalaung" : "theme-arindama"
      )}
      style={bgImage ? { 
        backgroundImage: `url(${bgImage})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : {}}
    >
      {bgImage && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-0" />}
      
      {/* Dynamic Background Aura */}
      <div className="aura-container">
        <div className={cn(
          "aura-blob aura-blob-1 transition-all duration-1000",
          mode === "kalaung" ? "opacity-30" : "opacity-10"
        )} style={{ "--aura-color": mode === "kalaung" ? "rgba(139, 92, 246, 0.2)" : "rgba(6, 182, 212, 0.1)" } as any} />
        <div className={cn(
          "aura-blob aura-blob-2 transition-all duration-1000",
          mode === "kalaung" ? "opacity-10" : "opacity-30"
        )} style={{ "--aura-color": mode === "kalaung" ? "rgba(236, 72, 153, 0.1)" : "rgba(34, 211, 238, 0.2)" } as any} />
        <div className="aura-blob aura-blob-3 opacity-5" />
      </div>

      <AnimatePresence mode="wait">
        {showSplash && (
          <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: showSplash ? 0 : 1, scale: showSplash ? 0.95 : 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex h-full w-full overflow-hidden"
        style={{ fontSize: `${fontSize}px` }}
      >
        <CommandPalette 
          onNewChat={handleNewChat}
          onToggleDarkMode={() => {}} // Dark mode is default, can add logic if needed
          onToggleAiMode={() => {
            let newMode: AiMode;
            if (mode === "kalaung") newMode = "arindama";
            else if (mode === "arindama") newMode = "twatgyi";
            else newMode = "kalaung";
            
            handleCharacterSelect(newMode);
            if (newMode !== "arindama") {
              setSidebarTab("chats");
            }
          }}
          onClearHistory={() => setShowClearConfirm(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenGithub={() => {
            setSidebarTab("files");
            setIsSidebarOpen(true);
          }}
          mode={mode}
        />
        <Sidebar 
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onNewProject={handleNewProject}
          onDeleteSession={handleDeleteSession}
          onClearHistory={() => setShowClearConfirm(true)}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          onOpenProfile={() => setShowProfile(true)}
          onOpenSettings={() => setShowSettings(true)}
          userProfile={userProfile}
          mode={mode}
          onModeChange={handleCharacterSelect}
          uiDensity={uiDensity}
          tasks={tasks}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
        />

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {quotaExceeded && (
            <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-3 flex items-center justify-between gap-4 z-20 backdrop-blur-md">
              <div className="flex items-center gap-3 text-rose-500">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider">Firestore Quota Exceeded</span>
                  <span className="text-[11px] opacity-70">ညီမလေးတို့ရဲ့ Database က ဒီနေ့အတွက် အကန့်အသတ် ပြည့်သွားပါပြီရှင်။ Chat history တွေကို မနက်ဖြန်မှ ပြန်သိမ်းပေးနိုင်မှာပါရှင်။</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href="https://console.firebase.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold transition-all"
                >
                  VIEW CONSOLE
                </a>
                <button 
                  onClick={() => setQuotaExceeded(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/20 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {/* Main Workspace Area */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Chat Area */}
            <div className={cn(
              "h-full flex flex-col transition-all duration-500",
              isSplitView ? "w-1/2 border-r border-white/5" : "w-full"
            )}>
              {sidebarTab === 'preview' && !isSplitView ? (
                <LivePreview />
              ) : (
                <ChatInterface 
                  messages={messages} 
                  onMessagesChange={handleMessagesChange} 
                  onOpenSettings={() => setShowSettings(true)}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  isSidebarOpen={isSidebarOpen}
                  onSwitchTab={setSidebarTab}
                  mode={mode}
                  onModeChange={setMode}
                  userProfile={userProfile}
                  quotaExceeded={quotaExceeded}
                  uiDensity={uiDensity}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                  groqApiKey={groqKey}
                  onOpenProfile={() => setShowProfile(true)}
                  deepMemory={deepMemory}
                  onUpdateStats={async (stats) => {
                    if (!user || quotaExceeded) return;
                    const userDocRef = doc(db, "users", user.uid);
                    try {
                      await setDoc(userDocRef, { 
                        stats: {
                          ...userProfile?.stats,
                          ...stats
                        }
                      }, { merge: true });
                    } catch (error) {
                      console.error("Error updating stats:", error);
                    }
                  }}
                />
              )}
            </div>

            {/* Split Preview Area */}
            {isSplitView && (
              <div className="w-1/2 h-full bg-[#050505]">
                <LivePreview isSplit={true} onClose={() => setIsSplitView(false)} />
              </div>
            )}

            {/* Float Toggle for Split View */}
            {mode === "arindama" && !isSplitView && (
              <button 
                onClick={() => setIsSplitView(true)}
                className="absolute bottom-32 right-8 w-14 h-14 bg-primary text-slate-950 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-30 group"
                title="Enable Split View Preview"
              >
                <Layout size={24} className="group-hover:rotate-12 transition-transform" />
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                  Live
                </div>
              </button>
            )}
          </div>

          {showSettings && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div 
                className="w-full max-w-2xl glass-panel rounded-[32px] shadow-2xl my-8 overflow-hidden"
                style={{ padding: `${uiDensity * 1.5}px` }}
              >
                <div 
                  className="flex items-center justify-between"
                  style={{ marginBottom: `${uiDensity * 1.5}px` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Settings className="text-primary w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white">Advanced Configuration</h2>
                  </div>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="p-2 hover:bg-white/5 rounded-full text-white/40 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                          <Key className="w-3 h-3" /> Gemini API Key
                        </label>
                        {validationStatus.google !== "idle" && (
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                            validationStatus.google === "success" ? "bg-emerald-500/10 text-emerald-500" : 
                            validationStatus.google === "error" ? "bg-rose-500/10 text-rose-500" : "bg-white/5 text-white/30"
                          )}>
                            {validationStatus.google}
                          </span>
                        )}
                      </div>
                      <div className="relative group">
                        <textarea 
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value.trim())}
                          placeholder="AIzaSy..."
                          autoComplete="off"
                          spellCheck={false}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none font-mono"
                        />
                        <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {geminiKey && (
                            <button 
                              onClick={() => handleValidateKey("google", geminiKey)}
                              disabled={validationStatus.google === "loading"}
                              className="p-2 bg-primary/20 hover:bg-primary/30 rounded-xl text-primary transition-all text-[10px] font-bold uppercase flex items-center gap-1.5"
                            >
                              {validationStatus.google === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Validate
                            </button>
                          )}
                          {geminiKey && (
                            <button 
                              onClick={() => setGeminiKey("")}
                              className="p-2 hover:bg-white/10 rounded-xl text-white/20 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                        <Cpu className="w-3 h-3" /> Preferred Gemini Model
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                        >
                          <optgroup label="GEMINI MODELS" className="bg-[#161616] text-white/50">
                            {PREFERRED_MODELS.map((m) => (
                              <option key={m} value={m} className="bg-[#161616] text-white">
                                {m.replace("models/", "").toUpperCase()}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="GROQ MODELS" className="bg-[#161616] text-white/50">
                            {GROQ_MODELS.map((m) => (
                              <option key={m} value={m} className="bg-[#161616] text-white">
                                {m.toUpperCase()}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="OPENROUTER MODELS" className="bg-[#161616] text-white/50">
                            {OPENROUTER_MODELS.map((m) => (
                              <option key={m} value={m} className="bg-[#161616] text-white">
                                {m.toUpperCase()}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                          <ChevronRight className="rotate-90 w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-[9px] text-white/20 uppercase tracking-widest px-1">
                        {selectedModel.includes('3.1') ? '🧠 Precision & Intelligence (Advanced Tasks)' : selectedModel.includes('2.0') ? '⚡ Real-time & High Performance' : selectedModel.includes('llama') ? '🚀 Groq Acceleration' : '✨ Standard Generation'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                          <Terminal className="w-3 h-3" /> Groq API Key
                        </label>
                        {validationStatus.groq !== "idle" && (
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                            validationStatus.groq === "success" ? "bg-emerald-500/10 text-emerald-500" : 
                            validationStatus.groq === "error" ? "bg-rose-500/10 text-rose-500" : "bg-white/5 text-white/30"
                          )}>
                            {validationStatus.groq}
                          </span>
                        )}
                      </div>
                      <div className="relative group">
                        <textarea 
                          value={groqKey}
                          onChange={(e) => setGroqKey(e.target.value.trim())}
                          placeholder="gsk_..."
                          autoComplete="off"
                          spellCheck={false}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none font-mono"
                        />
                        <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {groqKey && (
                            <button 
                              onClick={() => handleValidateKey("groq", groqKey)}
                              disabled={validationStatus.groq === "loading"}
                              className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-emerald-500 transition-all text-[10px] font-bold uppercase flex items-center gap-1.5"
                            >
                              {validationStatus.groq === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Validate
                            </button>
                          )}
                          {groqKey && (
                            <button 
                              onClick={() => setGroqKey("")}
                              className="p-2 hover:bg-white/10 rounded-xl text-white/20 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                          <Globe className="w-3 h-3" /> OpenRouter API Key
                        </label>
                        {validationStatus.openrouter !== "idle" && (
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                            validationStatus.openrouter === "success" ? "bg-cyan-500/10 text-cyan-500" : 
                            validationStatus.openrouter === "error" ? "bg-rose-500/10 text-rose-500" : "bg-white/5 text-white/30"
                          )}>
                            {validationStatus.openrouter}
                          </span>
                        )}
                      </div>
                      <div className="relative group">
                        <textarea 
                          value={openRouterKey}
                          onChange={(e) => setOpenRouterKey(e.target.value.trim())}
                          placeholder="sk-or-v1-..."
                          autoComplete="off"
                          spellCheck={false}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none font-mono"
                        />
                        <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {openRouterKey && (
                            <button 
                              onClick={() => handleValidateKey("openrouter", openRouterKey)}
                              disabled={validationStatus.openrouter === "loading"}
                              className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl text-cyan-500 transition-all text-[10px] font-bold uppercase flex items-center gap-1.5"
                            >
                              {validationStatus.openrouter === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Validate
                            </button>
                          )}
                          {openRouterKey && (
                            <button 
                              onClick={() => setOpenRouterKey("")}
                              className="p-2 hover:bg-white/10 rounded-xl text-white/20 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                          <ImageIcon className="w-3 h-3" /> OpenAI API Key
                        </label>
                        {validationStatus.openai !== "idle" && (
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                            validationStatus.openai === "success" ? "bg-emerald-500/10 text-emerald-500" : 
                            validationStatus.openai === "error" ? "bg-rose-500/10 text-rose-500" : "bg-white/5 text-white/30"
                          )}>
                            {validationStatus.openai}
                          </span>
                        )}
                      </div>
                      <div className="relative group">
                        <textarea 
                          value={openaiKey}
                          onChange={(e) => setOpenAiKey(e.target.value.trim())}
                          placeholder="sk-..."
                          autoComplete="off"
                          spellCheck={false}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none font-mono"
                        />
                        <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {openaiKey && (
                            <button 
                              onClick={() => handleValidateKey("openai", openaiKey)}
                              disabled={validationStatus.openai === "loading"}
                              className="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-purple-500 transition-all text-[10px] font-bold uppercase flex items-center gap-1.5"
                            >
                              {validationStatus.openai === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Validate
                            </button>
                          )}
                          {openaiKey && (
                            <button 
                              onClick={() => setOpenAiKey("")}
                              className="p-2 hover:bg-white/10 rounded-xl text-white/20 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {mode === "arindama" && (
                      <div className="space-y-3">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                          <Github className="w-3 h-3" /> GitHub Token
                        </label>
                        <div className="relative">
                          <textarea 
                            value={githubToken}
                            onChange={(e) => setGithubTokenState(e.target.value.trim())}
                            placeholder="ghp_..."
                            autoComplete="off"
                            spellCheck={false}
                            rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none font-mono"
                          />
                          {githubToken && (
                            <button 
                              onClick={() => setGithubTokenState("")}
                              className="absolute right-3 top-3 p-2 hover:bg-white/10 rounded-xl text-white/20 hover:text-white transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                        <Type className="w-3 h-3" /> App Font Size ({fontSize}px)
                      </label>
                      <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 md:py-3.5">
                        <span className="text-xs text-white/30 italic">Small</span>
                        <input 
                          type="range"
                          min="12"
                          max="24"
                          step="1"
                          value={fontSize}
                          onChange={(e) => setFontSizeState(parseInt(e.target.value, 10))}
                          className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-lg text-white font-bold">Large</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                        <Maximize className="w-3 h-3" /> Message Density ({uiDensity}px)
                      </label>
                      <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 md:py-3.5">
                        <span className="text-xs text-white/30 italic">Tight</span>
                        <input 
                          type="range"
                          min="4"
                          max="40"
                          step="2"
                          value={uiDensity}
                          onChange={(e) => setUiDensityState(parseInt(e.target.value, 10))}
                          className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-xs text-white/30 italic">Spacious</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                        <Database className="w-3 h-3" /> Knowledge Base
                      </label>
                      <textarea 
                        value={knowledgeBase}
                        onChange={(e) => setKnowledgeBaseState(e.target.value)}
                        placeholder={`Add custom knowledge for ${mode === 'kalaung' ? 'Ka-Laung' : 'Arindama'} to remember...`}
                        className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Evolution Directives
                      </label>
                      <textarea 
                        value={evolutionDirectives}
                        onChange={(e) => setEvolutionDirectivesState(e.target.value)}
                        placeholder={`How should ${mode === 'kalaung' ? 'Ka-Laung' : 'Arindama'} evolve or behave?`}
                        className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-primary/20 mt-8 flex items-center justify-center gap-2"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : saveSettingsSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved Successfully
                    </>
                  ) : (
                    "Save All Configurations"
                  )}
                </button>
              </div>
            </div>
          )}

          {showClearConfirm && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-[#161616] border border-white/10 rounded-[32px] p-8 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6 mx-auto">
                  <Trash2 className="text-rose-500 w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white text-center mb-2">Clear All History?</h2>
                <p className="text-sm text-white/40 text-center mb-8">
                  Chat history အားလုံးကို ဖျက်ပစ်မှာ သေချာပါသလားရှင်? ဒီလုပ်ဆောင်ချက်ကို ပြန်ပြင်လို့ မရနိုင်ပါဘူးရှင်။
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-6 py-4 rounded-2xl bg-white/5 text-white/60 font-bold hover:bg-white/10 transition-all"
                  >
                    မဖျက်တော့ပါ
                  </button>
                  <button 
                    onClick={handleClearHistory}
                    className="flex-1 px-6 py-4 rounded-2xl bg-rose-500 text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-rose-500/20"
                  >
                    ဖျက်မည်
                  </button>
                </div>
              </div>
            </div>
          )}

          {showProfile && user && (
            <div className="absolute inset-0 z-[70] bg-[#0c0c0c]">
              <ProfilePage 
                user={user}
                userProfile={userProfile}
                onBack={() => setShowProfile(false)}
                onUpdateProfile={async (data) => {
                  if (quotaExceeded) {
                    alert("Quota ပြည့်သွားတဲ့အတွက် Cloud ပေါ်မှာ Update လုပ်လို့မရသေးပါဘူးရှင်။");
                    return;
                  }
                  const userDocRef = doc(db, "users", user.uid);
                  const updatedProfile = {
                    ...userProfile,
                    ...data,
                    updatedAt: new Date().toISOString()
                  };
                  try {
                    await setDoc(userDocRef, updatedProfile);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
                  }
                }}
              />
            </div>
          )}
        </main>
        <LiveChat />
      </motion.div>
    </div>
  );
}
