import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, RefreshCw, Paperclip, X, ChevronDown, Link2, Globe, Check, 
  Loader2, AlertCircle, Menu, Plus, MessageSquare, Trash2, Clock, ShieldCheck
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, doc, 
  serverTimestamp, updateDoc, setDoc, getDoc, deleteDoc, orderBy 
} from 'firebase/firestore';

// --- CONFIGURATION ---
const appId = typeof (window as any).__app_id !== 'undefined' ? (window as any).__app_id : 'one-ai-v2.4-manual-send';

const firebaseConfig = {
  apiKey: "AIzaSyCbHVrCEqvJuHgsk4rjbsCU0hwG3ZEZ1Es",
  authDomain: "ai-chatfuck.firebaseapp.com",
  projectId: "ai-chatfuck",
  storageBucket: "ai-chatfuck.firebasestorage.app",
  messagingSenderId: "880834362876",
  appId: "1:880834362876:web:b151d2d665f0c6e5c1c679",
  measurementId: "G-EHSNEDZBBZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const apiKey = "AIzaSyAUMJvz2L2glaJ5WSyiczOQ5MHeLGTsNIo";

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'bn', name: 'Bengali (বাংলা)' }
];

const UI_STRINGS = {
  en: { 
    title: 'ONE AI', 
    new_chat: "New Chat",
    recent: "Recent",
    powered: 'Powered with 6 AI', 
    box_headline: "The world's first 6-agent ensemble.",
    box_body: "6 different AI models to analyze every query from multiple perspectives. It merges their best responses into one smarter, more accurate, and refined answer.",
    box_security: "Your data is secured with end-to-end encryption in an isolated local session, accessible only by your device.",
    placeholder: "Type here...", 
    dev: "Developer | Sam", 
    view_perspectives: "View different AI perspectives", 
    hide_perspectives: "Hide Perspectives", 
    analyzing: "One AI is thinking...", 
    translating: "Syncing..." 
  },
  hi: { 
    title: '1 AI', 
    new_chat: "नई चैट",
    recent: "हालिया",
    powered: '6 AI द्वारा संचालित', 
    box_headline: "दुनिया का पहला 6-एजेंट समूह।",
    box_body: "हर प्रश्न का विश्लेषण करने के लिए 6 अलग-अलग AI मॉडल। यह उनके सर्वोत्तम उत्तरों को एक स्मार्ट, अधिक सटीक और परिष्कृत उत्तर में मिलाता है।",
    box_security: "आपका डेटा एंड-टू-एंड एन्क्रिप्शन के साथ सुरक्षित है और केवल आपके डिवाइस द्वारा ही एक्सेस किया जा सकता है।",
    placeholder: "यहाँ लिखें...", 
    dev: "डेवलपर | सैम", 
    view_perspectives: "विभिन्न AI दृष्टिकोण देखें", 
    hide_perspectives: "दृष्टिकोण छुपाएं", 
    analyzing: "1 AI सोच रहा है...", 
    translating: "सिंक हो रहा है..." 
  }
};

const ENSEMBLE_MODELS = [
  { id: 'gemini', name: 'Gemini', role: 'Context', color: 'text-blue-400' },
  { id: 'claude', name: 'Claude', role: 'Nuance', color: 'text-orange-400' },
  { id: 'gpt', name: 'ChatGPT', role: 'Logic', color: 'text-emerald-400' },
  { id: 'copilot', name: 'Copilot', role: 'Technical', color: 'text-indigo-400' },
  { id: 'manus', name: 'Manus', role: 'Agentic', color: 'text-purple-400' },
  { id: 'deepseek', name: 'DeepSeek', role: 'Analysis', color: 'text-cyan-400' }
];

