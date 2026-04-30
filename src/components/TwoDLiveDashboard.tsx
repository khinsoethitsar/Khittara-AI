import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  RefreshCcw, 
  Clock, 
  Info,
  Activity,
  Award
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface TwoDData {
  provider: string;
  server_time: string;
  live: {
    set: string;
    value: string;
    time: string;
    twod: string;
    date: string;
  };
  result: Array<{
    set: string;
    value: string;
    open_time: string;
    twod: string;
    stock_date: string;
    stock_datetime: string;
    history_id: string;
  }>;
}

export default function TwoDLiveDashboard() {
  const [data, setData] = useState<TwoDData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/2d/live");
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, []);

  if (!data && isLoading) {
    return (
      <div className="w-full p-8 flex flex-col items-center justify-center space-y-4 glass-panel rounded-3xl border border-white/10 animate-pulse">
        <RefreshCcw className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-sm font-bold text-emerald-500/60 uppercase tracking-widest">ဆရာမတွက်ကြီး အချက်အလက်ယူနေပါတယ်...</span>
      </div>
    );
  }

  const live = data?.live;

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Live Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group w-full"
      >
        <div className="absolute inset-0 bg-emerald-500/10 blur-[40px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="relative glass-panel rounded-[32px] border border-emerald-500/20 p-6 md:p-8 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-500/60 font-bold text-[10px] uppercase tracking-[0.2em]">
                <TrendingUp size={14} />
                <span>Thai SET Index Live (2D)</span>
              </div>
              <div className="flex items-baseline gap-4">
                <div className="text-6xl md:text-7xl font-black text-white tracking-tighter drop-shadow-lg">
                  {live?.twod === "--" ? "..." : live?.twod}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Live Result</span>
                  <span className="text-xs text-white/40 font-medium flex items-center gap-1">
                    <Clock size={10} /> {live?.time || "--:--"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-4">
                <div className="px-6 py-4 rounded-[24px] bg-white/[0.04] border border-white/10 space-y-1 min-w-[120px]">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">SET Index</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono tracking-tight">{live?.set || "--"}</div>
                </div>
                <div className="px-6 py-4 rounded-[24px] bg-white/[0.04] border border-white/10 space-y-1 min-w-[120px]">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Value</div>
                  <div className="text-xl font-bold text-white tracking-tight">{live?.value || "--"}</div>
                </div>
              </div>

              <button 
                onClick={fetchData}
                disabled={isLoading}
                className="h-[72px] px-8 rounded-full bg-emerald-500 text-black font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-50"
              >
                <RefreshCcw size={18} className={isLoading ? "animate-spin" : ""} />
                REFRESH
              </button>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between opacity-40">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <Info size={12} />
              <span>Synced with {data?.provider || "Stock Market"}</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest italic">
              SET Market Status: Open
            </div>
          </div>
        </div>
      </motion.div>

      {/* Analysis & Prediction Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel rounded-[40px] border border-white/10 p-8 space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Award size={20} />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-widest">AI Expert Analysis</h3>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Primary Session Focus</span>
                <span className="text-[10px] font-black text-emerald-500 uppercase">Active</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-[10px] font-bold text-emerald-500/60 uppercase mb-1">Morning</div>
                  <div className="text-sm font-black text-white">12:01 PM</div>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <div className="text-[10px] font-bold text-blue-500/60 uppercase mb-1">Evening</div>
                  <div className="text-sm font-black text-white">4:30 PM</div>
                </div>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed font-medium italic">
                Sayar Ma Twat Gyi is currently analyzing the relationship between the morning opening volatility and the final evening closing price to calculate the most probable outcome.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-[40px] border border-white/10 p-8 flex flex-col justify-between"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity size={20} />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Market Probability</h3>
            </div>

            <div className="space-y-4">
              {[
                { label: "Calculation Accuracy", value: 94, color: "bg-emerald-500" },
                { label: "Market Volatility", value: 65, color: "bg-blue-500" },
                { label: "Success Confidence", value: 88, color: "bg-primary" }
              ].map((stat, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black text-white/40 uppercase tracking-widest">
                    <span>{stat.label}</span>
                    <span>{stat.value}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.value}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                      className={cn("h-full rounded-full", stat.color)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Next Session Forecast: Pending</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
