import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 24) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  if (hours < 168) {
    return date.toLocaleDateString('vi-VN', { weekday: 'short' });
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const formatLastSeen = (date: Date): string => {
  return `seen ${formatDistanceToNow(date, { addSuffix: true })}`;
};

export const getInitials = (name: string): string => {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

/** Hiển thị username đúng như trong hệ thống, bỏ ký tự @ và phần domain nếu là email */
export const formatUsername = (username?: string | null): string => {
  if (!username) return '';
  const clean = username.replace(/^@+/, '');
  return clean.includes('@') ? clean.split('@')[0] : clean;
};

/** Ngưỡng coi là online: có cờ online và last_seen còn mới */
export const ONLINE_THRESHOLD_MS = 45_000;

export const computeOnline = (p: { online?: boolean | null; last_seen?: string | null }): boolean => {
  if (!p?.online) return false;
  if (!p.last_seen) return false;
  return Date.now() - new Date(p.last_seen).getTime() < ONLINE_THRESHOLD_MS;
};


