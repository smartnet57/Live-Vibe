import { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveAPI } from './hooks/useLiveAPI';

const INITIAL_APP_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    body { margin: 0; overflow: hidden; }
  </style>
</head>
<body class="bg-white min-h-screen flex flex-col items-center justify-center p-4 pb-32">
  <img
    id="hero-mic"
    src="/assets/image3.png"
    alt="Studio Microphone"
    class="w-48 md:w-80 max-h-[50vh] object-contain select-none"
    draggable="false"
  />
</body>
</html>`;

export default function App() {
  const [appCode, setAppCode] = useState<string>(INITIAL_APP_CODE);
  const [showCode, setShowCode] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const { isConnected, isConnecting, error, audioLevel, isModelSpeaking, connect, disconnect } = useLiveAPI(setAppCode, appCode);

  // Scale the audio ring
  const ringScale = 1 + Math.min(audioLevel * 6, 0.8);

  return (
    <div className="relative w-full h-screen bg-white overflow-hidden font-sans text-zinc-900">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-6 left-1/2 bg-white/80 backdrop-blur-md border border-red-100 text-red-600 px-6 py-3 rounded-2xl text-sm shadow-xl z-50 flex items-center gap-3 min-w-[320px]"
          >
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always-visible app canvas */}
      <div className="absolute inset-0 flex flex-col-reverse md:flex-row w-full h-full z-10 bg-white overflow-hidden">
        {/* Code Panel */}
        <AnimatePresence>
          {showCode && (
            <motion.div
              initial={{ [isMobile ? 'height' : 'width']: 0, opacity: 0 }}
              animate={{ 
                [isMobile ? 'height' : 'width']: isMobile ? '40%' : '33.333333%', 
                [isMobile ? 'width' : 'height']: '100%',
                opacity: 1 
              }}
              exit={{ [isMobile ? 'height' : 'width']: 0, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className={`border-t md:border-t-0 md:border-r border-zinc-200 overflow-auto p-6 shadow-inner shrink-0 flex flex-col ${isLightMode ? 'bg-zinc-50' : 'bg-zinc-950'}`}
            >
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>Live Code</h3>
              </div>
              <pre className={`flex-1 text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed ${isLightMode ? 'text-zinc-800' : 'text-zinc-300'}`}>
                <code>{appCode}</code>
              </pre>
              <div className="mt-6 shrink-0 text-center">
                <p className={`text-[10px] ${isLightMode ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Gemini can make mistakes. Always double-check responses.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Panel */}
        <div className="flex-1 w-full relative bg-white min-h-0 min-w-0 flex flex-col">
          <button
            onClick={() => setShowCode(!showCode)}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 md:bottom-auto md:top-1/2 md:left-0 md:-translate-y-1/2 md:translate-x-0 z-50 flex items-center justify-center w-14 h-6 md:w-6 md:h-14 bg-white border border-zinc-300 border-b-0 md:border-b md:border-l-0 rounded-t-lg md:rounded-t-none md:rounded-r-lg shadow-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all"
            title={showCode ? "Hide Code" : "Show Code"}
          >
            {isMobile ? (
              showCode ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
            ) : (
              showCode ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <iframe
            srcDoc={appCode}
            className="flex-1 w-full border-none"
            title="Live App"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {/* Floating Mic Button - Now inside Preview Panel */}
          <motion.div 
            layout
            initial={false}
            animate={{
              left: isConnected ? '2rem' : '50%',
              bottom: isConnected ? '2rem' : '6rem',
              x: isConnected ? '0%' : '-50%',
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="absolute z-50"
          >
            <div className="relative group">
              {/* Audio Level Ring */}
              {isConnected && (
                <motion.div
                  className="absolute rounded-full border-2 pointer-events-none"
                  style={{
                    inset: '-6px',
                    borderColor: isModelSpeaking 
                      ? 'rgba(59, 130, 246, 0.5)' 
                      : (isLightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(24, 24, 27, 0.3)'),
                  }}
                  animate={{ 
                    scale: isModelSpeaking ? [1, 1.15, 1] : ringScale,
                    opacity: isModelSpeaking ? [0.4, 0.8, 0.4] : Math.min(audioLevel * 10, 1),
                  }}
                  transition={isModelSpeaking ? { duration: 1.2, repeat: Infinity } : { duration: 0.05 }}
                />
              )}

              {/* Pulse effect when connected */}
              {isConnected && (
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute -inset-4 rounded-full ${isLightMode ? 'bg-red-500/20' : 'bg-zinc-900/20'}`}
                />
              )}
              
              <button
                onClick={isConnected ? disconnect : connect}
                disabled={isConnecting}
                className={`
                  relative flex items-center justify-center rounded-full 
                  transition-all duration-500
                  ${isConnected 
                    ? (isLightMode ? 'bg-white text-red-500 border border-red-100 w-12 h-12 shadow-[0_20px_50px_rgba(0,0,0,0.1)]' : 'bg-zinc-800 text-red-400 border border-zinc-700 w-12 h-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)]') 
                    : (isLightMode ? 'bg-white text-zinc-900 hover:scale-105 active:scale-95 border border-zinc-100 w-16 h-16 shadow-[0_20px_50px_rgba(0,0,0,0.1)]' : 'bg-zinc-900 text-white hover:scale-105 active:scale-95 border border-zinc-800 w-16 h-16 shadow-[0_20px_50px_rgba(0,0,0,0.3)]')
                  }
                  ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isConnecting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isConnected ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>
              
              {/* Status Label */}
              <AnimatePresence>
                {!isConnected && !isConnecting && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] pl-[0.2em] text-zinc-400"
                  >
                    Start Coding
                  </motion.div>
                )}
                {isConnecting && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] pl-[0.2em] text-zinc-400"
                  >
                    Initializing...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setIsLightMode(!isLightMode)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm"
          title={isLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </motion.button>

        {appCode !== INITIAL_APP_CODE && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setAppCode(INITIAL_APP_CODE)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-md border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm font-medium text-sm"
            title="Reset to initial state"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
