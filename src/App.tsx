import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  Calendar, 
  History, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Check, 
  Video, 
  Weight, 
  ArrowRight, 
  X, 
  LogOut, 
  Trash2, 
  RefreshCw,
  TrendingUp,
  User,
  Info,
  Table
} from 'lucide-react';
import { ROUTINE_DATA, PROFILE_IMAGES, EXERCISES_SHEET_URL } from './constants';
import { Day, Exercise, WorkoutSession } from './types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Components ---

const ProfessionalFooter = () => (
  <div className="w-full py-8 text-center space-y-2 opacity-50">
    <div className="h-[1px] w-12 bg-zinc-800 mx-auto mb-4" />
    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
      Desarrollada por <span className="text-zinc-300">Marcos Nieto</span>
    </p>
    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.15em]">
      Propuestos por <span className="text-zinc-400">Roberto Bosqued</span>
    </p>
  </div>
);

const WeightInput = ({ 
  exerciseId, 
  setIndex, 
  value, 
  onSave 
}: { 
  exerciseId: string; 
  setIndex: number; 
  value: string; 
  onSave: (val: string) => void 
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="flex gap-3 w-full items-center">
      <div className="relative flex-1">
        <input 
          type="number" 
          step="0.1" 
          inputMode="decimal"
          value={localValue} 
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onSave(localValue)}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xl sm:text-2xl font-black text-white focus:outline-none focus:border-brand/50 transition-all placeholder:text-zinc-800" 
          placeholder="0.0" 
        />
        <span className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-widest">kg</span>
      </div>
      <button 
        onClick={() => onSave(localValue)}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${localValue === value && value !== '' ? 'bg-brand text-black shadow-lg shadow-brand/20' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'}`}
      >
        <Check size={18} className={localValue === value && value !== '' ? 'stroke-[4px]' : 'stroke-[2px]'} />
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeProfile, setActiveProfile] = useState<string | null>(localStorage.getItem('gym_profile'));
  const [view, setView] = useState<'home' | 'workout' | 'history' | 'progress'>('home');
  const [activeDay, setActiveDay] = useState<Day | null>(null);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>(() => {
    const saved = localStorage.getItem('gym_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentWeights, setCurrentWeights] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('gym_weights');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem('gym_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('gym_weights', JSON.stringify(currentWeights));
  }, [currentWeights]);

  const handleSelectProfile = (name: string) => {
    setActiveProfile(name);
    localStorage.setItem('gym_profile', name);
  };

  const handleLogout = () => {
    setActiveProfile(null);
    localStorage.removeItem('gym_profile');
  };

  const handleStartWorkout = (day: Day) => {
    setActiveDay(day);
    setView('workout');
  };

  const handleFinishWorkout = (session: WorkoutSession) => {
    setHistory(prev => [session, ...prev]);
    setView('home');
    setActiveDay(null);
  };

  const handleSavePersistentWeight = (exerciseId: string, setIndex: number, weight: string) => {
    setCurrentWeights(prev => {
      const exerciseSets = prev[exerciseId] || [];
      const newSets = [...exerciseSets];
      // Ensure the array is long enough
      while (newSets.length <= setIndex) newSets.push('');
      newSets[setIndex] = weight;
      return { ...prev, [exerciseId]: newSets };
    });
  };

  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-brand rounded-[2.5rem] mb-8 shadow-2xl shadow-brand/20">
            <Dumbbell size={48} className="text-black" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2 italic">GymTrainer<span className="text-brand">PRO</span></h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mb-16">Performance Tracking</p>
          
          <div className="grid grid-cols-2 gap-4">
            {Object.keys(PROFILE_IMAGES).map(name => (
              <button 
                key={name} 
                onClick={() => handleSelectProfile(name)}
                className="group relative overflow-hidden bg-surface border border-border p-8 rounded-[2.5rem] flex flex-col items-center gap-4 active:scale-95 transition-all hover:border-brand/30"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-transparent group-hover:border-brand/50 transition-all">
                  <img src={PROFILE_IMAGES[name as keyof typeof PROFILE_IMAGES]} alt={name} className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-black text-white tracking-tight">{name}</span>
              </button>
            ))}
          </div>
          
          <ProfessionalFooter />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center overflow-x-hidden">
      <div className="w-full max-w-md min-h-screen flex flex-col relative">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <HomeView 
              key="home"
              profile={activeProfile}
              history={history}
              onStartWorkout={handleStartWorkout}
              onNavigate={setView}
              onLogout={handleLogout}
            />
          )}
          {view === 'workout' && activeDay && (
            <WorkoutView 
              key="workout"
              day={activeDay}
              profile={activeProfile}
              initialWeights={currentWeights}
              onSaveWeight={handleSavePersistentWeight}
              onFinish={handleFinishWorkout}
              onBack={() => setView('home')}
            />
          )}
          {view === 'history' && (
            <HistoryView 
              key="history"
              history={history}
              onBack={() => setView('home')}
              onDelete={(id) => setHistory(prev => prev.filter(s => s.id !== id))}
            />
          )}
          {view === 'progress' && (
            <ProgressView 
              key="progress"
              history={history}
              profile={activeProfile}
              onBack={() => setView('home')}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Views ---

function HomeView({ 
  profile, 
  history, 
  onStartWorkout, 
  onNavigate,
  onLogout
}: { 
  profile: string; 
  history: WorkoutSession[]; 
  onStartWorkout: (day: Day) => void;
  onNavigate: (view: any) => void;
  onLogout: () => void;
  key?: string;
}) {
  const lastSession = history.find(s => s.userName === profile);
  const sessionCount = history.filter(s => s.userName === profile).length;
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col p-6 pt-12"
    >
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-border shadow-2xl">
              <img src={PROFILE_IMAGES[profile as keyof typeof PROFILE_IMAGES]} alt={profile} className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand rounded-full border-2 border-bg flex items-center justify-center">
              <Check size={10} className="text-black stroke-[4px]" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">{profile}</h1>
            <p className="text-zinc-500 text-[9px] font-black tracking-[0.2em] uppercase mt-1">{ROUTINE_DATA.nombre}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-10 h-10 bg-surface border border-border rounded-xl flex items-center justify-center text-zinc-600 active:scale-90 transition-all">
          <LogOut size={18} />
        </button>
      </header>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-6 grid-rows-2 gap-3 mb-10 h-48">
        <div className="col-span-3 row-span-1 bg-surface border border-border rounded-3xl p-5 flex flex-col justify-between">
          <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center text-brand"><Calendar size={16} /></div>
          <div>
            <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Último</p>
            <p className="text-sm font-black text-zinc-100 italic">{lastSession ? format(new Date(lastSession.date), 'dd MMM', { locale: es }) : '--'}</p>
          </div>
        </div>
        
        <div className="col-span-3 row-span-1 bg-surface border border-border rounded-3xl p-5 flex flex-col justify-between">
          <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center text-brand"><TrendingUp size={16} /></div>
          <div>
            <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Sesiones</p>
            <p className="text-sm font-black text-zinc-100 italic">{sessionCount}</p>
          </div>
        </div>

        <button 
          onClick={() => onNavigate('progress')}
          className="col-span-2 row-span-1 bg-brand text-black rounded-3xl p-5 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-brand/10"
        >
          <TrendingUp size={20} className="stroke-[3px]" />
          <span className="text-[8px] font-black uppercase tracking-widest">Stats</span>
        </button>

        <button 
          onClick={() => onNavigate('history')}
          className="col-span-2 row-span-1 bg-surface border border-border rounded-3xl p-5 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <History size={20} className="text-zinc-400" />
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Log</span>
        </button>

        <a 
          href={EXERCISES_SHEET_URL} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="col-span-2 row-span-1 bg-surface border border-border rounded-3xl p-5 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all hover:border-brand/30"
        >
          <Table size={20} className="text-zinc-400" />
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Sheet</span>
        </a>
      </div>

      <div className="space-y-3 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Entrenamientos</h2>
          <div className="h-[1px] flex-1 bg-zinc-900 ml-4" />
        </div>
        
        {ROUTINE_DATA.dias.map(day => (
          <button 
            key={day.dia} 
            onClick={() => onStartWorkout(day)}
            className="w-full bg-surface/40 border border-border rounded-[2rem] p-5 text-left flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-surface/60 hover:border-brand/20"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-zinc-900 border border-border rounded-2xl flex items-center justify-center text-zinc-700 group-hover:text-brand group-hover:border-brand/30 transition-all">
                <span className="text-lg font-black italic">{day.dia}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-brand transition-colors italic tracking-tight">{day.nombre.split('–')[1] || day.nombre}</h3>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">{day.ejercicios.length} ejercicios • {day.ejercicios.reduce((acc, ex) => acc + ex.series, 0)} series</p>
              </div>
            </div>
            <div className="w-8 h-8 flex items-center justify-center text-zinc-800 group-hover:text-brand transition-all">
              <ChevronRight size={20} />
            </div>
          </button>
        ))}
      </div>

      <ProfessionalFooter />
    </motion.div>
  );
}

function WorkoutView({ 
  day, 
  profile, 
  initialWeights,
  onSaveWeight,
  onFinish, 
  onBack 
}: { 
  day: Day; 
  profile: string; 
  initialWeights: Record<string, string[]>;
  onSaveWeight: (id: string, setIndex: number, val: string) => void;
  onFinish: (session: WorkoutSession) => void;
  onBack: () => void;
  key?: string;
}) {
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [sessionData, setSessionData] = useState<Record<string, string[]>>(initialWeights);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [showVideo, setShowVideo] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const exercise = day.ejercicios[exerciseIdx];
  const isLastExercise = exerciseIdx === day.ejercicios.length - 1;
  const isLastSet = currentSet === exercise.series;

  // Timer logic
  useEffect(() => {
    let timer: any;
    if (isResting && restTime > 0) {
      timer = setInterval(() => setRestTime(prev => prev - 1), 1000);
    } else if (restTime === 0 && isResting) {
      setIsResting(false);
    }
    return () => clearInterval(timer);
  }, [isResting, restTime]);

  const handleSaveWeight = (val: string) => {
    setSessionData(prev => {
      const exerciseSets = prev[exercise.id] || Array(exercise.series).fill('');
      const newSets = [...exerciseSets];
      newSets[currentSet - 1] = val;
      return { ...prev, [exercise.id]: newSets };
    });
    onSaveWeight(exercise.id, currentSet - 1, val);
  };

  const toggleExerciseCompletion = (id: string) => {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    if (currentSet < exercise.series) {
      setCurrentSet(prev => prev + 1);
      setRestTime(exercise.descanso_segundos);
      setIsResting(true);
    } else {
      // Mark as completed when finishing all sets
      if (!completedExercises.has(exercise.id)) {
        toggleExerciseCompletion(exercise.id);
      }
      
      if (!isLastExercise) {
        setExerciseIdx(prev => prev + 1);
        setCurrentSet(1);
        setRestTime(exercise.descanso_segundos);
        setIsResting(true);
      } else {
        setShowFinishModal(true);
      }
    }
  };

  const confirmFinish = (userName: string) => {
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      dayName: day.nombre,
      userName: userName,
      date: new Date().toISOString(),
      exercises: day.ejercicios
        .filter(ex => completedExercises.has(ex.id) || (sessionData[ex.id]?.some(s => s !== '')))
        .map(ex => ({
          id: ex.id,
          nombre: ex.nombre,
          sets: sessionData[ex.id] || []
        }))
    };
    onFinish(session);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-bg h-screen"
    >
      <header className="px-4 sm:px-6 pt-8 pb-4 sticky top-0 bg-bg/90 backdrop-blur-xl z-30 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-[9px] font-black text-brand uppercase tracking-[0.2em] mb-0.5">Entrenando</p>
            <h2 className="text-xs font-black text-white uppercase italic truncate max-w-[150px]">{day.nombre.split('–')[1] || day.nombre}</h2>
          </div>
          <button 
            onClick={() => setShowFinishModal(true)}
            className="px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-lg text-brand text-[9px] font-black uppercase tracking-widest active:scale-95"
          >
            Terminar
          </button>
        </div>
        
        {/* Exercise Navigation Rail */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
          {day.ejercicios.map((ex, i) => (
            <button
              key={ex.id}
              onClick={() => {
                setExerciseIdx(i);
                setCurrentSet(1);
                setIsResting(false);
              }}
              className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative ${
                i === exerciseIdx 
                  ? 'bg-brand border-brand text-black shadow-lg shadow-brand/20' 
                  : completedExercises.has(ex.id)
                    ? 'bg-brand/10 border-brand/30 text-brand'
                    : 'bg-surface border-border text-zinc-600'
              }`}
            >
              <span className="text-xs font-black italic">{i + 1}</span>
              {completedExercises.has(ex.id) && i !== exerciseIdx && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand rounded-full flex items-center justify-center border-2 border-bg">
                  <Check size={8} className="text-black stroke-[4px]" />
                </div>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {isResting ? (
            <motion.div 
              key="rest"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center mb-8">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-900" />
                  <circle 
                    cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="4" fill="transparent" 
                    strokeDasharray="283%" 
                    strokeDashoffset={`${283 - (283 * restTime) / exercise.descanso_segundos}%`} 
                    className="text-brand transition-all duration-1000" 
                    strokeLinecap="round" 
                  />
                </svg>
                <div className="text-center">
                  <p className="text-5xl sm:text-7xl font-black text-white tabular-nums tracking-tighter italic">
                    {Math.floor(restTime / 60)}:{String(restTime % 60).padStart(2, '0')}
                  </p>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-1">Descanso</p>
                </div>
              </div>
              <button 
                onClick={() => setRestTime(0)}
                className="btn-secondary w-40 py-3 text-[10px]"
              >
                Saltar
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="exercise"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <span className="text-brand font-black text-[9px] tracking-[0.3em] uppercase mb-1 block">Ejercicio {exerciseIdx + 1} de {day.ejercicios.length}</span>
                  <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter italic leading-tight">{exercise.nombre}</h3>
                </div>
                <button 
                  onClick={() => toggleExerciseCompletion(exercise.id)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
                    completedExercises.has(exercise.id) 
                      ? 'bg-brand border-brand text-black shadow-lg shadow-brand/20' 
                      : 'bg-surface border-border text-zinc-700'
                  }`}
                >
                  <Check size={24} className={completedExercises.has(exercise.id) ? 'stroke-[4px]' : 'stroke-[2px]'} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-surface border border-border rounded-2xl p-3 sm:p-5 text-center">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Serie</p>
                  <p className="text-xl sm:text-2xl font-black text-white italic">{currentSet}<span className="text-zinc-700 text-xs">/{exercise.series}</span></p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-3 sm:p-5 text-center">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Reps</p>
                  <p className="text-xl sm:text-2xl font-black text-white italic">{exercise.repeticiones}</p>
                </div>
                <div className="bg-surface border border-border rounded-2xl p-3 sm:p-5 text-center">
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">RPE</p>
                  <p className="text-xl sm:text-2xl font-black text-brand italic">@{exercise.intensidad_rpe[currentSet - 1] || exercise.intensidad_rpe[0]}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Registrar Carga</p>
                <WeightInput 
                  exerciseId={exercise.id}
                  setIndex={currentSet - 1}
                  value={sessionData[exercise.id]?.[currentSet - 1] || ''}
                  onSave={handleSaveWeight}
                />
              </div>

              <div className="bg-surface/30 border border-border rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-2 text-zinc-400">
                  <Info size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Observaciones</span>
                </div>
                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed italic">"{exercise.observaciones}"</p>
              </div>

              <button 
                onClick={() => setShowVideo(true)}
                className="w-full py-3 flex items-center justify-center gap-2 text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] border border-border rounded-xl hover:text-white transition-colors"
              >
                <Video size={14} /> Ver Técnica
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isResting && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 sm:p-6 bg-gradient-to-t from-bg via-bg to-transparent pt-10 z-40">
          <button 
            onClick={handleNext}
            className="btn-primary w-full py-5 text-base sm:text-lg"
          >
            {isLastSet && isLastExercise ? 'Finalizar Entrenamiento' : isLastSet ? 'Siguiente Ejercicio' : `Completar Serie ${currentSet}`}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Finish Confirmation Modal */}
      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFinishModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface border border-border rounded-[2.5rem] p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-white italic tracking-tight mb-2">¿Quién ha finalizado?</h3>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-8">Selecciona para guardar el registro</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                {Object.keys(PROFILE_IMAGES).map(name => (
                  <button 
                    key={name}
                    onClick={() => confirmFinish(name)}
                    className="flex flex-col items-center gap-3 p-4 bg-zinc-900 border border-border rounded-3xl active:scale-95 transition-all hover:border-brand/50"
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-transparent hover:border-brand transition-all">
                      <img src={PROFILE_IMAGES[name as keyof typeof PROFILE_IMAGES]} alt={name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-sm font-black text-white">{name}</span>
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowFinishModal(false)}
                className="w-full py-4 text-zinc-500 font-black text-[10px] uppercase tracking-[0.3em]"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {showVideo && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6">
          <button 
            onClick={() => setShowVideo(false)}
            className="absolute top-10 right-6 w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center text-white"
          >
            <X size={24} />
          </button>
          <div className="w-full max-w-sm aspect-[9/16] bg-surface rounded-[2.5rem] overflow-hidden border border-border shadow-2xl">
            <iframe 
              src={getEmbedUrl(exercise.video)} 
              className="w-full h-full" 
              frameBorder="0" 
              allowFullScreen
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function HistoryView({ 
  history, 
  onBack, 
  onDelete 
}: { 
  history: WorkoutSession[]; 
  onBack: () => void; 
  onDelete: (id: string) => void;
  key?: string;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col p-6 pt-12"
    >
      <header className="flex items-center gap-4 mb-12">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-3xl font-black text-white tracking-tight italic uppercase">Historial</h2>
      </header>

      <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-700">
            <History size={64} className="mb-6 opacity-20" />
            <p className="font-black uppercase text-[10px] tracking-[0.3em]">Sin registros aún</p>
          </div>
        ) : (
          history.map(session => (
            <div key={session.id} className="bg-surface border border-border rounded-[2.5rem] overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-start bg-zinc-900/30">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-brand uppercase tracking-widest">{session.userName}</span>
                    <span className="text-zinc-800">•</span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{format(new Date(session.date), 'dd MMMM yyyy', { locale: es })}</span>
                  </div>
                  <h3 className="text-xl font-black text-white italic tracking-tight">{session.dayName}</h3>
                </div>
                <button onClick={() => onDelete(session.id)} className="text-zinc-800 hover:text-red-500 p-2 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {session.exercises.map((ex, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <p className="text-zinc-400 font-bold text-sm truncate max-w-full sm:max-w-[60%] italic">{ex.nombre}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.sets.map((w, j) => (
                        <span key={j} className="bg-zinc-900 border border-border text-zinc-300 text-[10px] font-black px-2 py-1 rounded-lg min-w-[36px] text-center">
                          {w || '--'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      
      <ProfessionalFooter />
    </motion.div>
  );
}

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function ProgressView({ 
  history, 
  profile, 
  onBack 
}: { 
  history: WorkoutSession[]; 
  profile: string; 
  onBack: () => void;
  key?: string;
}) {
  const userHistory = history.filter(s => s.userName === profile).reverse();
  
  // Prepare data for the chart (max weight per session)
  const chartData = userHistory.map(session => {
    const maxWeight = Math.max(...session.exercises.flatMap(ex => ex.sets.map(s => parseFloat(s) || 0)));
    return {
      date: format(new Date(session.date), 'dd/MM'),
      weight: maxWeight
    };
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col p-6 pt-12"
    >
      <header className="flex items-center gap-4 mb-12">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-3xl font-black text-white tracking-tight italic uppercase">Progreso</h2>
      </header>

      <div className="space-y-8 flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-surface border border-border rounded-[2.5rem] p-8">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-8">Carga Máxima por Sesión (kg)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                  itemStyle={{ color: '#22c55e', fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#22c55e" 
                  strokeWidth={4} 
                  dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-3xl p-6">
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Total Sesiones</p>
            <p className="text-3xl font-black text-white italic">{userHistory.length}</p>
          </div>
          <div className="bg-surface border border-border rounded-3xl p-6">
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Mejor Carga</p>
            <p className="text-3xl font-black text-brand italic">
              {chartData.length > 0 ? Math.max(...chartData.map(d => d.weight)) : 0}kg
            </p>
          </div>
        </div>

        <div className="bg-brand/5 border border-brand/20 rounded-[2.5rem] p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-black">
              <RefreshCw size={16} className="animate-spin-slow" />
            </div>
            <h4 className="text-xs font-black text-brand uppercase tracking-widest">AI Coach Tip</h4>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed italic">
            "La consistencia es la clave del éxito. Has completado {userHistory.length} sesiones este mes. ¡Sigue así y verás cómo esos números siguen subiendo!"
          </p>
        </div>
      </div>
      
      <ProfessionalFooter />
    </motion.div>
  );
}

// --- Utils ---

const getEmbedUrl = (url: string) => {
  if (!url) return '';
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&enablejsapi=1&origin=${window.location.origin}`;
  const ttMatch = url.match(/video\/(\d+)/);
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
  return url;
};
