import { createContext} from 'react';

export interface Message {
  id: string;
  type: 'error' | 'success' | 'warning' | 'info';
  text: string;
}

export interface MessageContextType {
  messages: Message[];
  addMessage: (type: Message['type'], text: string) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
}

export const MessageContext = createContext<MessageContextType | undefined>(undefined);

