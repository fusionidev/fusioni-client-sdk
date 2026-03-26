import {useCallback, useState} from 'react';
import {Conversation, FusioniMemoryMessage} from '../types';
import {getConversationService} from '../services/ConversationService';
import {getMessageService} from "../services/MessageService";

/** Set on `extra_data` for the local user bubble before pipeline exec; used to drop it when the server echoes the turn. */
export const FUSIONI_SDK_OPTIMISTIC_USER = 'fusion_sdk_optimistic_user' as const;

export function isFusioniSdkOptimisticUserMessage(m: FusioniMemoryMessage): boolean {
  return m.role === 'user' && m.extra_data?.[FUSIONI_SDK_OPTIMISTIC_USER] === true;
}

export const useChatState = (agencyId: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<FusioniMemoryMessage[]>([]);
  const [streamMessages, setStreamMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadConversations = useCallback(async (page: number = 0, size: number = 25) => {
    if (!agencyId) return;

    try {
      setIsLoading(true);
      const conversationService = getConversationService();
      const conversations = await conversationService.getConversationsByAgency(agencyId, page, size);
      console.log("Loaded conversations", conversations);
      setConversations(conversations);

    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [agencyId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!agencyId) return;

    try {
      setIsLoading(true);
      const messageService = getMessageService();
      const messages = await messageService.getMessages(conversationId, agencyId);
      
      // Ensure loaded messages don't have shouldAnimate flag (only new pipeline exec responses should animate)
      const messagesWithoutAnimation = messages.map(msg => ({
        ...msg,
        shouldAnimate: false
      }));
      
      setMessages(messagesWithoutAnimation);

    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [agencyId]);

  const addMessage = useCallback((message: FusioniMemoryMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<FusioniMemoryMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  /** Removes local user rows tagged with {@link FUSIONI_SDK_OPTIMISTIC_USER} (same idea as removing the loading row by id). */
  const removeOptimisticUserMessages = useCallback(() => {
    setMessages((prev) => prev.filter((m) => !isFusioniSdkOptimisticUserMessage(m)));
  }, []);

  /** Keeps messages up to and including `messageId` (used when editing a prior user turn). */
  const truncateMessagesAt = useCallback((messageId: string) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === messageId);
      if (index === -1) {
        return prev;
      }
      return prev.slice(0, index + 1);
    });
  }, []);

  const addConversation = useCallback((conversation: Conversation) => {
    setConversations(prev => [conversation, ...prev]);
  }, []);

  const removeConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(null);
      setMessages([]);
    }
  }, [currentConversation]);

  const updateConversation = useCallback((conversationId: string | null, updatedConversation: Conversation) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId ? updatedConversation : conv
    ));
  }, []);

  const clearStreamMessages = useCallback(() => {
    setStreamMessages([]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    conversations,
    currentConversation,
    messages,
    streamMessages,
    isLoading,
    setCurrentConversation,
    setStreamMessages,
    addMessage,
    updateMessage,
    removeMessage,
    removeOptimisticUserMessages,
    truncateMessagesAt,
    addConversation,
    updateConversation,
    removeConversation,
    loadConversations,
    loadMessages,
    clearStreamMessages,
    clearMessages
  };
};
