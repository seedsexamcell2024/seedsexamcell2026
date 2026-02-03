
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { Kernel } from './services/autonomousKernel.ts';
import { SIDE } from './services/databaseEngine.ts';
import { institutionalBoot } from './services/dbService.ts';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * SEEDS INSTITUTIONAL ERROR BOUNDARY
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical System Protocol Failure:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-950 font-sans p-10 overflow-hidden text-center">
          <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-t-[16px] border-red-600 max-w-lg relative">
            <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-red-600 shadow-xl">
              <i className="fas fa-shield-virus text-4xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Integrity Interrupted</h2>
            <p className="text-xs text-slate-400 font-bold uppercase leading-relaxed mb-10 tracking-widest">
              An unexpected registry exception occurred.
            </p>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }} 
              className="w-full bg-rose-600 text-white py-6 rounded-3xl font-black shadow-2xl active:scale-95 uppercase tracking-widest"
            >
              PURGE & REBOOT
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const initializePortal = () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    
    // RENDER IMMEDIATELY: Show the UI shell before any database/network calls
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );

    // ASYNCHRONOUS BOOT: Database and Kernel load in the background
    const startServices = async () => {
      try {
        await SIDE.init();
        await institutionalBoot(); 
        Kernel.runSelfDiagnostic(); 
      } catch (e) {
        console.warn("Background Service Warning:", e);
      }
    };
    
    // Defer execution slightly to let React finish its first frame
    setTimeout(startServices, 10);
  }
};

initializePortal();
