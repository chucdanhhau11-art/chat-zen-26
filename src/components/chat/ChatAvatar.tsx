import React from 'react';
import { getInitials } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';

interface ChatAvatarProps {
  name: string;
  avatar?: string;
  online?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isBot?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
};

const dotSizes = {
  sm: 'h-2.5 w-2.5 border',
  md: 'h-3 w-3 border-2',
  lg: 'h-4 w-4 border-2',
};

const bgColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
];

const getColorFromName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return bgColors[Math.abs(hash) % bgColors.length];
};

const ChatAvatar: React.FC<ChatAvatarProps> = ({ name, avatar, online, size = 'md', isBot }) => {
  return (
    <div className="relative flex-shrink-0">
      {avatar ? (
        <img src={avatar} alt={name} className={cn('rounded-full object-cover', sizeClasses[size])} />
      ) : (
        <div className={cn(
          'rounded-full flex items-center justify-center font-semibold text-primary-foreground',
          sizeClasses[size],
          getColorFromName(name)
        )}>
          {getInitials(name)}
        </div>
      )}
      {isBot && (
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[7px] font-bold',
          size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
        )}>
          B
        </span>
      )}
      {!isBot && online !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 rounded-full border-card',
          dotSizes[size],
          online ? 'bg-tg-online' : 'bg-muted-foreground'
        )} />
      )}
    </div>
  );
};

export default ChatAvatar;
