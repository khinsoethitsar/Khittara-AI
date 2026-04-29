import { useState } from "react";
import { 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Calendar, 
  Clock, 
  Plus, 
  X,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../lib/store";
import { cn } from "../lib/utils";

interface TasksListProps {
  tasks: Task[];
  onAddTask: (title: string, dueDate?: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  uiDensity?: number;
}

export default function TasksList({ tasks, onAddTask, onToggleTask, onDeleteTask, uiDensity = 16 }: TasksListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    let dueDateStr = undefined;
    if (newTaskDate) {
      dueDateStr = new Date(`${newTaskDate}T${newTaskTime || "00:00"}`).toISOString();
    }

    onAddTask(newTaskTitle, dueDateStr);
    setNewTaskTitle("");
    setNewTaskDate("");
    setNewTaskTime("");
    setShowAddForm(false);
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.completed) return false;
    return new Date(task.dueDate) < new Date();
  };

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('my-MM', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Tasks & Goals
        </h3>
        <button 
          onClick={() => setShowAddForm(true)}
          className="p-1.5 bg-primary/20 hover:bg-primary/30 rounded-lg text-primary transition-all"
        >
          <Plus size={14} />
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="mb-6 space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">New Task</span>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-white/20 hover:text-white">
                <X size={14} />
              </button>
            </div>
            
            <input 
              type="text"
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done? ✨"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input 
                  type="date"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
                />
              </div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input 
                  type="time"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-primary text-white text-xs font-bold py-2.5 rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 transition-all"
            >
              ADD TASK
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-20">
            <CheckCircle2 size={40} className="mb-4" />
            <p className="text-xs font-medium uppercase tracking-widest">No tasks active</p>
          </div>
        ) : (
          tasks.map((task) => (
            <motion.div 
              key={task.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "group flex items-start gap-3 p-3 rounded-2xl border transition-all",
                task.completed 
                  ? "bg-white/[0.01] border-white/5 opacity-50" 
                  : cn(
                      "bg-white/[0.03] border-white/10 hover:border-white/20",
                      isOverdue(task) && "border-rose-500/30 bg-rose-500/5"
                    )
              )}
            >
              <button 
                onClick={() => onToggleTask(task.id)}
                className="mt-0.5 shrink-0 transition-transform hover:scale-110 active:scale-95"
              >
                <div className="relative w-5 h-5">
                  <AnimatePresence mode="wait">
                    {task.completed ? (
                      <motion.div
                        key="completed"
                        initial={{ scale: 0, rotate: -45, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, rotate: 45, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className="absolute inset-0"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="active"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="absolute inset-0"
                      >
                        <Circle className={cn(
                          "w-5 h-5",
                          isOverdue(task) ? "text-rose-500/50" : "text-white/20"
                        )} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
              
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-sm font-medium transition-all break-words",
                  task.completed ? "line-through text-white/40" : "text-white/80"
                )}>
                  {task.title}
                </div>
                
                {task.dueDate && (
                  <div className={cn(
                    "flex items-center gap-1.5 mt-1 text-[10px] font-bold uppercase tracking-wider",
                    isOverdue(task) ? "text-rose-500" : "text-white/20"
                  )}>
                    {isOverdue(task) ? <AlertCircle size={10} /> : <Clock size={10} />}
                    <span>{formatDueDate(task.dueDate)}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => onDeleteTask(task.id)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 rounded-lg text-white/20 hover:text-rose-500 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
