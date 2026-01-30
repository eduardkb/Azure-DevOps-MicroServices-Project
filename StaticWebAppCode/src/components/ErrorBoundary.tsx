import { Component, ReactNode } from 'react';
import { MessageContextType } from '../components/MessageContext';

interface Props {
  children: ReactNode;
  addMessage: MessageContextType['addMessage'];
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.addMessage('error', `Application Error: ${error.message}`);
    this.setState({ hasError: false }); // Reset to continue rendering
  }

  render() {
    return this.props.children;
  }
}

export default ErrorBoundary;