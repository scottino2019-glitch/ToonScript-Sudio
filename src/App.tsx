/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Download, 
  Settings, 
  User, 
  Map as MapIcon, 
  MessageSquare,
  Volume2,
  Video,
  StopCircle,
  RefreshCw,
  Languages,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import html2canvas from 'html2canvas';
import { BACKGROUNDS, CHARACTERS, Dialogue, VideoProject } from './constants';

// Initialize Gemini AI
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// --- Character Component ---
interface CharacterAvatarProps {
  id: string;
  color: string;
  image: string;
  isSpeaking: boolean;
  key?: any;
}

const CharacterAvatar = ({ id, color, image, isSpeaking }: CharacterAvatarProps) => (
  <motion.div
    animate={isSpeaking ? { 
      y: [0, -15, 0], 
      scale: [1, 1.1, 1],
    } : { y: 0, scale: 1 }}
    transition={isSpeaking ? { repeat: Infinity, duration: 0.4 } : {}}
    className="relative flex flex-col items-center"
  >
    {/* The Character Image */}
    <div className="relative group">
      <div className={`w-48 h-64 flex items-center justify-center overflow-hidden transition-all ${isSpeaking ? 'drop-shadow-[0_0_20px_white]' : 'drop-shadow-lg'}`}>
        <img 
          src={image} 
          alt="Character" 
          className="max-w-full max-h-full object-contain"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={(e) => {
            // High quality graphical fallback
            if (!e.currentTarget.src.includes('bottts')) {
              e.currentTarget.src = `https://api.dicebear.com/9.x/bottts/png?seed=${encodeURIComponent(id)}&backgroundColor=b6e3f4`;
            }
          }}
        />
      </div>
      
      {/* Speaking Indicator */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-widest shadow-2xl z-20 whitespace-nowrap"
          >
            Sta parlando...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </motion.div>
);

export default function App() {
  const [project, setProject] = useState<VideoProject>({
    id: Math.random().toString(36).substr(2, 9),
    name: 'Nuovo Script',
    backgroundId: 'street',
    dialogues: [{ id: '1', characterId: 'char1', text: 'Ciao! Come va?', lang: 'it-IT', voiceIndex: 0 }],
    visibleCharacterIds: ['char1', 'char2'],
    updatedAt: Date.now()
  });
  const [library, setLibrary] = useState<VideoProject[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [customCharacters, setCustomCharacters] = useState<{id: string, name: string, image: string, color: string, gender?: string}[]>([]);
  const [showCustomCharModal, setShowCustomCharModal] = useState(false);
  const [newCharData, setNewCharData] = useState({ name: '', url: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const isRecordingRef = useRef(false);

  // Sync isRecording with ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  const currentSpeakerId = currentDialogueIndex >= 0 ? project.dialogues[currentDialogueIndex]?.characterId : null;
  
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const allCharacters = useMemo(() => {
    return [...CHARACTERS, ...(customCharacters || [])] as { id: string, name: string, image: string, color: string, gender?: string }[];
  }, [customCharacters]);

  // Load voices and projects
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const savedLibrary = localStorage.getItem('toonscript_library');
    if (savedLibrary) {
      setLibrary(JSON.parse(savedLibrary));
    }

    const savedCustomChars = localStorage.getItem('toonscript_custom_chars');
    if (savedCustomChars) {
      setCustomCharacters(JSON.parse(savedCustomChars));
    }
  }, []);

  // Save custom characters
  useEffect(() => {
    localStorage.setItem('toonscript_custom_chars', JSON.stringify(customCharacters));
  }, [customCharacters]);

  // Auto-save project to library
  useEffect(() => {
    if (isPlaying || isRecording) return;
    const timer = setTimeout(() => {
      if (!project.id) return;
      setLibrary(prev => {
        const index = prev.findIndex(p => p.id === project.id);
        const updatedProject = { ...project, updatedAt: Date.now() };
        if (index >= 0) {
          // Check if it's actually different to avoid infinite loops
          if (JSON.stringify(prev[index]) === JSON.stringify(updatedProject)) return prev;
          const newLibrary = [...prev];
          newLibrary[index] = updatedProject;
          return newLibrary;
        } else {
          const newLibrary = [updatedProject, ...prev];
          return newLibrary;
        }
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [project, isPlaying, isRecording]);

  // Sync Library to LocalStorage
  useEffect(() => {
    localStorage.setItem('toonscript_library', JSON.stringify(library));
  }, [library]);

  const currentVoices = useMemo(() => {
    return [...voices].sort((a, b) => a.lang.localeCompare(b.lang));
  }, [voices]);

  const addDialogue = () => {
    const nextCharId = project.dialogues.length % 2 === 0 ? 'char1' : 'char2';
    const char = allCharacters.find(c => c.id === nextCharId);
    
    // Find a suitable voice for the character gender
    const lang = 'it-IT';
    const langVoices = currentVoices.filter(v => 
      v.lang.startsWith(lang.split('-')[0])
    );
    let voiceIndex = 0;
    
    if (char && char.gender && langVoices.length > 0) {
      const genderVoiceIndex = langVoices.findIndex(v => 
        v.name.toLowerCase().includes(char.gender!)
      );
      if (genderVoiceIndex !== -1) voiceIndex = genderVoiceIndex;
    }

    const newDialogue: Dialogue = {
      id: Math.random().toString(36).substr(2, 9),
      characterId: nextCharId,
      text: '',
      lang: lang,
      voiceIndex: voiceIndex
    };
    setProject(prev => ({ ...prev, dialogues: [...prev.dialogues, newDialogue] }));
  };

  const removeDialogue = (id: string) => {
    setProject(prev => ({ ...prev, dialogues: prev.dialogues.filter(d => d.id !== id) }));
  };

  const updateDialogue = (id: string, updates: Partial<Dialogue>) => {
    setProject(prev => ({
      ...prev,
      dialogues: prev.dialogues.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  };

  const startRecording = async () => {
    if (!stageRef.current) return;
    
    let combinedStream: MediaStream | null = null;
    let displayStream: MediaStream | null = null;

    try {
      // Step 1: Capture the screen/tab for AUDIO
      // Browsers requires user interaction for this
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          //@ts-ignore - Some browsers support this to suggest tab audio
          suppressLocalAudioPlayback: false
        }
      } as any);

      const audioTrack = displayStream.getAudioTracks()[0];
      if (!audioTrack) {
        alert("ATTENZIONE: Hai condiviso lo schermo ma non l'audio della scheda. Il video non avrà suono. Assicurati di spuntare 'Condividi audio' (o 'Share audio') prima di confermare!");
      }

      // Step 2: Use a canvas stream for the video to keep it clean
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = 1280;
      captureCanvas.height = 720;
      const ctx = captureCanvas.getContext('2d');
      if (!ctx) return;

      const canvasStream = captureCanvas.captureStream(30);
      
      const tracks = [canvasStream.getVideoTracks()[0]];
      if (audioTrack) tracks.push(audioTrack);
      
      combinedStream = new MediaStream(tracks);

      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(combinedStream, { 
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000 
      });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        displayStream?.getTracks().forEach(t => t.stop());
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Start rendering loop for the canvas
      let lastFrameTime = 0;
      const frameRate = 12; // Sufficient for this type of animation
      const interval = 1000 / frameRate;

      const recordFrame = async (timestamp: number) => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive' || !isRecordingRef.current) return;
        
        if (timestamp - lastFrameTime >= interval) {
          try {
            const canvas = await html2canvas(stageRef.current!, {
              useCORS: true,
              scale: 1, 
              backgroundColor: '#1a1a1c',
              logging: false,
              imageTimeout: 30000, // Increased timeout for slow assets
              ignoreElements: (el) => el.classList.contains('pointer-events-none') || el.classList.contains('export-ignore')
            });
            ctx.drawImage(canvas, 0, 0, captureCanvas.width, captureCanvas.height);
            lastFrameTime = timestamp;
          } catch (err) {
            console.error("Frame capture error:", err);
          }
        }
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && isRecordingRef.current) {
          requestAnimationFrame(recordFrame);
        }
      };
      
      requestAnimationFrame(recordFrame);
      
      // Delay playback slightly to allow recorder to stabilize
      setTimeout(() => {
        if (isRecordingRef.current) {
          playSequence(false);
        }
      }, 1000);

    } catch (err) {
      console.warn("Registrazione annullata o fallita", err);
      setIsRecording(false);
      return;
    }
  };

  const playSequence = async (intentToRecord: boolean = false) => {
    if (isPlaying) return;
    
    if (intentToRecord) {
      await startRecording();
      return;
    }

    setIsPlaying(true);
    const speakerQueue = [...project.dialogues];
    
    for (let i = 0; i < speakerQueue.length; i++) {
      setCurrentDialogueIndex(i);
      const dialogue = speakerQueue[i];
      
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(dialogue.text);
        utterance.lang = dialogue.lang;
        
        // Find matching voice if possible
        const voice = currentVoices.find((v, idx) => {
          const langMatches = v.lang === dialogue.lang;
          // This is a rough estimation of index within the filtered list
          return langMatches; 
        });
        
        // Better voice matching:
        const langVoices = currentVoices.filter(v => v.lang === dialogue.lang);
        const selectedVoice = langVoices[dialogue.voiceIndex] || langVoices[0];
        if (selectedVoice) utterance.voice = selectedVoice;

        utterance.onend = () => {
          setTimeout(resolve, 500); // Small pause between speakers
        };
        
        window.speechSynthesis.speak(utterance);
      });
    }

    setCurrentDialogueIndex(-1);
    setIsPlaying(false);
    
    if (isRecordingRef.current) {
      stopRecording();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const deleteProjectFromLibrary = (id: string) => {
    if (!window.confirm("Eliminare questo script definitivamente?")) return;
    
    setLibrary(prev => {
      const newLib = prev.filter(p => p.id !== id);
      localStorage.setItem('toonscript_library', JSON.stringify(newLib));
      return newLib;
    });

    if (project.id === id) {
      resetProject();
    }
  };

  const toggleCharacterPresence = (id: string) => {
    setProject(prev => {
      const isVisible = prev.visibleCharacterIds.includes(id);
      return {
        ...prev,
        visibleCharacterIds: isVisible 
          ? prev.visibleCharacterIds.filter(cid => cid !== id)
          : [...prev.visibleCharacterIds, id]
      };
    });
  };

  const addCustomCharacter = () => {
    if (newCharData.name && newCharData.url) {
      const newChar = {
        id: `custom_${Date.now()}`,
        name: newCharData.name,
        image: newCharData.url,
        color: '#ffffff',
        gender: 'male' // Default
      };
      setCustomCharacters(prev => [...prev, newChar]);
      setProject(prev => ({
        ...prev,
        visibleCharacterIds: [...prev.visibleCharacterIds, newChar.id]
      }));
      setNewCharData({ name: '', url: '' });
      setShowCustomCharModal(false);
    }
  };

  const resetProject = () => {
    console.log("Resetting project...");
    const newId = Math.random().toString(36).substr(2, 9);
    setProject({
      id: newId,
      name: 'Nuovo Script',
      backgroundId: 'street',
      dialogues: [{ id: Math.random().toString(36).substr(2, 9), characterId: 'char1', text: '', lang: 'it-IT', voiceIndex: 0 }],
      visibleCharacterIds: ['char1', 'char2', 'char3', 'char4'],
      updatedAt: Date.now()
    });
    setCurrentDialogueIndex(-1);
    window.speechSynthesis.cancel();
  };

  const activeBackground = BACKGROUNDS.find(b => b.id === project.backgroundId);

  const testDialogue = (id: string) => {
    const dialogue = project.dialogues.find(d => d.id === id);
    if (!dialogue || !dialogue.text) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(dialogue.text);
    utterance.lang = dialogue.lang;
    const langVoices = currentVoices.filter(v => v.lang === dialogue.lang);
    const selectedVoice = langVoices[dialogue.voiceIndex] || langVoices[0];
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
  };

  const translateDialogue = async (id: string, targetLang: string) => {
    const dialogue = project.dialogues.find(d => d.id === id);
    if (!dialogue || !dialogue.text) return;

    setIsTranslating(id);
    try {
      const langNames: Record<string, string> = {
        'it-IT': 'Italiano',
        'en-US': 'English (US)',
        'en-GB': 'English (UK)',
        'fr-FR': 'Français',
        'es-ES': 'Español',
        'de-DE': 'Deutsch',
        'ja-JP': '日本語'
      };

      const targetLangName = langNames[targetLang] || targetLang;

      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`Traduci la seguente frase in ${targetLangName}. 
        Restituisci SOLO il testo tradotto, senza virgolette o spiegazioni. 
        Contesto: Uno script per un video animato di ToonScript.
        Testo: "${dialogue.text}"`);

      const response = await result.response;
      const text = response.text();
      
      if (!text) {
        throw new Error("Risposta vuota dall'IA");
      }

      const translatedText = text.trim();
      
      updateDialogue(id, { 
        text: translatedText,
        lang: targetLang
      });
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(null);
    }
  };

  const translateAll = async () => {
    const targetLang = project.dialogues[0]?.lang || 'en-US';
    if (!confirm(`Vuoi tradurre tutto lo script in automatico verso la lingua selezionata (${targetLang})?`)) return;
    
    for (const dialogue of project.dialogues) {
      if (dialogue.text && dialogue.lang === targetLang) {
        // Already in target lang? Or maybe user wants to translate everything from Italian.
        // Let's assume they want to translate everything that isn't the target lang,
        // or just apply it to all lines with text.
        await translateDialogue(dialogue.id, targetLang);
      } else if (dialogue.text) {
        await translateDialogue(dialogue.id, targetLang);
      }
    }
  };

  return (
    <div className="h-screen bg-[#121214] text-white font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#1a1a1c] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 to-pink-500 rounded-lg flex items-center justify-center">
            <Video size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tighter uppercase italic leading-none">ToonScript Studio</h1>
            <input 
              value={project.name}
              onChange={(e) => setProject(p => ({ ...p, name: e.target.value }))}
              className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-white/40 uppercase tracking-widest p-0 mt-1"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={resetProject}
            className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all"
          >
            Reset
          </button>
          <div className="flex gap-2 bg-black/40 p-1 rounded-full border border-white/5">
            <button 
              onClick={() => playSequence(false)}
              disabled={isPlaying}
              className="px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-white text-black transition-all disabled:opacity-50"
            >
              Anteprima
            </button>
            <button 
              onClick={() => setShowLibrary(true)}
              className="px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full text-white/50 hover:text-white transition-all"
            >
              Library
            </button>
          </div>
          
          <button 
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href",     dataStr);
              downloadAnchorNode.setAttribute("download", project.name.toLowerCase().replace(/\s+/g, '-') + ".json");
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            }}
            className="bg-blue-600 hover:bg-blue-500 px-8 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 mr-2"
          >
            Salva File
          </button>

          <button 
            onClick={() => playSequence(true)}
            disabled={isPlaying}
            className="bg-pink-600 hover:bg-pink-500 px-8 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50"
          >
            {isRecording ? "Registrando..." : "Esporta Video"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Assets */}
        <aside className="w-80 border-r border-white/10 flex flex-col bg-[#161618] overflow-y-auto custom-scrollbar">
          <div className="p-8 space-y-10">
            {/* Characters Selection */}
            <section>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-[10px] font-black uppercase text-pink-500 tracking-widest">Personaggi</h2>
                <button 
                  onClick={() => setShowCustomCharModal(true)}
                  className="text-[9px] text-white/40 hover:text-white uppercase font-bold tracking-wider transition-colors"
                >
                  + Aggiungi Tuo
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {allCharacters.length === 0 && <p className="col-span-2 text-center text-[10px] text-white/20">Caricamento...</p>}
                {allCharacters.map((char) => (
                  <div 
                    key={char.id}
                    onClick={() => toggleCharacterPresence(char.id)}
                    className={`aspect-square bg-white/5 rounded-2xl border-2 flex flex-col items-center justify-center p-2 group cursor-pointer transition-all hover:bg-white/10 ${
                      project.visibleCharacterIds.includes(char.id)
                      ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.2)]' 
                      : 'border-white/10'
                    }`}
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                      <img 
                        src={char.image} 
                        alt={char.name} 
                        className="w-12 h-12 object-contain mb-2"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(char.name)}&background=${char.color.replace('#', '')}&color=fff`;
                        }}
                      />
                      <span className="text-[10px] font-black uppercase tracking-tighter text-white/70 text-center line-clamp-1">{char.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Backgrounds Selection */}
            <section>
              <h2 className="text-[10px] font-black uppercase text-yellow-400 tracking-widest mb-6">Scenari</h2>
              <div className="space-y-3">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setProject(p => ({ ...p, backgroundId: bg.id }))}
                    className={`w-full h-20 rounded-xl flex items-center p-3 border transition-all group overflow-hidden relative ${
                      project.backgroundId === bg.id 
                      ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' 
                      : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="absolute inset-0 z-0 opacity-40">
                       <img src={bg.style.image} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all text-white text-[8px]" />
                    </div>
                    <div className="relative z-10 flex items-center">
                      <span className="text-2xl mr-4 drop-shadow-md">
                        {bg.id === 'street' && '🛣️'}
                        {bg.id === 'museum' && '🏛️'}
                        {bg.id === 'shop' && '🛍️'}
                        {bg.id === 'school' && '🏫'}
                        {bg.id === 'hotel' && '🏨'}
                        {bg.id === 'bar' && '☕'}
                        {bg.id === 'airport' && '✈️'}
                        {bg.id === 'restaurant' && '🍽️'}
                      </span>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${project.backgroundId === bg.id ? 'text-white' : 'text-white/60'}`}>
                        {bg.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col p-10 bg-[#0e0e10] overflow-y-auto custom-scrollbar">
          {/* Preview Canvas */}
          <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-[10px] border-[#1a1a1c] shadow-2xl bg-[#2a2a2e] group shrink-0">
            {/* The actual stage */}
            <div 
              ref={stageRef}
              className="absolute inset-0 flex items-end justify-around px-20 pb-16 transition-all duration-1000"
              style={{ 
                backgroundImage: `url(${activeBackground?.style.image}), ${activeBackground?.style.gradient || 'none'}`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#1a1a1c'
              }}
            >
              {/* Overlay to dim background for characters and text */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none"></div>

              {/* Characters */}
              <div className="relative w-full h-full flex items-end justify-around z-10">
                {allCharacters.filter(char => 
                  project.visibleCharacterIds.includes(char.id)
                ).map((char) => (
                  <CharacterAvatar 
                    key={char.id} 
                    id={char.id}
                    color={char.color} 
                    image={char.image}
                    isSpeaking={currentSpeakerId === char.id} 
                  />
                ))}
              </div>

              {/* Subtitles Overlay */}
              <AnimatePresence>
                {currentDialogueIndex >= 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[85%] text-center z-20"
                  >
                    <div className="bg-black/85 backdrop-blur-md px-10 py-5 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                      <p className="text-2xl font-serif italic text-white leading-tight">
                        "{project.dialogues[currentDialogueIndex].text}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stage Info Overlays */}
            <div className="absolute top-8 left-8 flex gap-3 z-30 pointer-events-none">
              <div className="px-4 py-1.5 bg-black/60 backdrop-blur-md border border-white/5 rounded text-[10px] font-mono tracking-widest text-white/80 uppercase">
                {activeBackground?.name}
              </div>
              <div className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${isPlaying ? 'bg-pink-600 text-white animate-pulse' : 'bg-white/10 text-white/40'}`}>
                {isPlaying ? (isRecording ? 'REGISTRANDO VIDEO' : 'RIPRODUZIONE') : 'IDLE'}
              </div>
            </div>
            {isRecording && (
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-40 pointer-events-none">
                <div className="bg-pink-600 text-white px-8 py-3 rounded-full font-black text-[12px] uppercase tracking-widest flex items-center gap-4 shadow-2xl">
                  <RefreshCw className="animate-spin" size={18} />
                  Rendering Video...
                </div>
              </div>
            )}
          </div>

          {/* Dialogue Script Editor */}
          <div className="mt-10 flex flex-col space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Editor Sequenza</h3>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Script dei Dialoghi</h2>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={translateAll}
                  disabled={isTranslating !== null}
                  className="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all flex items-center gap-2"
                >
                  <Languages size={14} />
                  Traduci Tutto
                </button>
                <button 
                  onClick={addDialogue}
                  className="bg-white text-black px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pink-500 hover:text-white transition-all shadow-xl"
                >
                  + Nuova Battuta
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <AnimatePresence initial={false}>
                {project.dialogues.map((dialogue, idx) => (
                  <motion.div
                    key={dialogue.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={`bg-[#1a1a1c] rounded-3xl p-8 border transition-all flex flex-col md:flex-row gap-8 ${
                      currentDialogueIndex === idx 
                      ? 'border-pink-500/50 bg-[#1e1e24]' 
                      : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Speaker Info */}
                    <div className="w-full md:w-56 shrink-0 flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <div className="px-3 py-1 bg-white/5 rounded text-[10px] font-mono text-white/40">#{idx + 1}</div>
                        <div className="flex gap-2">
                           <button 
                            onClick={() => translateDialogue(dialogue.id, dialogue.lang)}
                            disabled={isTranslating === dialogue.id}
                            className={`text-white/20 hover:text-cyan-400 transition-all p-1 ${isTranslating === dialogue.id ? 'animate-spin' : ''}`}
                            title="Traduci Automaticamente"
                          >
                            {isTranslating === dialogue.id ? <Loader2 size={16} /> : <Languages size={16} />}
                          </button>
                           <button 
                            onClick={() => testDialogue(dialogue.id)}
                            className="text-white/20 hover:text-white transition-all p-1"
                            title="Prova Voce"
                          >
                            <Volume2 size={16} />
                          </button>
                          <button 
                            onClick={() => removeDialogue(dialogue.id)}
                            className="text-white/20 hover:text-rose-500 transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-2">Protagonista</label>
                          <select 
                            value={dialogue.characterId}
                            onChange={(e) => {
                              const newCharId = e.target.value;
                              const char = allCharacters.find(c => c.id === newCharId);
                              let updates: Partial<Dialogue> = { characterId: newCharId };
                              
                              if (char && char.gender) {
                                const langVoices = currentVoices.filter(v => v.lang === dialogue.lang);
                                const genderVoiceIndex = langVoices.findIndex(v => 
                                  v.name.toLowerCase().includes(char.gender!)
                                );
                                if (genderVoiceIndex !== -1) updates.voiceIndex = genderVoiceIndex;
                              }
                              
                              updateDialogue(dialogue.id, updates);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-tight focus:outline-none focus:border-pink-500 transition-all text-white/80"
                          >
                            {allCharacters.map(c => (
                              <option key={c.id} value={c.id} className="bg-[#1a1a1c]">{c.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-2">Voce TTS</label>
                          <div className="grid grid-cols-1 gap-2">
                            <select 
                              value={dialogue.lang}
                              onChange={(e) => updateDialogue(dialogue.id, { lang: e.target.value, voiceIndex: 0 })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase focus:outline-none text-white/60"
                            >
                              {Array.from(new Set(currentVoices.map(v => v.lang))).map(lang => (
                                <option key={lang} value={lang} className="bg-[#1a1a1c]">{lang}</option>
                              ))}
                              {currentVoices.length === 0 && <option value="it-IT">Italian (Italy)</option>}
                            </select>
                            <select 
                              value={dialogue.voiceIndex}
                              onChange={(e) => updateDialogue(dialogue.id, { voiceIndex: parseInt(e.target.value) })}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase focus:outline-none text-white/60"
                            >
                                {currentVoices.filter(v => v.lang.toLowerCase().includes(dialogue.lang.split('-')[0].toLowerCase())).length > 0 ? (
                                  currentVoices
                                    .filter(v => v.lang.toLowerCase().includes(dialogue.lang.split('-')[0].toLowerCase()))
                                    .map((v, i) => {
                                      const name = v.name.toLowerCase();
                                      let type = " 🔊 (V)";
                                      const isMale = name.includes('male') || name.includes('guy') || name.includes('david') || name.includes('marco') || name.includes('stefano') || name.includes('maschile') || name.includes('daniele') || name.includes('frank') || name.includes('luca') || name.includes('davide') || name.includes('riccardo') || name.includes('pietro') || name.includes('paolo');
                                      const isFemale = name.includes('female') || name.includes('woman') || name.includes('zira') || name.includes('elsa') || name.includes('cosma') || name.includes('marta') || name.includes('femminile') || name.includes('chiara') || name.includes('sofia') || name.includes('alice') || name.includes('paola') || name.includes('elena') || name.includes('isabella') || name.includes('chiara');
                                      
                                      if (isMale) type = " ♂ (M)";
                                      else if (isFemale) type = " ♀ (F)";
                                      
                                      const isNatural = name.includes('natural') || name.includes('online') || name.includes('neural') || name.includes('premium') || name.includes('google');
                                      const cleanName = v.name.replace(/Google|Microsoft|Apple|Desktop|Natural|Neural/g, '').trim();
                                      
                                      return (
                                        <option key={`${v.name}-${v.lang}-${i}`} value={i} className="bg-[#1a1a1c]">
                                          {cleanName} {type} {isNatural ? '✨' : ''}
                                        </option>
                                      );
                                    })
                                ) : (
                                  <option value="0" className="bg-[#1a1a1c]">Voce Predefinita</option>
                                )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Text Area */}
                    <div className="flex-1 flex flex-col">
                      <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-3">Testo Dialogo</label>
                      <textarea
                        placeholder="Digita cosa deve dire il personaggio..."
                        value={dialogue.text}
                        onChange={(e) => updateDialogue(dialogue.id, { text: e.target.value })}
                        className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-xl font-serif italic text-white/90 leading-relaxed placeholder:text-white/10 placeholder:font-sans"
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {project.dialogues.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.02]">
                  <MessageSquare size={48} strokeWidth={1} className="mb-4 opacity-50" />
                  <p className="text-xs font-black uppercase tracking-widest">Nessun dialogo nella sequenza</p>
                  <button 
                    onClick={addDialogue}
                    className="mt-6 px-8 py-3 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                  >
                    Crea la prima battuta
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Footer Info / Status Bar */}
      <footer className="h-10 border-t border-white/5 bg-[#121214] flex items-center justify-between px-8 text-[9px] font-black uppercase tracking-widest text-white/20 shrink-0">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${currentVoices.length > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            {currentVoices.length > 0 ? 'Sistema TTS Pronto' : 'Attesa Voci Sistema...'}
          </span>
          <span>{currentVoices.length} Voci Caricate</span>
        </div>
        <div className="italic font-serif normal-case tracking-normal text-white/40">
          ToonScript Studio • Nessuna IA Esterna
        </div>
      </footer>

      {/* Library Modal */}
      <AnimatePresence>
        {showLibrary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#1a1a1c] border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-3xl text-white"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-xl font-black uppercase tracking-tighter">I Tuoi Script</h2>
                <button onClick={() => setShowLibrary(false)} className="text-white/40 hover:text-white transition-colors">
                  <RefreshCw size={20} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                {library.length === 0 ? (
                  <p className="text-center py-10 text-white/20 uppercase font-black text-xs tracking-widest">Nessuno script salvato</p>
                ) : (
                  library.map((libProject) => (
                    <div key={libProject.id} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${libProject.id === project.id ? 'bg-white/5 border-pink-500/50' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}`}>
                      <div className="flex flex-col">
                        <span className="font-black uppercase text-xs tracking-widest">{libProject.name}</span>
                        <span className="text-[9px] text-white/30 font-mono mt-1">{new Date(libProject.updatedAt).toLocaleString()}</span>
                      </div>
                          <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setProject({ ...libProject });
                            setShowLibrary(false);
                          }}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${libProject.id === project.id ? 'bg-pink-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white hover:text-black'}`}
                        >
                          Carica
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteProjectFromLibrary(libProject.id);
                          }}
                          className="p-1.5 rounded-full bg-white/5 text-white/20 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-8 bg-black/20 flex justify-end">
                <button 
                  onClick={() => setShowLibrary(false)}
                  className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-all"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Custom Character Modal */}
      <AnimatePresence>
        {showCustomCharModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#1a1a1c] border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-3xl text-white"
            >
              <div className="p-8 border-b border-white/5">
                <h2 className="text-xl font-black uppercase tracking-tighter">Nuovo Personaggio</h2>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-2">Nome</label>
                  <input 
                    placeholder="Esempio: Super Mario"
                    value={newCharData.name}
                    onChange={(e) => setNewCharData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-tight focus:outline-none focus:border-pink-500 transition-all text-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-white/30 tracking-widest block mb-2">URL Immagine (PNG Trasparente)</label>
                  <input 
                    placeholder="https://.../img.png"
                    value={newCharData.url}
                    onChange={(e) => setNewCharData(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold tracking-tight focus:outline-none focus:border-pink-500 transition-all text-white"
                  />
                  <p className="text-[9px] text-white/20 mt-2 italic">* Usa un URL che termini per .png per risultati migliori.</p>
                </div>
              </div>
              <div className="p-8 bg-black/20 flex gap-4">
                <button 
                  onClick={() => setShowCustomCharModal(false)}
                  className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-all"
                >
                  Indietro
                </button>
                <button 
                  onClick={addCustomCharacter}
                  className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pink-400 transition-all"
                >
                  Crea
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