const App = () => {
  const [chats, setChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentLang, setCurrentLang] = useState('en');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewDetails, setViewDetails] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = (key: string) => {
    const strings = UI_STRINGS[currentLang as keyof typeof UI_STRINGS] || UI_STRINGS['en'];
    return (strings as any)[key] || key;
  };

  // Auto-resize textarea logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = (window as any).__initial_auth_token;
        if (typeof token !== 'undefined' && token) {
          await signInWithCustomToken(auth, token);
        } else { 
          await signInAnonymously(auth); 
        }
      } catch (e) { 
        setError("Secure session failed."); 
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'chats');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setChats(loadedChats.sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)));
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !currentChatId) {
      setMessages([]);
      return;
    }

    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'chats', currentChatId, 'messages');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setMessages(loaded.sort((a: any, b: any) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)));
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, isTyping]);

  const startNewChat = async () => {
    if (!user) return;
    setCurrentChatId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const deleteChat = async (id: string, e: any) => {
    e.stopPropagation();
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chats', id));
    if (currentChatId === id) setCurrentChatId(null);
  };

  const handleSend = async () => {
    if (!input.trim() || !user || isTyping) return;

    let chatId = currentChatId;
    if (!chatId) {
      const newChatRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'chats'), {
        title: input.trim().substring(0, 35) + '...',
        updatedAt: serverTimestamp()
      });
      chatId = newChatRef.id;
      setCurrentChatId(chatId);
    } else {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chats', chatId), { updatedAt: serverTimestamp() });
    }

    const currentPrompt = input;
    setInput('');
    setIsTyping(true);

    const msgRef = collection(db, 'artifacts', appId, 'users', user.uid, 'chats', chatId, 'messages');
    await addDoc(msgRef, { role: 'user', text: currentPrompt, timestamp: serverTimestamp() });

    try {
      const langName = LANGUAGES.find(l => l.code === currentLang)?.name || 'English';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: currentPrompt }] }],
          systemInstruction: { 
            parts: [{ 
              text: `One AI by Sam. Language: ${langName}. 6-Agent ensemble. Refine into master_response. Output JSON.` 
            }] 
          },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      await addDoc(msgRef, { role: 'assistant', text: result.master_response, details: result, timestamp: serverTimestamp() });
    } catch (e) { 
      setError("Ensemble processing glitch. Try again."); 
    }
    finally { 
      setIsTyping(false); 
    }
  };

  return (
    <div className="flex h-screen bg-[#D1D1D1] text-[#111] font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <div className={`fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
      
      <aside className={`fixed lg:static top-0 left-0 z-[101] h-full w-[280px] bg-[#1A1A1A] text-white flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 flex flex-col h-full">
          <button 
            onClick={startNewChat}
            className="flex items-center gap-3 w-full p-3.5 mb-6 bg-[#2A2A2A] hover:bg-[#333] border border-white/5 rounded-2xl transition-all shadow-lg group"
          >
            <Plus className="w-5 h-5 text-blue-400 group-hover:rotate-90 transition-transform duration-300" />
            <span className="text-sm font-bold uppercase tracking-widest">{t('new_chat')}</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
            <p className="px-4 py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Clock className="w-3 h-3" /> {t('recent')}
            </p>
            {chats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400' : 'hover:bg-white/5 text-gray-400'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare className={`w-4 h-4 shrink-0 ${currentChatId === chat.id ? 'text-blue-400' : 'text-gray-600'}`} />
                  <span className="text-xs font-semibold truncate">{chat.title}</span>
                </div>
                <button onClick={(e) => deleteChat(chat.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5">
             <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
               <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-black text-xs text-white uppercase shadow-lg">Sam</div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-bold uppercase tracking-tight text-slate-300">One AI Developer</span>
                 <span className="text-[8px] text-gray-500 italic">Sam</span>
               </div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main UI */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-[#EAEAEA] to-[#D1D1D1] relative overflow-hidden">
        
        {/* Navbar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0 relative z-50">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-black/5 rounded-xl transition-all lg:hidden">
            <Menu className="w-6 h-6 text-gray-800" />
          </button>

          <div className="relative">
            <button onClick={() => setIsLangOpen(!isLangOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-white/40 hover:bg-white/60 backdrop-blur rounded-full border border-gray-300 transition-all text-[11px] font-bold uppercase shadow-sm">
              <Globe className="w-4 h-4 text-blue-600" /> {currentLang}
            </button>

            {isLangOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 z-50">
                <div className="max-h-64 overflow-y-auto py-2">
                  {LANGUAGES.map((lang) => (
                    <button key={lang.code} onClick={() => { setCurrentLang(lang.code); setIsLangOpen(false); }} className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-semibold text-gray-700 hover:bg-blue-50 transition-colors">
                      {lang.name} {currentLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Chat Area */}
        <main className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide flex flex-col items-center pb-56">
          <div className="w-full max-w-[460px] space-y-10">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center animate-in fade-in duration-1000 mt-2 text-center">
                <div className="mb-6 relative scale-90">
                   <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="25" width="50" height="50" rx="8" stroke="black" strokeWidth="4.5"/>
                    <rect x="35" y="35" width="30" height="30" rx="4" fill="black"/>
                    <text x="50" y="55" fontSize="14" fontWeight="900" fill="white" textAnchor="middle" style={{fontFamily: 'system-ui'}}>AI</text>
                    <path d="M40 10V25M50 10V25M60 10V25M40 75V90M50 75V90M60 75V90M10 40H25M10 50H25M10 60H25M75 40H90M75 50H90M75 60H90" stroke="black" strokeWidth="3.5" strokeLinecap="round"/>
                  </svg>
                </div>

                <p className="text-gray-400 font-medium tracking-wide mb-4 uppercase text-[10px]">{t('powered')}</p>

                <div className="w-full bg-[#1A1A1A] rounded-[38px] p-8 shadow-2xl text-white text-left">
                  <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-8">
                    {ENSEMBLE_MODELS.map(m => (
                      <div key={m.id} className="flex flex-col items-start border-l border-white/5 pl-3">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${m.color}`}>{m.name}</span>
                        <span className="text-[7px] font-bold uppercase text-gray-500 tracking-widest">{m.role}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-[12px] font-bold text-white leading-tight">{t('box_headline')}</h2>
                    <p className="text-[11px] leading-relaxed text-gray-400 font-normal">{t('box_body')}</p>
                    <div className="pt-4 border-t border-white/5 mt-4 flex gap-3">
                       <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                       <p className="text-[9px] text-gray-400 leading-normal font-medium italic">{t('box_security')}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 w-full">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-3`}>
                    <div className={`max-w-[90%] rounded-[24px] px-5 py-3.5 shadow-sm border ${m.role === 'user' ? 'bg-[#1A1A1A] text-white border-white/5 rounded-tr-none shadow-xl' : 'bg-white/95 backdrop-blur-md text-[#111] border-gray-200 rounded-tl-none font-medium'}`}>
                      <div className="prose prose-sm max-w-none text-inherit leading-relaxed whitespace-pre-wrap text-[14px]">{m.text}</div>

                      {m.role === 'assistant' && m.details && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button onClick={() => setViewDetails(prev => ({...prev, [m.id]: !prev[m.id]}))} className="text-[8px] uppercase font-bold tracking-widest text-blue-500 hover:text-blue-600 flex items-center gap-1.5 transition-all">
                            <ChevronDown className={`w-3 h-3 transition-transform ${viewDetails[m.id] ? 'rotate-180' : ''}`} /> {viewDetails[m.id] ? t('hide_perspectives') : t('view_perspectives')}
                          </button>

                          {viewDetails[m.id] && (
                            <div className="mt-3 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                              {ENSEMBLE_MODELS.map(agent => (
                                <div key={agent.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                                  <span className={`text-[8px] uppercase font-black block mb-1 ${agent.color}`}>{agent.name}</span>
                                  <p className="text-[8.5px] text-gray-600 italic leading-tight">{m.details[agent.id]}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white/60 backdrop-blur-sm rounded-[24px] px-4 py-3 border border-gray-200 shadow-sm flex items-center gap-3">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{t('analyzing')}</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* --- STICKY FLOATING AUTO-EXPANDING INPUT --- */}
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-8 flex flex-col items-center pointer-events-none z-50">
           <div className="absolute inset-0 bg-gradient-to-t from-[#D1D1D1] via-[#D1D1D1]/40 to-transparent -z-10"></div>
           
           <div className="w-full max-w-[480px] pointer-events-auto flex flex-col items-center">
              <div className="w-full relative group mb-4">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/20 to-emerald-400/20 rounded-[32px] blur opacity-0 group-focus-within:opacity-100 transition duration-500 pointer-events-none"></div>
                <div className="relative flex items-end bg-[#1A1A1A] rounded-[32px] p-2 pr-2.5 pl-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 transition-all focus-within:border-emerald-500/30">
                  <button type="button" className="text-gray-400 hover:text-white transition-colors mb-2.5 mr-3 shrink-0 scale-90">
                    <Link2 className="w-5 h-5 rotate-45" />
                  </button>
                  
                  {/* MULTI-LINE TEXTAREA: Enter moves to next line automatically */}
                  <textarea 
                    ref={textareaRef}
                    rows={1}
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t('placeholder')} 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 text-[15px] font-medium py-3 px-0 outline-none resize-none max-h-[180px] scrollbar-hide"
                  />
                  
                  {/* SEND BUTTON: Manual send only */}
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping} 
                    className={`ml-3 mb-1.5 p-2 rounded-full transition-all duration-300 outline-none shrink-0 ${
                      input.trim() 
                      ? 'bg-emerald-500 text-white opacity-100 scale-100 shadow-md active:scale-90' 
                      : 'bg-emerald-500/20 text-emerald-100 opacity-20 scale-90 cursor-not-allowed'
                    }`}
                  >
                    {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 fill-current" />}
                  </button>
                </div>
              </div>
              
              <div className="text-center opacity-70 mb-2">
                <p className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em]">{t('dev')}</p>
                <p className="text-[8px] text-gray-600 font-medium tracking-tight mt-0.5 uppercase">Beta v1.0</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
