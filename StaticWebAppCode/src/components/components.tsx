import React, { ButtonHTMLAttributes } from "react";
import { useMessage } from '../components/useMessage';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export 
const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return (
    <button className={"btn btn--primary"} {...props}>
      {children}
    </button>
  );
};

export const MessageBox = () => {
  const { messages, removeMessage } = useMessage();

  if (messages.length === 0) return null;

  return (
    <div className="message-container">
      {messages.map((message) => (
        <div key={message.id} className={`message message-${message.type}`}>
          <span className="message-text">{message.text}</span>
          <button
            className="message-close"
            onClick={() => removeMessage(message.id)}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
