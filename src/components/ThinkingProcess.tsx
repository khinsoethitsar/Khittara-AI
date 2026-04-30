import { motion } from "motion/react";
import { CheckCircle2, Circle, Loader2, AlertCircle, Search, Brain, Zap, Cpu, ShieldCheck, Rocket } from "lucide-react";
import { ThinkingStep, AiMode } from "../lib/gemini";
import { cn } from "../lib/utils";

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isActive: boolean;
  mode?: AiMode;
}

export default function ThinkingProcess({ steps, isActive, mode = "kalaung" }: ThinkingProcessProps) {
  const isArindama = mode === "arindama";

  return (
    <div className={cn(
      "space-y-4 p-5 rounded-3xl relative overflow-hidden group transition-all duration-500",
      isArindama 
        ? "bg-primary/5 border border-primary/20 shadow-lg shadow-primary/5" 
        : "bg-white/[0.02] border border-white/5"
    )}>
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700",
        isArindama ? "from-primary/10 to-transparent" : "from-white/5 to-transparent"
      )} />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-2xl flex items-center justify-center transition-all duration-500",
            isArindama ? "bg-primary/20 text-primary animate-pulse" : "bg-white/5 text-white/40"
          )}>
            {isArindama ? <Cpu className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              {isArindama ? "Strategic Computation" : "Kalaung is thinking"}
            </div>
            {isArindama && (
              <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest mt-0.5">
                100-Step Foresight Active
              </div>
            )}
          </div>
        </div>
        {isActive && (
          <div className="flex gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-bounce", isArindama ? "bg-primary" : "bg-white/40")} />
            <div className={cn("w-1.5 h-1.5 rounded-full animate-bounce delay-150", isArindama ? "bg-primary" : "bg-white/40")} />
            <div className={cn("w-1.5 h-1.5 rounded-full animate-bounce delay-300", isArindama ? "bg-primary" : "bg-white/40")} />
          </div>
        )}
      </div>

      <div className="space-y-3.5 relative z-10 pl-1">
        {steps.map((step, idx) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex items-center gap-4 group/step"
          >
            <div className="shrink-0 flex items-center justify-center w-6 h-6">
              {step.status === "done" ? (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shadow-lg",
                    isArindama ? "bg-primary/20 text-primary" : "bg-emerald-500/20 text-emerald-500"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </motion.div>
              ) : step.status === "active" ? (
                <div className="relative">
                  <div className={cn("absolute inset-0 blur-md animate-pulse", isArindama ? "bg-primary/50" : "bg-white/20")} />
                  <Loader2 className={cn("w-5 h-5 animate-spin relative z-10", isArindama ? "text-primary" : "text-white/60")} />
                </div>
              ) : step.status === "error" ? (
                <AlertCircle className="w-5 h-5 text-rose-500" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-white/10 group-hover/step:bg-white/30 transition-colors" />
              )}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-[13px] tracking-tight transition-all duration-300",
                step.status === "active" ? "text-white font-bold scale-105 origin-left" : "text-white/40 font-medium"
              )}>
                {step.label}
              </span>
              {step.status === "active" && isArindama && (
                <span className="text-[9px] text-primary/40 uppercase tracking-widest font-black mt-0.5 animate-pulse">
                  Analyzing architecture...
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {isArindama && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3" />
            <span>Security Audited</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-widest">
            <Rocket className="w-3 h-3" />
            <span>High Fidelity</span>
          </div>
        </div>
      )}
    </div>
  );
}
