export interface Exercise {
  id: string;
  nombre: string;
  series: number;
  repeticiones: string;
  intensidad_rpe: number[];
  descanso_segundos: number;
  video: string;
  observaciones: string;
}

export interface Day {
  dia: number;
  nombre: string;
  ejercicios: Exercise[];
}

export interface Routine {
  nombre: string;
  dias: Day[];
}

export interface SetRecord {
  weight: string;
  timestamp: string;
}

export interface ExerciseRecord {
  [setIndex: string]: SetRecord;
}

export interface WorkoutSession {
  id: string;
  dayName: string;
  userName: string;
  date: string;
  exercises: {
    id: string;
    nombre: string;
    sets: string[];
  }[];
}
