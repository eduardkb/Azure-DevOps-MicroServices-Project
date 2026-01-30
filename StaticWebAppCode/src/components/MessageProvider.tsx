import { ReactNode, useState, useCallback } from 'react';
import { MessageContext, Message} from "./MessageContext";

export const MessageProvider = ({ children }: { children: ReactNode }) => {
    const [messages, setMessages] = useState<Message[]>([]);
  
    const removeMessage = useCallback((id: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== id));
    }, []);
    
    const addMessage = useCallback((type: Message['type'], text: string) => {
      setMessages((prev) => {
        const id = `${Date.now()}-${Math.random()}`;
        const newMessage = { id, type, text };

        // Auto-remove after 7 seconds
        setTimeout(() => {
          removeMessage(id);
        }, 7000);

        return [...prev, newMessage];
      });
    }, [removeMessage]); 
    
    const clearMessages = useCallback(() => {
      setMessages([]);
    }, []); 
  
    return (
      <MessageContext.Provider value={{ messages, addMessage, removeMessage, clearMessages }}>
        {children}
      </MessageContext.Provider>
    );
  };