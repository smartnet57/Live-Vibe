import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

export function useLiveAPI(onAppCodeUpdate: (code: string) => void, currentAppCode: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const respondedToolCallsRef = useRef<Set<string>>(new Set());

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      if (playbackContextRef.current.state !== 'closed') {
        playbackContextRef.current.close();
      }
      playbackContextRef.current = null;
    }
    
    // Close the session if it exists
    if (sessionRef.current) {
      if (typeof sessionRef.current.close === 'function') {
        sessionRef.current.close();
      }
      sessionRef.current = null;
    }
    
    // Also handle the case where the session is still connecting
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        if (session && typeof session.close === 'function') {
          session.close();
        }
      }).catch(() => {});
      sessionPromiseRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    // Clean up any existing session before starting a new one
    cleanup();
    
    setIsConnecting(true);
    setError(null);
    respondedToolCallsRef.current.clear();
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;

      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are a live vibe coding assistant. The user will speak to you and ask you to build or modify an app. 
          
          The app starts in an INITIAL STATE which is a clean white page with a vintage studio microphone in the center.
          The microphone image is available at: /assets/image3.png
          
          ${currentAppCode ? `The CURRENT CODE of the generated app (inside the iframe) is: \n\n${currentAppCode}\n\n` : 'There is currently NO generated code. The user is looking at the INITIAL STATE.'}
          
          Your task:
          1. If the user asks to modify the app and there is CURRENT CODE, modify that code.
          2. If there is NO generated code (the user is at the INITIAL STATE) and they ask for a change (e.g., "change the background to blue"), treat this as a request to CREATE a new app that incorporates their request. For example, create a full-screen app with a blue background.
          3. NEVER tell the user "there is no code to adapt". Instead, just create the code they are asking for.
          
          Technical Requirements:
          - Use the updateAppCode tool to render the app.
          - Generate complete, self-contained HTML documents. Do NOT generate multiple HTML documents in a single response.
          - Include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
          - Use vanilla JavaScript for logic.
          - Always respond with a friendly, helpful voice.
          - Briefly describe your changes BEFORE calling the tool. Do NOT speak again after the tool call completes.`,
          tools: [{
            functionDeclarations: [{
              name: "updateAppCode",
              description: "Updates the application code based on the user's request. Provide a complete HTML document.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  htmlContent: {
                    type: Type.STRING,
                    description: "The complete HTML document including Tailwind CSS via CDN and any necessary JavaScript.",
                  },
                },
                required: ["htmlContent"],
              },
            }]
          }]
        },
        callbacks: {
          onopen: async () => {
            try {
              // Double check if we are still the active session
              if (sessionPromiseRef.current !== sessionPromise) return;

              if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone API not available.");
              }
              
              const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                } 
              });
              streamRef.current = stream;
              
              const audioContext = new AudioContext({ sampleRate: 16000 });
              await audioContext.resume();
              audioContextRef.current = audioContext;
              
              const source = audioContext.createMediaStreamSource(stream);
              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              
              processor.onaudioprocess = (e) => {
                const channelData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(channelData.length);
                for (let i = 0; i < channelData.length; i++) {
                  let s = Math.max(-1, Math.min(1, channelData[i]));
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                const buffer = new Uint8Array(pcm16.buffer);
                let binary = '';
                for (let i = 0; i < buffer.length; i++) {
                  binary += String.fromCharCode(buffer[i]);
                }
                const base64 = btoa(binary);
                
                sessionPromise.then(session => {
                  // Only send if this is still the active session
                  if (sessionRef.current === session) {
                    session.sendRealtimeInput({
                      audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                    });
                  }
                });

                // Clear output buffer to prevent local echo
                const outData = e.outputBuffer.getChannelData(0);
                for (let i = 0; i < outData.length; i++) {
                  outData[i] = 0;
                }
              };
              
              source.connect(processor);
              processor.connect(audioContext.destination);
              
              setIsConnected(true);
              setIsConnecting(false);
            } catch (err: any) {
              console.error("Error accessing microphone:", err);
              setError(err.message || "Microphone access denied or failed.");
              setIsConnecting(false);
              sessionPromise.then(session => session.close());
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Only process if we are still connected
            if (!sessionRef.current) return;

            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              const base64Audio = part.inlineData?.data;
              if (base64Audio && playbackContextRef.current) {
                const binaryString = atob(base64Audio);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const pcm16 = new Int16Array(bytes.buffer);
                const audioBuffer = playbackContextRef.current.createBuffer(1, pcm16.length, 24000);
                const channelData = audioBuffer.getChannelData(0);
                for (let i = 0; i < pcm16.length; i++) {
                  channelData[i] = pcm16[i] / 32768.0;
                }
                const source = playbackContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(playbackContextRef.current.destination);
                
                const startTime = Math.max(playbackContextRef.current.currentTime, nextPlayTimeRef.current);
                source.start(startTime);
                nextPlayTimeRef.current = startTime + audioBuffer.duration;
              }
            }
            
            if (message.serverContent?.interrupted && playbackContextRef.current) {
              playbackContextRef.current.close();
              playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
              nextPlayTimeRef.current = playbackContextRef.current.currentTime;
            }
            
            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls && functionCalls.length > 0) {
                const functionResponses = [];
                for (const call of functionCalls) {
                  const callId = call.id || "";
                  if (callId && respondedToolCallsRef.current.has(callId)) {
                    continue;
                  }
                  if (callId) {
                    respondedToolCallsRef.current.add(callId);
                  }

                  if (call.name === 'updateAppCode') {
                    const htmlContent = call.args?.htmlContent as string;
                    if (htmlContent) {
                      onAppCodeUpdate(htmlContent);
                    }
                    const responseObj: any = {
                      name: call.name || "updateAppCode",
                      response: { output: { result: "success" } }
                    };
                    if (callId) responseObj.id = callId;
                    functionResponses.push(responseObj);
                  } else {
                    const responseObj: any = {
                      name: call.name || "unknown",
                      response: { error: "Unknown function call" }
                    };
                    if (callId) responseObj.id = callId;
                    functionResponses.push(responseObj);
                  }
                }
                
                if (functionResponses.length > 0) {
                  sessionPromise.then(session => {
                    if (sessionRef.current === session) {
                      session.sendToolResponse({ functionResponses });
                    }
                  });
                }
              }
            }
          },
          onclose: () => {
            setIsConnected(false);
            cleanup();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            const errorMessage = err?.message || err?.toString() || "Connection error. Check console.";
            setError(`Connection failed: ${errorMessage}`);
            setIsConnected(false);
            setIsConnecting(false);
            cleanup();
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      sessionRef.current = await sessionPromise;
      
    } catch (err: any) {
      console.error("Failed to connect to Live API:", err);
      setError(err.message || "Failed to connect");
      setIsConnecting(false);
    }
  }, [onAppCodeUpdate, currentAppCode, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    setIsConnected(false);
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { isConnected, isConnecting, error, connect, disconnect };
}
