import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Conversation, Message, MOCK_CONVERSATIONS, MOCK_MESSAGES, CURRENT_USER } from '@/data/mockData';

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  messages: Record<string, Message[]>;
  sendMessage: (conversationId: string, text: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showInfoPanel: boolean;
  toggleInfoPanel: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  activeConversation: Conversation | null;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>(MOCK_MESSAGES);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
  }, []);

  const sendMessage = useCallback((conversationId: string, text: string) => {
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: CURRENT_USER.id,
      text,
      timestamp: new Date(),
      status: 'sent',
    };
    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMsg],
    }));
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId
          ? { ...c, lastMessage: newMsg }
          : c
      )
    );
  }, []);

  const toggleInfoPanel = useCallback(() => setShowInfoPanel(p => !p), []);
  const toggleDarkMode = useCallback(() => setDarkMode(p => !p), []);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  return (
    <ChatContext.Provider value={{
      conversations, activeConversationId, setActiveConversation,
      messages, sendMessage, searchQuery, setSearchQuery,
      showInfoPanel, toggleInfoPanel, darkMode, toggleDarkMode,
      activeConversation,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
