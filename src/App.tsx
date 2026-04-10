import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Dumbbell, Calendar, History, ChevronLeft, ChevronRight,
  Check, Video, ArrowRight, X, LogOut, Trash2, RefreshCw,
  TrendingUp, Info, Table, Shield, Upload, User, Plus,
  FileDown, FileUp, Flame, StickyNote, Star, BarChart2
} from 'lucide-react';
import { ROUTINE_DATA, PROFILE_IMAGES, EXERCISES_SHEET_URL, ADMIN_PASSWORD, DEFAULT_PROFILES } from './constants';
import { Day, Exercise, Routine, WorkoutSession } from './types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
let XLSX: any;

async function loadXLSX() {
  if (!XLSX) {
    XLSX = await import('xlsx');
  }
  return XLSX;
}
// ─────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────
function lsGet<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch { return def; }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type AppView = 'login' | 'home' | 'workout' | 'history' | 'progress' | 'admin';
type AdminSubview = 'dashboard' | 'upload' | 'profiles' | 'backup';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getEmbedUrl(url: string): string {
  if (!url) return '';
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1&enablejsapi=1&origin=${window.location.origin}`;
  const tt = url.match(/video\/(\d+)/);
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`;
  return url;
}

function calcVolume(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((s, w) => s + (parseFloat(w) || 0), 0);
  }, 0);
}

