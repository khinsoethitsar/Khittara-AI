import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  limit
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { MessageCircle, X, Send, User, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  senderName: string;
  createdAt: any;
}

const LiveChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for messages
  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, "live_chat"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      // Reverse to show oldest first at top, newest at bottom
      setMessages(msgs.reverse());
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;

    setIsLoading(true);
    try {
      await addDoc(collection(db, "live_chat"), {
        message: message.trim(),
        senderId: user.uid,
        senderName: user.displayName || "User",
        createdAt: serverTimestamp(),
      });
      setMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      if (error.message?.includes("insufficient permissions")) {
        alert("အစ်ကို MinThitSarAung ရှင့်၊ Live Chat အတွက် Firebase Rules တွေကို Console မှာ Update လုပ်ပေးဖို့ လိုနေပါသေးတယ်ရှင်။ ✨💖🔐");
      } else {
        alert("စာပို့လို့ မရဖြစ်နေပါတယ်ရှင်။ ခဏနေမှ ပြန်စမ်းကြည့်ပေးပါဦးနော်။ ✨💖");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] md:w-[400px] h-[500px] glass-panel rounded-[32px] border border-white/10 shadow-2xl flex flex-col overflow-hidden bg-[#0A0A0B]/90 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-primary/10 to-neon-violet/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20 neon-glow-cyan">
                  <MessageCircle className="text-primary w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Khittara Live Chat</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Online Community</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all shadow-inner"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                  <MessageCircle size={48} className="text-white/20" />
                  <p className="text-xs text-white">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      msg.senderId === user?.uid ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-white/30 font-medium">
                        {msg.senderId === user?.uid ? "You" : msg.senderName}
                      </span>
                    </div>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.senderId === user?.uid 
                        ? "bg-primary/20 text-white border border-primary/20 rounded-tr-none shadow-lg shadow-primary/5" 
                        : "bg-white/5 text-white/80 border border-white/5 rounded-tl-none pr-6"
                    )}>
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Area */}
            <form 
              onSubmit={handleSendMessage}
              className="p-4 border-t border-white/5 bg-white/[0.02]"
            >
              {!user ? (
                <div className="text-center py-2">
                  <p className="text-[11px] text-white/40">Please sign in to join the chat</p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/20"
                  />
                  <button 
                    type="submit"
                    disabled={isLoading || !message.trim()}
                    className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-30 flex-shrink-0"
                  >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bubble Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-[24px] flex items-center justify-center shadow-2xl transition-all relative group overflow-hidden",
          isOpen 
            ? "bg-[#161616] text-primary border border-primary/30" 
            : "bg-primary text-white"
        )}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-primary opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
        
        {isOpen ? <X size={24} className="relative z-10" /> : <MessageCircle size={24} className="relative z-10" />}
        
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#0A0A0B] animate-bounce" />
        )}
      </motion.button>
    </div>
  );
};

export default LiveChat;
