import { Conversation, Message, MOCK_CONVERSATIONS, MOCK_MESSAGES } from '@/data/mockData';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  searchQuery: string;
  showInfoPanel: boolean;
  darkMode: boolean;
}

export const initialChatState: ChatState = {
  conversations: MOCK_CONVERSATIONS,
  activeConversationId: null,
  messages: MOCK_MESSAGES,
  searchQuery: '',
  showInfoPanel: false,
  darkMode: true,
};