function calcStreak(history: WorkoutSession[], profile: string): number {
  const dates = [...new Set(
    history.filter(s => s.userName === profile)
      .map(s => new Date(s.date).toDateString())
  )].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

  if (!dates.length) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last = new Date(dates[0]); last.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - last.getTime()) / 86400000);
  if (diff > 1) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const d1 = new Date(dates[i - 1]); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(dates[i]); d2.setHours(0, 0, 0, 0);
    if (Math.floor((d1.getTime() - d2.getTime()) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

function getExercisePR(history: WorkoutSession[], profile: string, exerciseId: string): number {
  const weights = history
    .filter(s => s.userName === profile)
    .flatMap(s => {
      const ex = s.exercises.find(e => e.id === exerciseId);
      return ex ? ex.sets.map(w => parseFloat(w) || 0) : [];
    });
  return weights.length ? Math.max(...weights) : 0;
}

function getExerciseChartData(history: WorkoutSession[], profile: string, exerciseId: string) {
  return history
    .filter(s => s.userName === profile)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .flatMap(s => {
      const ex = s.exercises.find(e => e.id === exerciseId);
      if (!ex) return [];
      const max = Math.max(...ex.sets.map(w => parseFloat(w) || 0));
      if (max <= 0) return [];
      return [{ date: format(new Date(s.date), 'dd/MM'), weight: max }];
    });
}

async function parseExcelToRoutine(file: File): Promise<Routine> {
  const XLSX = await loadXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const routine: Routine = { nombre: file.name.replace(/\.xlsx?$/i, ''), dias: [] };

        wb.SheetNames.forEach((sheetName: string, sheetIdx: number) => {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
          if (rows.length < 2) return;

          const headerRow = (rows[0] as string[]).map(h => String(h).toLowerCase().trim());
          const col = (terms: string[]) => headerRow.findIndex(h => terms.some(t => h.includes(t)));

          const colMap = {
            nombre: col(['ejercicio', 'nombre', 'exercise', 'name']),
            series: col(['serie', 'sets']),
            reps: col(['rep']),
            rpe: col(['rpe', 'intensidad']),
            descanso: col(['descanso', 'rest', 'seg']),
            video: col(['video', 'url', 'link']),
            obs: col(['observ', 'nota', 'tip', 'comment']),
          };

          const ejercicios: Exercise[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i] as string[];
            const nombre = colMap.nombre >= 0 ? String(row[colMap.nombre] || '').trim() : '';
            if (!nombre) continue;

            const series = colMap.series >= 0 ? (parseInt(String(row[colMap.series])) || 3) : 3;
            const repeticiones = colMap.reps >= 0 ? String(row[colMap.reps] || '10-12') : '10-12';
            const rpeRaw = colMap.rpe >= 0 ? String(row[colMap.rpe] || '8') : '8';
            const descanso_segundos = colMap.descanso >= 0 ? (parseInt(String(row[colMap.descanso])) || 120) : 120;
            const video = colMap.video >= 0 ? String(row[colMap.video] || '') : '';
            const observaciones = colMap.obs >= 0 ? String(row[colMap.obs] || '') : '';

            let intensidad_rpe: number[] = rpeRaw.includes(',')
              ? rpeRaw.split(',').map(r => parseInt(r.trim()) || 8)
              : [parseInt(rpeRaw) || 8];

            while (intensidad_rpe.length < series) {
              intensidad_rpe.push(intensidad_rpe[intensidad_rpe.length - 1]);
            }

            ejercicios.push({
              id: `xl_${sheetIdx}_${i}_${Date.now()}`,
              nombre,
              series,
              repeticiones,
              intensidad_rpe,
              descanso_segundos,
              video,
              observaciones
            });
          }

          if (ejercicios.length > 0) {
            routine.dias.push({
              dia: sheetIdx + 1,
              nombre: `Día ${sheetIdx + 1} – ${sheetName}`,
              ejercicios
            });
          }
        });

        if (routine.dias.length === 0) {
          reject(new Error('No se encontraron ejercicios.'));
        } else {
          resolve(routine);
        }

      } catch (err: any) {
        reject(new Error('Error al leer el archivo: ' + err.message));
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────
const ProfessionalFooter = () => (
  <div className="w-full py-8 text-center space-y-1 opacity-40">
    <div className="h-px w-10 bg-zinc-800 mx-auto mb-4" />
    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
      Desarrollada por <span className="text-zinc-300">Marcos Nieto</span>
    </p>
    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.15em]">
      Propuestos por <span className="text-zinc-400">Roberto Bosqued</span>
    </p>
  </div>
);

function Avatar({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [err, setErr] = useState(false);
  const sizes = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-20 h-20' };
  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };
  return (
    <div className={`${sizes[size]} rounded-full overflow-hidden border border-zinc-800 flex-shrink-0`}>
      {src && !err
        ? <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
        : <div className={`w-full h-full flex items-center justify-center bg-zinc-900 font-black ${textSizes[size]} text-zinc-400`}>{name[0]}</div>
      }
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [activeProfile, setActiveProfile] = useState<string | null>(() => lsGet('gym_profile', null));
  const [history, setHistory] = useState<WorkoutSession[]>(() => lsGet('gym_history', []));
  const [weights, setWeights] = useState<Record<string, string[]>>(() => lsGet('gym_weights', {}));
  const [routines, setRoutines] = useState<Record<string, Routine>>(() => lsGet('gym_routines', {}));
  const [profileImages, setProfileImages] = useState<Record<string, string>>(() => lsGet('gym_profile_images', PROFILE_IMAGES));
  const [adminProfiles, setAdminProfiles] = useState<string[]>(() => lsGet('gym_admin_profiles', DEFAULT_PROFILES));
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { lsSet('gym_history', history); }, [history]);
  useEffect(() => { lsSet('gym_weights', weights); }, [weights]);
  useEffect(() => { lsSet('gym_routines', routines); }, [routines]);
  useEffect(() => { lsSet('gym_profile_images', profileImages); }, [profileImages]);
  useEffect(() => { lsSet('gym_admin_profiles', adminProfiles); }, [adminProfiles]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const getRoutine = (name: string) => routines[name] || ROUTINE_DATA;

  const handleSelectProfile = (name: string) => {
    setActiveProfile(name);
    lsSet('gym_profile', name);
    setView('home');
  };

  const handleLogout = () => {
    setActiveProfile(null);
    lsSet('gym_profile', null);
    setView('login');
  };

  const handleFinishWorkout = (session: WorkoutSession) => {
    setHistory(prev => [session, ...prev]);
    showToast('¡Entrenamiento guardado! 💪');
    setView('home');
  };

  const handleSaveWeight = (exerciseId: string, setIndex: number, weight: string) => {
    setWeights(prev => {
      const sets = [...(prev[exerciseId] || [])];
      while (sets.length <= setIndex) sets.push('');
      sets[setIndex] = weight;
      return { ...prev, [exerciseId]: sets };
    });
  };

  const handleAssignRoutine = (name: string, routine: Routine) => {
    setRoutines(prev => ({ ...prev, [name]: routine }));
    showToast(`Rutina asignada a ${name} ✓`);
  };

  const handleResetRoutine = (name: string) => {
    setRoutines(prev => { const n = { ...prev }; delete n[name]; return n; });
    showToast(`Rutina de ${name} restaurada`);
  };

  const handleAddProfile = (name: string, imgUrl?: string) => {
    setAdminProfiles(prev => [...prev, name]);
    if (imgUrl) setProfileImages(prev => ({ ...prev, [name]: imgUrl }));
    showToast(`Usuario ${name} añadido ✓`);
  };

  const handleRemoveProfile = (name: string) => {
    setAdminProfiles(prev => prev.filter(p => p !== name));
    setHistory(prev => prev.filter(s => s.userName !== name));
    setProfileImages(prev => { const n = { ...prev }; delete n[name]; return n; });
    setRoutines(prev => { const n = { ...prev }; delete n[name]; return n; });
    showToast(`Usuario ${name} eliminado`);
  };

  const handleExportBackup = () => {
    const data = {
      gym_history: history,
      gym_weights: weights,
      gym_routines: routines,
      gym_profile_images: profileImages,
      gym_admin_profiles: adminProfiles,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymtrainer-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exportado ✓');
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target!.result as string);
        if (data.gym_history) setHistory(data.gym_history);
        if (data.gym_weights) setWeights(data.gym_weights);
        if (data.gym_routines) setRoutines(data.gym_routines);
        if (data.gym_profile_images) setProfileImages(data.gym_profile_images);
        if (data.gym_admin_profiles) setAdminProfiles(data.gym_admin_profiles);
        showToast('Backup importado correctamente ✓');
      } catch {
        showToast('Error al leer el archivo JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center overflow-x-hidden">
      <div className="w-full max-w-md min-h-screen flex flex-col relative">
        <AnimatePresence mode="wait">
          {(view === 'login' || (!activeProfile && view !== 'admin')) && (
            <LoginView
              key="login"
              profiles={adminProfiles}
              profileImages={profileImages}
              onSelectProfile={handleSelectProfile}
              onAdminLogin={() => setShowAdminLogin(true)}
            />
          )}
          {view === 'home' && activeProfile && (
            <HomeView
              key="home"
              profile={activeProfile}
              history={history}
              routine={getRoutine(activeProfile)}
              profileImages={profileImages}
              onStartWorkout={(dayIdx) => setView('workout')}
              onNavigate={setView}
              onLogout={handleLogout}
              activeDayIdx={0}
              setActiveDayIdx={() => {}}
              getStreakFn={() => calcStreak(history, activeProfile)}
            />
          )}
          {view === 'workout' && activeProfile && (
            <WorkoutView
              key="workout"
              profile={activeProfile}
              history={history}
              routine={getRoutine(activeProfile)}
              initialWeights={weights}
              onSaveWeight={handleSaveWeight}
              onFinish={handleFinishWorkout}
              onBack={() => setView('home')}
              profiles={adminProfiles}
              profileImages={profileImages}
            />
          )}
          {view === 'history' && (
            <HistoryView
              key="history"
              history={history}
              profiles={adminProfiles}
              onBack={() => setView('home')}
              onDelete={(id) => setHistory(prev => prev.filter(s => s.id !== id))}
            />
          )}
          {view === 'progress' && activeProfile && (
            <ProgressView
              key="progress"
              history={history}
              profile={activeProfile}
              routine={getRoutine(activeProfile)}
              onBack={() => setView('home')}
            />
          )}
          {view === 'admin' && (
            <AdminView
              key="admin"
              history={history}
              profiles={adminProfiles}
              profileImages={profileImages}
              routines={routines}
              onBack={() => setView('login')}
              onAssignRoutine={handleAssignRoutine}
              onResetRoutine={handleResetRoutine}
              onAddProfile={handleAddProfile}
              onRemoveProfile={handleRemoveProfile}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              showToast={showToast}
            />
          )}
        </AnimatePresence>

        {/* Admin login modal */}
        <AnimatePresence>
          {showAdminLogin && (
            <AdminLoginModal
              onSuccess={() => { setShowAdminLogin(false); setView('admin'); }}
              onClose={() => setShowAdminLogin(false)}
            />
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] bg-brand text-black font-black text-[10px] tracking-widest uppercase px-5 py-3 rounded-full shadow-xl whitespace-nowrap"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LOGIN VIEW
// ─────────────────────────────────────────────
function LoginView({ profiles, profileImages, onSelectProfile, onAdminLogin }: {
  profiles: string[];
  profileImages: Record<string, string>;
  onSelectProfile: (n: string) => void;
  onAdminLogin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md text-center relative z-10">
        <div className="mb-12">
          <h1 className="text-7xl font-black text-white tracking-tighter italic flex flex-col items-center leading-[0.85] uppercase">
            <span className="opacity-90">Gym</span>
            <span className="opacity-95">Trainer</span>
            <span className="text-brand drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">PRO</span>
          </h1>
          <div className="h-1 w-12 bg-brand mx-auto mt-6 rounded-full" />
        </div>
        <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.5em] mb-16 opacity-80">Performance Tracking System</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {profiles.map(name => (
            <button
              key={name}
              onClick={() => onSelectProfile(name)}
              className="group relative overflow-hidden bg-surface border border-border p-8 rounded-[2.5rem] flex flex-col items-center gap-4 active:scale-95 transition-all hover:border-brand/30"
            >
              <Avatar name={name} src={profileImages[name]} size="lg" />
              <span className="text-xl font-black text-white tracking-tight">{name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onAdminLogin}
          className="flex items-center gap-2 mx-auto text-[10px] font-black uppercase tracking-widest text-purple-400 border border-purple-900/40 bg-purple-900/10 px-4 py-2 rounded-xl hover:border-purple-500/40 transition-all"
        >
          <Shield size={12} /> Admin
        </button>
      </div>

      <ProfessionalFooter />
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// ADMIN LOGIN MODAL
// ─────────────────────────────────────────────
function AdminLoginModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const submit = () => {
    if (pw === ADMIN_PASSWORD) onSuccess();
    else { setErr(true); setTimeout(() => setErr(false), 800); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="w-full max-w-sm bg-surface border border-purple-900/40 rounded-[2.5rem] p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-400">
            <Shield size={16} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white italic">Panel Admin</h3>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Acceso restringido</p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Contraseña"
          className={`w-full bg-zinc-900 border rounded-2xl px-5 py-4 text-white font-bold outline-none mb-4 transition-all ${err ? 'border-red-500' : 'border-zinc-800 focus:border-purple-500/50'}`}
        />
        <button onClick={submit} className="w-full py-4 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl mb-3 active:scale-95 transition-all">
          Entrar
        </button>
        <button onClick={onClose} className="w-full py-3 text-zinc-500 font-black text-[10px] uppercase tracking-widest">
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// HOME VIEW
// ─────────────────────────────────────────────
function HomeView({ profile, history, routine, profileImages, onStartWorkout, onNavigate, onLogout, getStreakFn }: {
  profile: string;
  history: WorkoutSession[];
  routine: Routine;
  profileImages: Record<string, string>;
  onStartWorkout: (idx: number) => void;
  onNavigate: (v: AppView) => void;
  onLogout: () => void;
  activeDayIdx: number;
  setActiveDayIdx: (i: number) => void;
  getStreakFn: () => number;
}) {
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const userHistory = history.filter(s => s.userName === profile);
  const lastSession = userHistory[0];
  const sessionCount = userHistory.length;
  const streak = getStreakFn();

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
              <Avatar name={profile} src={profileImages[profile]} size="md" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand rounded-full border-2 border-bg flex items-center justify-center">
              <Check size={10} className="text-black stroke-[4px]" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">{profile}</h1>
            <p className="text-zinc-500 text-[9px] font-black tracking-[0.2em] uppercase mt-1">{routine.nombre}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-10 h-10 bg-surface border border-border rounded-xl flex items-center justify-center text-zinc-600 active:scale-90 transition-all">
          <LogOut size={18} />
        </button>
      </header>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-3 bg-brand/5 border border-brand/15 rounded-2xl px-5 py-4 mb-6">
          <Flame size={20} className="text-brand" />
          <div>
            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Racha activa</p>
            <p className="text-sm font-black text-brand italic">{streak} día{streak !== 1 ? 's' : ''} seguidos</p>
          </div>
        </div>
      )}

      {/* Bento */}
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
        <button onClick={() => onNavigate('progress')} className="col-span-2 row-span-1 bg-brand text-black rounded-3xl p-5 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-brand/10">
          <TrendingUp size={20} className="stroke-[3px]" />
          <span className="text-[8px] font-black uppercase tracking-widest">Stats</span>
        </button>
        <button onClick={() => onNavigate('history')} className="col-span-2 row-span-1 bg-surface border border-border rounded-3xl p-5 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all">
          <History size={20} className="text-zinc-400" />
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Log</span>
        </button>
        <a href={EXERCISES_SHEET_URL} target="_blank" rel="noopener noreferrer" className="col-span-2 row-span-1 bg-surface border border-border rounded-3xl p-5 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all hover:border-brand/30">
          <Table size={20} className="text-zinc-400" />
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Sheet</span>
        </a>
      </div>

      {/* Days */}
      <div className="space-y-3 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Entrenamientos</h2>
          <div className="h-[1px] flex-1 bg-zinc-900 ml-4" />
        </div>
        {routine.dias.map((day, idx) => (
          <button
            key={day.dia}
            onClick={() => { setActiveDayIdx(idx); onStartWorkout(idx); }}
            className="w-full bg-surface/40 border border-border rounded-[2rem] p-5 text-left flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-surface/60 hover:border-brand/20"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-zinc-900 border border-border rounded-2xl flex items-center justify-center text-zinc-700 group-hover:text-brand group-hover:border-brand/30 transition-all">
                <span className="text-lg font-black italic">{day.dia}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-brand transition-colors italic tracking-tight">{day.nombre.split('–')[1] || day.nombre}</h3>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">{day.ejercicios.length} ejercicios · {day.ejercicios.reduce((a, e) => a + e.series, 0)} series</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-zinc-800 group-hover:text-brand transition-all" />
          </button>
        ))}
      </div>

      <ProfessionalFooter />
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// WORKOUT VIEW
// ─────────────────────────────────────────────
function WorkoutView({ profile, history, routine, initialWeights, onSaveWeight, onFinish, onBack, profiles, profileImages }: {
  profile: string;
  history: WorkoutSession[];
  routine: Routine;
  initialWeights: Record<string, string[]>;
  onSaveWeight: (id: string, setIdx: number, w: string) => void;
  onFinish: (s: WorkoutSession) => void;
  onBack: () => void;
  profiles: string[];
  profileImages: Record<string, string>;
}) {
  const [dayIdx, setDayIdx] = useState(0);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const [sessionData, setSessionData] = useState<Record<string, string[]>>(initialWeights);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [showVideo, setShowVideo] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [workoutNote, setWorkoutNote] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const day = routine.dias[dayIdx];
  const exercise = day?.ejercicios[exerciseIdx];
  const isLastExercise = exerciseIdx === (day?.ejercicios.length ?? 0) - 1;
  const isLastSet = currentSet === exercise?.series;

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRest = (seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsResting(true);
    setRestTime(seconds);
    timerRef.current = setInterval(() => {
      setRestTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipRest = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsResting(false);
    setRestTime(0);
  };

  const handleSaveWeight = (val: string) => {
    setSessionData(prev => {
      const sets = [...(prev[exercise.id] || Array(exercise.series).fill(''))];
      while (sets.length <= currentSet - 1) sets.push('');
      sets[currentSet - 1] = val;
      return { ...prev, [exercise.id]: sets };
    });
    onSaveWeight(exercise.id, currentSet - 1, val);
  };

  const toggleCompletion = (id: string) => {
    setCompletedExercises(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleNext = () => {
    if (currentSet < exercise.series) {
      startRest(exercise.descanso_segundos);
      setCurrentSet(prev => prev + 1);
    } else {
      const newCompleted = new Set(completedExercises);
      newCompleted.add(exercise.id);
      setCompletedExercises(newCompleted);
      if (!isLastExercise) {
        setExerciseIdx(prev => prev + 1);
        setCurrentSet(1);
        startRest(exercise.descanso_segundos);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setShowFinishModal(true);
      }
    }
  };

  const confirmFinish = (userName: string) => {
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      dayName: day.nombre,
      userName,
      date: new Date().toISOString(),
      note: workoutNote || undefined,
      exercises: day.ejercicios
        .filter(ex => completedExercises.has(ex.id) || (sessionData[ex.id]?.some(s => s !== '')))
        .map(ex => ({ id: ex.id, nombre: ex.nombre, sets: sessionData[ex.id] || [] }))
    };
    onFinish(session);
  };

  if (!day || !exercise) return null;

  const pr = getExercisePR(history, profile, exercise.id);
  const currentWeight = parseFloat((sessionData[exercise.id] || [])[currentSet - 1] || '');
  const isPR = currentWeight > 0 && currentWeight > pr;
  const prevWeights = initialWeights[exercise.id] || [];
  const rpe = exercise.intensidad_rpe[currentSet - 1] ?? exercise.intensidad_rpe[0];
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (circumference * restTime) / exercise.descanso_segundos;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col bg-bg h-screen"
    >
      {/* Header */}
      <header className="px-4 sm:px-6 pt-8 pb-4 sticky top-0 bg-bg/90 backdrop-blur-xl z-30 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setShowConfirmBack(true)} className="w-9 h-9 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-[9px] font-black text-brand uppercase tracking-[0.2em] mb-0.5">Entrenando</p>
            <h2 className="text-xs font-black text-white uppercase italic truncate max-w-[160px]">{day.nombre.split('–')[1] || day.nombre}</h2>
          </div>
          <button onClick={() => setShowFinishModal(true)} className="px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-lg text-brand text-[9px] font-black uppercase tracking-widest active:scale-95">
            Terminar
          </button>
        </div>
        {/* Day selector */}
        {routine.dias.length > 1 && (
          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
            {routine.dias.map((d, i) => (
              <button key={d.dia} onClick={() => { setDayIdx(i); setExerciseIdx(0); setCurrentSet(1); skipRest(); }}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${i === dayIdx ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-surface border-border text-zinc-600'}`}>
                {d.nombre.split('–')[1]?.trim() || `Día ${d.dia}`}
              </button>
            ))}
          </div>
        )}
        {/* Exercise nav rail */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-2 px-2">
          {day.ejercicios.map((ex, i) => (
            <button key={ex.id} onClick={() => { setExerciseIdx(i); setCurrentSet(1); skipRest(); }}
              className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all relative ${i === exerciseIdx ? 'bg-brand border-brand text-black shadow-lg shadow-brand/20' : completedExercises.has(ex.id) ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-surface border-border text-zinc-600'}`}>
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
            <motion.div key="rest" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8">
              <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center mb-8">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-900" />
                  <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="4" fill="transparent"
                    strokeDasharray={`${circumference}px`} strokeDashoffset={`${dashOffset}px`}
                    className="text-brand transition-all duration-1000" strokeLinecap="round" />
                </svg>
                <div className="text-center">
                  <p className="text-5xl sm:text-7xl font-black text-white tabular-nums tracking-tighter italic">
                    {Math.floor(restTime / 60)}:{String(restTime % 60).padStart(2, '0')}
                  </p>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-1">Descanso</p>
                </div>
              </div>
              <button onClick={skipRest} className="btn-secondary w-40 py-3 text-[10px]">Saltar</button>
            </motion.div>
          ) : (
            <motion.div key="exercise" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Title */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <span className="text-brand font-black text-[9px] tracking-[0.3em] uppercase mb-1 block">
                    Ejercicio {exerciseIdx + 1} de {day.ejercicios.length}
                  </span>
                  <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tighter italic leading-tight">{exercise.nombre}</h3>
                </div>
                <button onClick={() => toggleCompletion(exercise.id)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${completedExercises.has(exercise.id) ? 'bg-brand border-brand text-black shadow-lg shadow-brand/20' : 'bg-surface border-border text-zinc-700'}`}>
                  <Check size={24} className={completedExercises.has(exercise.id) ? 'stroke-[4px]' : 'stroke-[2px]'} />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { label: 'Serie', val: <>{currentSet}<span className="text-zinc-700 text-xs">/{exercise.series}</span></> },
                  { label: 'Reps', val: exercise.repeticiones },
                  { label: 'RPE', val: <span className="text-brand">@{rpe}</span> },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-surface border border-border rounded-2xl p-3 sm:p-5 text-center">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-xl sm:text-2xl font-black text-white italic">{val}</p>
                  </div>
                ))}
              </div>

              {/* Weight input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Registrar Carga</p>
                  {isPR
                    ? <span className="flex items-center gap-1 bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"><Star size={10} className="fill-yellow-400" /> Nuevo PR</span>
                    : pr > 0 ? <span className="text-[9px] font-black text-zinc-600 uppercase tracking-wider">PR: {pr}kg</span> : null
                  }
                </div>
                <WeightInput
                  exerciseId={exercise.id}
                  setIndex={currentSet - 1}
                  value={(sessionData[exercise.id] || [])[currentSet - 1] || ''}
                  onSave={handleSaveWeight}
                />
                {/* Previous weights */}
                {prevWeights.some(w => w) && (
                  <div>
                    <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-1.5">Cargas anteriores</p>
                    <div className="flex gap-2 flex-wrap">
                      {prevWeights.map((w, i) => (
                        <div key={i} className={`px-2 py-1 rounded-lg border text-[10px] font-black min-w-[2.5rem] text-center ${i === currentSet - 1 ? 'border-brand/40 text-brand bg-brand/5' : 'border-zinc-800 text-zinc-500 bg-zinc-900/50'}`}>
                          {w || '--'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div className="bg-surface/30 border border-border rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-2 text-zinc-400">
                  <Info size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Observaciones</span>
                </div>
                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed italic">"{exercise.observaciones}"</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowVideo(true)} className="flex-1 py-3 flex items-center justify-center gap-2 text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] border border-border rounded-xl hover:text-white transition-colors">
                  <Video size={14} /> Ver Técnica
                </button>
                <button onClick={() => setShowNoteModal(true)} className={`flex-1 py-3 flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-[0.2em] border rounded-xl transition-colors ${workoutNote ? 'border-brand/30 text-brand' : 'border-border text-zinc-500 hover:text-white'}`}>
                  <StickyNote size={14} /> {workoutNote ? 'Nota añadida' : 'Añadir nota'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {!isResting && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 sm:p-6 bg-gradient-to-t from-bg via-bg to-transparent pt-10 z-40">
          <button onClick={handleNext} className="btn-primary w-full py-5 text-base sm:text-lg">
            {isLastSet && isLastExercise ? 'Finalizar Entrenamiento' : isLastSet ? 'Siguiente Ejercicio' : `Completar Serie ${currentSet}`}
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Finish Modal */}
      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFinishModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface border border-border rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-2xl font-black text-white italic tracking-tight mb-2">¿Quién ha finalizado?</h3>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-8">Selecciona para guardar el registro</p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {profiles.map(name => (
                  <button key={name} onClick={() => confirmFinish(name)}
                    className="flex flex-col items-center gap-3 p-4 bg-zinc-900 border border-border rounded-3xl active:scale-95 transition-all hover:border-brand/50">
                    <Avatar name={name} src={profileImages[name]} size="md" />
                    <span className="text-sm font-black text-white">{name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowFinishModal(false)} className="w-full py-4 text-zinc-500 font-black text-[10px] uppercase tracking-[0.3em]">
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm back modal */}
      <AnimatePresence>
        {showConfirmBack && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface border border-border rounded-[2.5rem] p-8">
              <h3 className="text-xl font-black text-white italic mb-2">¿Salir del entrenamiento?</h3>
              <p className="text-zinc-500 text-sm mb-8">Perderás el progreso no guardado de esta sesión.</p>
              <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); onBack(); }}
                className="w-full py-4 bg-red-500/20 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-widest rounded-2xl mb-3 active:scale-95 transition-all">
                Sí, salir
              </button>
              <button onClick={() => setShowConfirmBack(false)} className="w-full py-4 text-zinc-500 font-black text-[10px] uppercase tracking-[0.3em]">
                Continuar entrenando
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Note modal */}
      <AnimatePresence>
        {showNoteModal && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNoteModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="relative w-full max-w-sm bg-surface border border-border rounded-[2.5rem] p-8">
              <h3 className="text-xl font-black text-white italic mb-4">Nota de sesión</h3>
              <textarea
                autoFocus
                rows={4}
                defaultValue={workoutNote}
                placeholder="Ej: Me noté cargado, nuevo PR en hack squat…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-brand/50 transition-all resize-none placeholder:text-zinc-700"
                id="noteTextarea"
              />
              <button
                onClick={() => {
                  const el = document.getElementById('noteTextarea') as HTMLTextAreaElement;
                  setWorkoutNote(el?.value || '');
                  setShowNoteModal(false);
                }}
                className="btn-primary w-full mt-4"
              >
                Guardar nota
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video modal */}
      {showVideo && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6">
          <button onClick={() => setShowVideo(false)} className="absolute top-10 right-6 w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center text-white">
            <X size={24} />
          </button>
          <div className="w-full max-w-sm aspect-[9/16] bg-surface rounded-[2.5rem] overflow-hidden border border-border shadow-2xl">
            <iframe src={getEmbedUrl(exercise.video)} className="w-full h-full" frameBorder="0" allowFullScreen />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Weight input component
function WeightInput({ exerciseId, setIndex, value, onSave }: {
  exerciseId: string; setIndex: number; value: string; onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div className="flex gap-3 w-full items-center">
      <div className="relative flex-1">
        <input
          type="number" step="0.5" inputMode="decimal"
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => onSave(local)}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xl sm:text-2xl font-black text-white focus:outline-none focus:border-brand/50 transition-all placeholder:text-zinc-800"
          placeholder="0.0"
        />
        <span className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-widest">kg</span>
      </div>
      <button onClick={() => onSave(local)}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${local === value && value !== '' ? 'bg-brand text-black shadow-lg shadow-brand/20' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'}`}>
        <Check size={18} className={local === value && value !== '' ? 'stroke-[4px]' : 'stroke-[2px]'} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// HISTORY VIEW
// ─────────────────────────────────────────────
function HistoryView({ history, profiles, onBack, onDelete }: {
  history: WorkoutSession[];
  profiles: string[];
  onBack: () => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? history : history.filter(s => s.userName === filter);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col p-6 pt-12"
    >
      <header className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-3xl font-black text-white tracking-tight italic uppercase">Historial</h2>
      </header>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {['all', ...profiles].map(p => (
          <button key={p} onClick={() => setFilter(p)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${filter === p ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-surface border-border text-zinc-500'}`}>
            {p === 'all' ? 'Todos' : p}
          </button>
        ))}
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-700">
            <History size={64} className="mb-6 opacity-20" />
            <p className="font-black uppercase text-[10px] tracking-[0.3em]">Sin registros aún</p>
          </div>
        ) : filtered.map(session => (
          <div key={session.id} className="bg-surface border border-border rounded-[2.5rem] overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-start bg-zinc-900/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-brand uppercase tracking-widest">{session.userName}</span>
                  <span className="text-zinc-800">•</span>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">{format(new Date(session.date), 'dd MMMM yyyy', { locale: es })}</span>
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tight">{session.dayName}</h3>
                {session.note && <p className="text-xs text-zinc-500 mt-1 italic">"{session.note}"</p>}
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">
                  Vol. total: <span className="text-zinc-400">{calcVolume(session).toFixed(0)} kg</span>
                </p>
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
        ))}
      </div>

      <ProfessionalFooter />
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// PROGRESS VIEW
// ─────────────────────────────────────────────
function ProgressView({ history, profile, routine, onBack }: {
  history: WorkoutSession[];
  profile: string;
  routine: Routine;
  onBack: () => void;
}) {
  const allExercises = routine.dias.flatMap(d => d.ejercicios);
  const [selectedExId, setSelectedExId] = useState(allExercises[0]?.id || '');
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const userHistory = history.filter(s => s.userName === profile).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const streak = calcStreak(history, profile);
  const totalVolume = userHistory.reduce((t, s) => t + calcVolume(s), 0);

  const overallChart = userHistory.map(s => ({
    date: format(new Date(s.date), 'dd/MM'),
    weight: Math.max(...s.exercises.flatMap(e => e.sets.map(w => parseFloat(w) || 0)))
  })).filter(d => d.weight > 0);

  const exChart = getExerciseChartData(history, profile, selectedExId);
  const exPR = getExercisePR(history, profile, selectedExId);
  const bestOverall = overallChart.length ? Math.max(...overallChart.map(d => d.weight)) : 0;

  const loadAITip = async () => {
    setAiLoading(true);
    const summary = {
      nombre: profile,
      sesiones: userHistory.length,
      racha: streak,
      rutina: routine.nombre,
      dias: routine.dias.map(d => ({ nombre: d.nombre, ejercicios: d.ejercicios.length })),
      ultimaSesion: userHistory[userHistory.length - 1] ? {
        dia: userHistory[userHistory.length - 1].dayName,
        ejercicios: userHistory[userHistory.length - 1].exercises.map(e => ({
          nombre: e.nombre,
          cargas: e.sets.filter(w => parseFloat(w) > 0)
        }))
      } : null,
      mejoresPesos: allExercises.map(ex => {
        const pr = getExercisePR(history, profile, ex.id);
        return pr > 0 ? `${ex.nombre}: ${pr}kg` : null;
      }).filter(Boolean).slice(0, 6)
    };

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Eres un coach de fitness experto. Basándote en los datos del atleta, da UN consejo motivador y específico en español (máx 80 palabras). Habla directamente usando "tú". Sé concreto, menciona ejercicios o números si los hay. No uses asteriscos ni markdown. Solo el consejo, sin comillas ni introducciones.\n\nDatos: ${JSON.stringify(summary, null, 2)}`
          }]
        })
      });
      const data = await resp.json();
      setAiTip(data.content?.[0]?.text || 'Sigue con constancia. ¡Cada sesión cuenta!');
    } catch {
      setAiTip('Sigue entrenando con consistencia. ¡Cada sesión te acerca más a tus objetivos!');
    }
    setAiLoading(false);
  };

  const tooltipStyle = { backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px' };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col p-6 pt-12"
    >
      <header className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-3xl font-black text-white tracking-tight italic uppercase">Progreso</h2>
      </header>

      <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Sesiones totales', val: userHistory.length, unit: '', color: 'text-white' },
            { label: 'Mejor carga', val: bestOverall, unit: 'kg', color: 'text-brand' },
            { label: 'Volumen total', val: Math.round(totalVolume).toLocaleString('es'), unit: 'kg', color: 'text-white' },
            { label: 'Racha actual', val: streak, unit: ` día${streak !== 1 ? 's' : ''}`, color: streak > 0 ? 'text-brand' : 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-surface border border-border rounded-3xl p-5">
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-black italic ${s.color}`}>
                {s.val}<span className="text-zinc-600 text-base font-bold">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Overall chart */}
        <div className="bg-surface border border-border rounded-[2.5rem] p-6">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-6">Carga máxima por sesión (kg)</h3>
          <div className="h-52 w-full">
            {overallChart.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overallChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#22c55e', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={4}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-700">
                <p className="text-[10px] font-black uppercase tracking-widest">Necesitas al menos 2 sesiones</p>
              </div>
            )}
          </div>
        </div>

        {/* Per-exercise chart */}
        <div className="bg-surface border border-border rounded-[2.5rem] p-6">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Progreso por ejercicio</h3>
          <select
            value={selectedExId}
            onChange={e => setSelectedExId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none mb-4 cursor-pointer"
          >
            {routine.dias.map(d => (
              <optgroup key={d.dia} label={d.nombre}>
                {d.ejercicios.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {exPR > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">PR: <span className="text-brand">{exPR}kg</span></span>
              <span className="text-[9px] font-black text-zinc-600">{exChart.length} registro{exChart.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="h-52 w-full">
            {exChart.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={exChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#22c55e', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={4}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-700">
                <p className="text-[10px] font-black uppercase tracking-widest">Sin datos suficientes para este ejercicio</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Coach */}
        <div className="bg-brand/5 border border-brand/20 rounded-[2.5rem] p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-black">
              <RefreshCw size={14} className={aiLoading ? 'animate-spin' : ''} />
            </div>
            <h4 className="text-xs font-black text-brand uppercase tracking-widest">AI Coach</h4>
            <button
              onClick={loadAITip}
              disabled={aiLoading}
              className="ml-auto text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-brand transition-colors disabled:opacity-40"
            >
              {aiLoading ? 'Cargando…' : '↻ Actualizar'}
            </button>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed italic">
            "{aiTip || `Llevas ${userHistory.length} sesiones completadas. Pulsa "Actualizar" para un consejo personalizado basado en tu progreso real.`}"
          </p>
        </div>
      </div>

      <ProfessionalFooter />
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────────
function AdminView({ history, profiles, profileImages, routines, onBack, onAssignRoutine, onResetRoutine, onAddProfile, onRemoveProfile, onExportBackup, onImportBackup, showToast }: {
  history: WorkoutSession[];
  profiles: string[];
  profileImages: Record<string, string>;
  routines: Record<string, Routine>;
  onBack: () => void;
  onAssignRoutine: (name: string, routine: Routine) => void;
  onResetRoutine: (name: string) => void;
  onAddProfile: (name: string, img?: string) => void;
  onRemoveProfile: (name: string) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  showToast: (msg: string) => void;
}) {
  const [subview, setSubview] = useState<AdminSubview>('dashboard');
  const [uploadedRoutine, setUploadedRoutine] = useState<Routine | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newImg, setNewImg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) { setUploadError('Solo se admiten archivos .xlsx'); return; }
    setUploadError(null);
    setUploadedRoutine(null);
    try {
      const routine = await parseExcelToRoutine(file);
      setUploadedRoutine(routine);
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const subviews: { key: AdminSubview; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'upload', label: 'Subir Rutina' },
    { key: 'profiles', label: 'Perfiles' },
    { key: 'backup', label: 'Backup' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col p-6 pt-12"
    >
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-surface border border-border rounded-full text-zinc-400 active:scale-90">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight italic uppercase">Admin</h2>
            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest border border-purple-900/40 bg-purple-900/10 px-2 py-0.5 rounded">Panel de control</span>
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-zinc-900 border border-border rounded-xl p-1 mb-6">
        {subviews.map(({ key, label }) => (
          <button key={key} onClick={() => setSubview(key)}
            className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${subview === key ? 'bg-surface border border-border text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {/* DASHBOARD */}
        {subview === 'dashboard' && (
          <div className="space-y-4">
            {profiles.map(name => {
              const routine = routines[name] || ROUTINE_DATA;
              const isCustom = !!routines[name];
              const userHistory = history.filter(s => s.userName === name);
              const last = userHistory[0];
              return (
                <div key={name} className="bg-surface border border-border rounded-[2rem] overflow-hidden">
                  <div className="p-5 border-b border-border bg-zinc-900/30 flex items-center gap-3">
                    <Avatar name={name} src={profileImages[name]} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white">{name}</h3>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${isCustom ? 'text-brand border-brand/30 bg-brand/10' : 'text-zinc-500 border-zinc-800 bg-zinc-900'}`}>
                          {isCustom ? 'Rutina personalizada' : 'Rutina por defecto'}
                        </span>
                      </div>
                      <p className="text-[9px] text-zinc-500 mt-0.5">{routine.nombre}</p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-3 gap-2">
                    {[
                      { l: 'Sesiones', v: userHistory.length },
                      { l: 'Días rutina', v: routine.dias.length },
                      { l: 'Último', v: last ? format(new Date(last.date), 'dd/MM', { locale: es }) : '--' },
                    ].map(s => (
                      <div key={s.l} className="bg-zinc-900 rounded-xl p-3 text-center">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">{s.l}</p>
                        <p className="text-sm font-black text-white italic">{s.v}</p>
                      </div>
                    ))}
                  </div>
                  {isCustom && (
                    <div className="px-5 pb-4">
                      <button onClick={() => onResetRoutine(name)}
                        className="w-full py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-800 rounded-xl hover:border-red-500/40 hover:text-red-400 transition-all">
                        ↺ Restaurar rutina por defecto
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* UPLOAD */}
        {subview === 'upload' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-black text-white mb-2">Subir Excel de Rutina</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Cada hoja del Excel es un día. Columnas reconocidas: <span className="text-zinc-300">Ejercicio, Series, Repeticiones, RPE, Descanso (seg), Video, Observaciones</span>.
              </p>
            </div>

            <div
              ref={dropRef}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('border-brand/50', 'bg-brand/5'); }}
              onDragLeave={() => dropRef.current?.classList.remove('border-brand/50', 'bg-brand/5')}
              onDrop={(e) => { e.preventDefault(); dropRef.current?.classList.remove('border-brand/50', 'bg-brand/5'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-zinc-800 rounded-[2rem] p-10 text-center cursor-pointer transition-all hover:border-brand/30 hover:bg-brand/5"
            >
              <Upload size={28} className="text-brand mx-auto mb-3" />
              <p className="font-black text-zinc-300 mb-1">Arrastra tu Excel aquí</p>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">o haz click · .xlsx</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {uploadError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm">{uploadError}</div>
            )}

            {uploadedRoutine && (
              <div className="space-y-4">
                <div className="bg-brand/5 border border-brand/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-brand rounded-full flex items-center justify-center text-black">
                      <Check size={12} className="stroke-[4px]" />
                    </div>
                    <span className="font-black text-brand text-sm">{uploadedRoutine.nombre}</span>
                  </div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                    {uploadedRoutine.dias.length} días · {uploadedRoutine.dias.reduce((t, d) => t + d.ejercicios.length, 0)} ejercicios
                  </p>
                  {uploadedRoutine.dias.map(d => (
                    <div key={d.dia} className="bg-zinc-900/60 rounded-xl p-3 mb-2">
                      <p className="font-black text-zinc-200 text-xs mb-1">{d.nombre}</p>
                      <p className="text-[9px] text-zinc-600 leading-relaxed">{d.ejercicios.map(e => e.nombre).join(' · ')}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Asignar a:</p>
                  <div className="space-y-2">
                    {profiles.map(name => (
                      <button key={name} onClick={() => { onAssignRoutine(name, uploadedRoutine); setUploadedRoutine(null); setSubview('dashboard'); }}
                        className="w-full bg-surface border border-border rounded-2xl px-5 py-4 flex items-center justify-between hover:border-brand/30 transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} src={profileImages[name]} size="sm" />
                          <span className="font-black text-white">{name}</span>
                        </div>
                        <ArrowRight size={16} className="text-zinc-600" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Format table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Formato de columnas</p>
              <div className="overflow-x-auto">
                <table className="text-[9px] border-collapse w-full">
                  <thead>
                    <tr>{['Ejercicio', 'Series', 'Reps', 'RPE', 'Descanso', 'Video', 'Observaciones'].map(h => (
                      <th key={h} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 font-black uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    <tr>{['Sentadilla Hack', '3', '8-12', '8,9,10', '240', 'https://...', 'Baja lento'].map((v, i) => (
                      <td key={i} className="px-2 py-1.5 border border-zinc-800 text-zinc-400">{v}</td>
                    ))}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PROFILES */}
        {subview === 'profiles' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Usuarios</p>
              <button onClick={() => setAddForm(true)} className="flex items-center gap-1 text-[9px] font-black text-brand uppercase tracking-widest border border-brand/30 bg-brand/10 px-3 py-1.5 rounded-lg">
                <Plus size={12} /> Añadir
              </button>
            </div>

            {profiles.map(name => (
              <div key={name} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
                <Avatar name={name} src={profileImages[name]} size="sm" />
                <div className="flex-1">
                  <p className="font-black text-white">{name}</p>
                  <p className="text-[9px] text-zinc-600">{history.filter(s => s.userName === name).length} sesiones</p>
                </div>
                <button onClick={() => { if (confirm(`¿Eliminar "${name}"? Su historial también se borrará.`)) onRemoveProfile(name); }}
                  className="text-zinc-700 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {addForm && (
              <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Nuevo usuario</p>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand/50 transition-all" />
                <input value={newImg} onChange={e => setNewImg(e.target.value)} placeholder="URL de foto (opcional)" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-brand/50 transition-all" />
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!newName.trim()) { showToast('Escribe un nombre'); return; }
                    if (profiles.includes(newName.trim())) { showToast('Ya existe ese usuario'); return; }
                    onAddProfile(newName.trim(), newImg.trim() || undefined);
                    setNewName(''); setNewImg(''); setAddForm(false);
                  }} className="btn-primary flex-1">Añadir</button>
                  <button onClick={() => { setAddForm(false); setNewName(''); setNewImg(''); }} className="btn-secondary flex-1">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BACKUP */}
        {subview === 'backup' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-black text-white mb-2">Exportar e importar datos</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Usa esto para hacer copias de seguridad o para migrar datos entre dispositivos (por ejemplo de la PWA instalada a otra instalación).
              </p>
            </div>

            <button onClick={onExportBackup}
              className="w-full bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-brand/30 transition-all active:scale-[0.98]">
              <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                <FileDown size={20} />
              </div>
              <div className="text-left">
                <p className="font-black text-white">Exportar backup</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Descarga un .json con todos los datos</p>
              </div>
            </button>

            <div
              onClick={() => importInputRef.current?.click()}
              className="w-full bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-brand/30 transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400">
                <FileUp size={20} />
              </div>
              <div className="text-left">
                <p className="font-black text-white">Importar backup</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Carga un .json exportado previamente</p>
              </div>
            </div>
            <input ref={importInputRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportBackup(f); }} />

            <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-4">
              <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mb-1">⚠ Atención</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Al importar, los datos actuales serán reemplazados por los del archivo. Exporta primero si quieres conservar los datos actuales.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
