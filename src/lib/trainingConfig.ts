import { Video, KeyRound, Building2, MonitorPlay, BookOpen, Play, Image as ImageIcon, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ContentType = 'VIDEO' | 'IMAGE' | 'GUIDE';
export type Level = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
export type Status = 'DRAFT' | 'PUBLISHED' | 'INACTIVE';

export type TrainingCategory = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

export type TrainingContent = {
  id: string;
  title: string;
  description: string;
  category_id: string;
  content_type: ContentType;
  level: Level;
  drive_url: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  display_order: number;
  status: Status;
  created_at: string;
  updated_at: string;
};

export const TYPE_LABEL: Record<ContentType, string> = {
  VIDEO: 'Video',
  IMAGE: 'Imagen / Infografía',
  GUIDE: 'Guía visual',
};
export const TYPE_ICON: Record<ContentType, LucideIcon> = { VIDEO: Play, IMAGE: ImageIcon, GUIDE: FileText };

export const LEVEL_LABEL: Record<Level, string> = { BASIC: 'Básico', INTERMEDIATE: 'Intermedio', ADVANCED: 'Avanzado' };
export const LEVEL_BADGE: Record<Level, string> = {
  BASIC: 'bg-emerald-50 text-emerald-700',
  INTERMEDIATE: 'bg-amber-50 text-amber-700',
  ADVANCED: 'bg-red-50 text-red-700',
};

// In the database the status is stored in English; people see it in Spanish.
export const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Borrador', PUBLISHED: 'Publicado', INACTIVE: 'Inactivo' };
export const STATUS_BADGE: Record<Status, string> = {
  DRAFT: 'bg-ink-100 text-ink-600',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-amber-50 text-amber-700',
};

// Icon by category name. Any new category the administrator creates simply gets the generic book icon.
export function categoryIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes('cctv')) return Video;
  if (n.includes('acceso')) return KeyRound;
  if (n.includes('bms')) return Building2;
  if (n.includes('dss')) return MonitorPlay;
  return BookOpen;
}

export function fmtDuration(minutes?: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}
