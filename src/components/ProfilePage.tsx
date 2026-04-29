import { useState, useEffect } from "react";
import { User, db, doc, getDoc, setDoc, auth } from "../lib/firebase";
import { motion } from "motion/react";
import { User as UserIcon, Camera, Save, ArrowLeft, Loader2, CheckCircle2, Sparkles, ShieldCheck, MapPin, Info, MessageCircle, Calendar } from "lucide-react";
import { cn } from "../lib/utils";
import { CHARACTERS } from "../lib/characters";

interface ProfilePageProps {
  user: User;
  userProfile: any;
  onBack: () => void;
  onUpdateProfile: (data: any) => Promise<void>;
}

export default function ProfilePage({ user, userProfile, onBack, onUpdateProfile }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState(userProfile?.displayName || user.displayName || "");
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || user.photoURL || "");
  const [characterId, setCharacterId] = useState(userProfile?.character || "kalaung");
  const [bio, setBio] = useState(userProfile?.bio || "");
  const [location, setLocation] = useState(userProfile?.location || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setPhotoURL(userProfile.photoURL || "");
      setCharacterId(userProfile.character || "kalaung");
      setBio(userProfile.bio || "");
      setLocation(userProfile.location || "");
    }
  }, [userProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateProfile({
        displayName: displayName || "Anonymous",
        photoURL: photoURL || "",
        character: characterId,
        bio,
        location
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0c0c0c] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#161616]/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/40 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">User Profile</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
            saveSuccess 
              ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/20" 
              : "bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/20"
          )}
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-12">
        <div className="max-w-2xl mx-auto space-y-12">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[40px] bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={48} className="text-white/10" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[40px] cursor-pointer">
                <Camera size={24} className="text-white" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-1">{displayName || "Anonymous User"}</h2>
              <p className="text-sm text-white/20 font-mono tracking-wider uppercase">{user.email}</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="space-y-8">
            <div className="grid gap-6">
              <div className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">Active Character</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CHARACTERS.map((char) => (
                    <div 
                      key={char.id}
                      onClick={() => setCharacterId(char.id)}
                      className={cn(
                        "relative p-4 rounded-3xl border transition-all cursor-pointer group overflow-hidden",
                        characterId === char.id 
                          ? "bg-white/10 border-white/20 ring-1 ring-white/10" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/10"
                      )}
                    >
                      {/* Character Background Glow */}
                      <div 
                        className={cn(
                          "absolute -right-4 -bottom-4 w-24 h-24 blur-[40px] opacity-0 transition-opacity duration-500",
                          characterId === char.id ? "opacity-20" : "group-hover:opacity-10"
                        )}
                        style={{ backgroundColor: char.color }}
                      />
                      
                      <div className="flex items-center gap-4 relative z-10">
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/5"
                          style={{ background: `linear-gradient(135deg, ${char.color}20, ${char.secondaryColor}20)` }}
                        >
                          {char.gender === 'male' ? (
                            <UserIcon size={20} style={{ color: char.color }} />
                          ) : (
                            <Sparkles size={20} style={{ color: char.color }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{char.myanmarName}</h4>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{char.name}</p>
                        </div>
                        {characterId === char.id && (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                            <ShieldCheck size={14} />
                          </div>
                        )}
                      </div>
                      
                      {characterId === char.id && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="text-[11px] text-white/50 mt-4 leading-relaxed line-clamp-2 italic"
                        >
                          {char.description}
                        </motion.p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">Display Name</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">About Me</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell something about yourself..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10 resize-none"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">Location</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Yangon, Myanmar"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">Avatar URL</label>
                <input 
                  type="text"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10 font-mono"
                />
                <p className="text-[10px] text-white/20 ml-1 leading-relaxed">
                  Provide a direct link to an image. We recommend using a high-quality square image.
                </p>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <MessageCircle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Messages</span>
                </div>
                <div className="text-lg font-bold text-white">
                  {userProfile?.stats?.messages || 0}
                </div>
              </div>
              <div className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Calendar size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Joined</span>
                </div>
                <div className="text-sm font-bold text-white">
                  {userProfile?.updatedAt ? new Date(userProfile.updatedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : "N/A"}
                </div>
              </div>
              <div className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-2 text-neon-violet">
                  <Sparkles size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Level</span>
                </div>
                <div className="text-lg font-bold text-white">
                  {Math.floor((userProfile?.stats?.messages || 0) / 10) + 1}
                </div>
              </div>
              <div className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-2 text-yellow-500">
                  <Info size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Status</span>
                </div>
                <div className="text-sm font-bold text-white truncate">
                  Pro Beta
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-[32px] bg-primary/5 border border-primary/20 space-y-4">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
              <Sparkles size={16} />
              About Khittara AI Profile
            </h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Your profile helps personalize your experience across Khittara AI. The selected character will be your default companion in new chats. Stats are updated in real-time as you interact with the assistant.
            </p>
          </div>

          {/* Danger Zone */}
          <div className="pt-12 border-t border-white/5">
            <div className="p-8 rounded-[32px] bg-rose-500/5 border border-rose-500/10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h3 className="text-lg font-bold text-rose-500 mb-1">Account Management</h3>
                <p className="text-sm text-rose-500/40">Signing out will end your current session on this device.</p>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="px-8 py-3 rounded-2xl bg-rose-500 text-white font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-rose-500/20 whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
