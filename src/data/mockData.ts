export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  online: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  replyTo?: string;
  edited?: boolean;
  reactions?: { emoji: string; userIds: string[] }[];
}

export interface Conversation {
  id: string;
  type: 'private' | 'group' | 'channel';
  name: string;
  avatar?: string;
  lastMessage?: Message;
  unreadCount: number;
  members: User[];
  pinned?: boolean;
  muted?: boolean;
}

export const MOCK_USERS: User[] = [
  { id: '1', username: 'admin', displayName: 'Admin', online: true },
  { id: '2', username: 'alice', displayName: 'Alice Nguyen', online: true },
  { id: '3', username: 'bob', displayName: 'Bob Tran', online: false, lastSeen: new Date(Date.now() - 1800000) },
  { id: '4', username: 'charlie', displayName: 'Charlie Le', online: true },
  { id: '5', username: 'david', displayName: 'David Pham', online: false, lastSeen: new Date(Date.now() - 7200000) },
  { id: '6', username: 'emma', displayName: 'Emma Vo', online: true },
];

export const CURRENT_USER = MOCK_USERS[0];

const now = Date.now();

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    type: 'private',
    name: 'Alice Nguyen',
    unreadCount: 3,
    members: [MOCK_USERS[0], MOCK_USERS[1]],
    lastMessage: {
      id: 'm1', senderId: '2', text: 'Hey! Bạn khỏe không? 😊', timestamp: new Date(now - 60000), status: 'delivered',
    },
  },
  {
    id: 'c2',
    type: 'group',
    name: 'Team Dev 🚀',
    unreadCount: 12,
    pinned: true,
    members: [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[2], MOCK_USERS[3]],
    lastMessage: {
      id: 'm2', senderId: '3', text: 'Deploy xong rồi nhé!', timestamp: new Date(now - 300000), status: 'read',
    },
  },
  {
    id: 'c3',
    type: 'channel',
    name: 'Tech News 📰',
    unreadCount: 0,
    members: MOCK_USERS,
    lastMessage: {
      id: 'm3', senderId: '1', text: 'React 19 đã chính thức ra mắt...', timestamp: new Date(now - 3600000), status: 'read',
    },
  },
  {
    id: 'c4',
    type: 'private',
    name: 'Bob Tran',
    unreadCount: 0,
    members: [MOCK_USERS[0], MOCK_USERS[2]],
    lastMessage: {
      id: 'm4', senderId: '1', text: 'OK, mai mình gặp nhé', timestamp: new Date(now - 86400000), status: 'read',
    },
  },
  {
    id: 'c5',
    type: 'private',
    name: 'David Pham',
    unreadCount: 1,
    members: [MOCK_USERS[0], MOCK_USERS[4]],
    lastMessage: {
      id: 'm5', senderId: '5', text: 'Gửi file cho mình nhé', timestamp: new Date(now - 43200000), status: 'delivered',
    },
  },
  {
    id: 'c6',
    type: 'group',
    name: 'Weekend Trip 🏖️',
    unreadCount: 0,
    muted: true,
    members: [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[4], MOCK_USERS[5]],
    lastMessage: {
      id: 'm6', senderId: '6', text: 'Mình đã book khách sạn rồi!', timestamp: new Date(now - 172800000), status: 'read',
    },
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: 'm1-1', senderId: '1', text: 'Chào Alice!', timestamp: new Date(now - 3600000), status: 'read' },
    { id: 'm1-2', senderId: '2', text: 'Chào Admin! 👋', timestamp: new Date(now - 3500000), status: 'read' },
    { id: 'm1-3', senderId: '1', text: 'Dự án mới thế nào rồi?', timestamp: new Date(now - 3400000), status: 'read' },
    { id: 'm1-4', senderId: '2', text: 'Đang tiến triển tốt lắm! Mình đã hoàn thành phần UI rồi 🎉', timestamp: new Date(now - 3300000), status: 'read' },
    { id: 'm1-5', senderId: '2', text: 'Tuần sau sẽ bắt đầu tích hợp backend', timestamp: new Date(now - 3200000), status: 'read' },
    { id: 'm1-6', senderId: '1', text: 'Tuyệt vời! Cần hỗ trợ gì cứ nói nhé', timestamp: new Date(now - 3100000), status: 'read' },
    { id: 'm1-7', senderId: '2', text: 'Cảm ơn bạn! Có thể cần review code vào thứ 4', timestamp: new Date(now - 600000), status: 'read' },
    { id: 'm1-8', senderId: '1', text: 'OK, mình sẽ sắp xếp 👍', timestamp: new Date(now - 300000), status: 'read' },
    { id: 'm1-9', senderId: '2', text: 'Hey! Bạn khỏe không? 😊', timestamp: new Date(now - 60000), status: 'delivered' },
  ],
  c2: [
    { id: 'm2-1', senderId: '3', text: 'Mọi người ơi, mình vừa push code mới', timestamp: new Date(now - 7200000), status: 'read' },
    { id: 'm2-2', senderId: '4', text: 'OK mình sẽ review', timestamp: new Date(now - 7000000), status: 'read' },
    { id: 'm2-3', senderId: '1', text: 'Nhớ chạy test trước khi merge nhé', timestamp: new Date(now - 6800000), status: 'read' },
    { id: 'm2-4', senderId: '2', text: 'Tests all passed ✅', timestamp: new Date(now - 600000), status: 'read' },
    { id: 'm2-5', senderId: '3', text: 'Deploy xong rồi nhé!', timestamp: new Date(now - 300000), status: 'read' },
  ],
};
