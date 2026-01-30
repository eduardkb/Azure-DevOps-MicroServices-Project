import { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { useMessage } from '../components/useMessage';

const ErrorBoundaryWrapper = ({ children }: { children: ReactNode }) => {
  const { addMessage } = useMessage();
  return <ErrorBoundary addMessage={addMessage}>{children}</ErrorBoundary>;
};

export default ErrorBoundaryWrapper;