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

/** Hiển thị username dạng @handle, bỏ phần domain nếu username là email */
export const formatUsername = (username?: string | null): string => {
  if (!username) return '';
  const clean = username.replace(/^@+/, '');
  const handle = clean.includes('@') ? clean.split('@')[0] : clean;
  return `@${handle}`;
};

