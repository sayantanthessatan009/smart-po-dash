import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, Bot, User, Trash2, Cpu, HelpCircle, Loader2, ArrowRight, Key, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { PO, SystemAlert } from '../types';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface AICopilotChatProps {
  pos: PO[];
  alerts: SystemAlert[];
}

export default function AICopilotChat({ pos, alerts }: AICopilotChatProps) {
  // Try loading initial Groq API key from client state
  const [groqKey, setGroqKey] = useState<string>(() => {
    try {
      return localStorage.getItem('tata_groq_api_key') || '';
    } catch {
      return '';
    }
  });
  
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [stagingKey, setStagingKey] = useState(groqKey);
  const [revealKey, setRevealKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: `Hello! I am your **TATA Steel AI Corporate Copilot**. I have access to the complete PO database and dispatch alarms. 

You can ask me to:
- **Analyze stats**: e.g., "Summarize the total active PO values and average rating"
- **Filter and compare**: e.g., "List all POs with high risk of delay" 
- **Explain specifications**: e.g., "What are the rules for heavy equipment packaging (>20kg)?"
- **Calculate LD penalties**: e.g., "What's the calculated Liquidated Damages for late POs?"

What would you like to review or audit today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSaveGroqKey = () => {
    try {
      const trimmed = stagingKey.trim();
      localStorage.setItem('tata_groq_api_key', trimmed);
      setGroqKey(trimmed);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      setShowKeyInput(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    if (!customText) {
      setInput('');
    }
    setErrorMsg(null);

    // Append user message
    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          pos,
          alerts,
          groqApiKey: groqKey || undefined
        })
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (jsonErr) {
        if (!response.ok) {
          throw new Error(`Server HTTP ${response.status}: ${rawText.substring(0, 100)}`);
        }
        throw new Error('Invalid JSON response received from server.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Server error speaking to AI Copilot.');
      }

      setMessages(prev => [...prev, { role: 'model', content: data.text || 'No response received.' }]);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Failed to get answer from AI. Ensure GEMINI_API_KEY is configured in Settings or paste your Groq API Key.');
      setMessages(prev => [
        ...prev, 
        { 
          role: 'model', 
          content: `⚠️ **Error Code 500**: Failed to retrieve AI analysis. Details: ${e.message || 'API key mismatch'}. 
          
Please make sure process.env.GEMINI_API_KEY is configured on the server, or paste a valid **Groq API Key** in the **Configure Groq API** panel at the top right of this chat screen.` 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'model',
        content: `Chat history cleared. I'm ready for your queries! How can I assist you with TATA Steel Purchase Orders and logistics compliance?`
      }
    ]);
    setErrorMsg(null);
  };

  const PRESET_QUERIES = [
    { label: '📊 Summarize entire PO Database', query: 'List all of our Purchase Orders with their statuses, locations, and total values in a clean comparison table.' },
    { label: '⚠️ Audit Late Orders & LDs', query: 'Check which POs are status Delayed, calculate their Liquidated Damages at 0.5% per week, and summarize overall risk.' },
    { label: '📦 Unpacking Pallet Rules', query: 'What are the required packaging and pallet standards for heavy equipment (>20kg) and who are the contacts?' },
    { label: '🔍 Low Compliance Check', query: 'Show me any POs which have a compliance rating below 90% and explain why.' }
  ];

  // Helper function to decode Markdown response from Gemini into a beautiful UI
  const decodeBolds = (line: string) => {
    const parts = line.split('**');
    return parts.map((part, pidx) => pidx % 2 === 1 ? (
      <strong key={pidx} className="font-bold text-slate-900 dark:text-white bg-blue-50/70 dark:bg-slate-800/85 px-1 rounded">
        {part}
      </strong>
    ) : part);
  };

  const renderMarkdown = (md: string) => {
    if (!md) return null;
    const lines = md.split('\n');
    return lines.map((line, ix) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={ix} className="text-xs font-extrabold text-blue-900 dark:text-blue-300 mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-blue-500 dark:bg-blue-400 rounded-xs" />
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={ix} className="text-sm font-black text-slate-800 dark:text-slate-100 mt-4 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1 uppercase tracking-wide">
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h2 key={ix} className="text-base font-extrabold text-indigo-800 dark:text-indigo-400 mt-4 mb-2.5">
            {line.replace('# ', '')}
          </h2>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2);
        return (
          <li key={ix} className="text-[11px] text-slate-700 dark:text-slate-350 ml-4 list-disc my-1 pl-0.5 leading-relaxed">
            {text.includes('**') ? decodeBolds(text) : text}
          </li>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        const text = line.replace(/^\d+\.\s/, '');
        return (
          <li key={ix} className="text-[11px] text-slate-700 dark:text-slate-350 ml-4 list-decimal my-1 pl-0.5 leading-relaxed">
            {text.includes('**') ? decodeBolds(text) : text}
          </li>
        );
      }
      // Simple Markdown table formatting helper
      if (line.startsWith('|') && ix > 0) {
        // Skip separator lines e.g. |---|---|
        if (line.includes('---')) return null;
        
        const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
        const isHeader = ix === 1 || (lines[ix-1] && lines[ix-1].includes('---'));
        
        return (
          <div key={ix} className={`grid grid-cols-${Math.max(2, cells.length)} gap-2 py-1 px-2 text-[10px] ${
            isHeader ? 'bg-slate-100 dark:bg-slate-900 font-bold border-b border-slate-200 dark:border-slate-800' : 'border-b border-slate-50 dark:border-slate-850/40 text-slate-650 dark:text-slate-400'
          }`}>
            {cells.map((cell, cIdx) => (
              <span key={cIdx} className="truncate">{cell.trim().includes('**') ? decodeBolds(cell) : cell}</span>
            ))}
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={ix} className="h-1" />;
      }
      return (
        <p key={ix} className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed my-1 font-sans">
          {line.includes('**') ? decodeBolds(line) : line}
        </p>
      );
    });
  };

  return (
    <div id="ai-copilot-container" className="flex flex-col h-[calc(100vh-210px)] min-h-[500px] rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden transition-all duration-150">
      {/* Header element */}
      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-left">
          <div className="h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-150 dark:border-teal-900/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
              TATA Steel AI Corporate Copilot
              {groqKey ? (
                <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Groq GPT-OSS Active
                </span>
              ) : (
                <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  Gemini Default
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Conversational AI trained on your PO schema records and warehouse compliance specs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Groq Key toggle button */}
          <button
            id="btn-toggle-groq-config"
            onClick={() => {
              setStagingKey(groqKey);
              setShowKeyInput(!showKeyInput);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
              groqKey 
                ? 'bg-emerald-50/50 border-emerald-250 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            {groqKey ? 'Manage Groq Key' : 'Configure Groq API Key'}
          </button>

          <button
            id="btn-clear-chat"
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-500 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset Chat
          </button>
        </div>
      </div>

      {/* Slide down credentials input */}
      {showKeyInput && (
        <div className="bg-slate-100/85 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 p-4 shrink-0 transition-all duration-200">
          <div className="max-w-2xl mx-auto flex flex-col gap-2.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-350 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-blue-500" />
                Custom Groq API Configuration (GPT-OSS 120B & 20B Free Tier)
              </span>
              <span className="text-[9px] text-slate-450 dark:text-slate-550">Allows you to paste Groq keys directly</span>
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={revealKey ? "text" : "password"}
                  placeholder="gsk_..."
                  value={stagingKey}
                  onChange={(e) => setStagingKey(e.target.value)}
                  className="w-full pl-3 pr-10 py-1.5 text-xs rounded-md border border-slate-250 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() => setRevealKey(!revealKey)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {revealKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <button
                onClick={handleSaveGroqKey}
                className="px-4 py-1.5 rounded-md bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Save Key
              </button>
              
              {groqKey && (
                <button
                  onClick={() => {
                    setStagingKey('');
                    localStorage.removeItem('tata_groq_api_key');
                    setGroqKey('');
                    setShowKeyInput(false);
                  }}
                  className="px-4 py-1.5 rounded-md bg-rose-50 border border-rose-200 dark:bg-rose-955/20 dark:border-rose-900 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Clear Key
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-500 dark:text-slate-450 leading-relaxed">
              * Note: Your API key is stored securely in your browser's private local storage space and transmitted securely to query models on Groq's high-performance servers. If no key is entered, the app gracefully falls back to the server-side Gemini system.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
        {/* Messages list (Col span 3) */}
        <div className="lg:col-span-3 flex flex-col h-full overflow-hidden bg-slate-50/30 dark:bg-slate-900/10">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex gap-3.5 max-w-3xl ${message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto text-left'}`}
              >
                {/* Avatar Icon */}
                <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center border ${
                  message.role === 'user'
                    ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950/80 dark:border-blue-900 dark:text-blue-400'
                    : 'bg-[#1e293b] border-[#334155] text-teal-400'
                }`}>
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 animate-pulse" />}
                </div>

                {/* Bubble card */}
                <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed max-w-[85%] border shadow-xs ${
                  message.role === 'user'
                    ? 'bg-blue-600 border-blue-500 text-white font-medium'
                    : 'bg-white dark:bg-[#131d30] border-slate-200 dark:border-slate-850/80 text-slate-850 dark:text-slate-200'
                }`}>
                  <div className="space-y-1.5 text-left text-[11px]">
                    {message.role === 'user' ? message.content : renderMarkdown(message.content)}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3.5 mr-auto text-left max-w-3xl">
                <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center border bg-[#1e293b] border-[#334155] text-teal-400">
                  <Bot className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-xl px-4 py-3 text-xs leading-relaxed max-w-[85%] bg-white dark:bg-[#131d30] border border-slate-200 dark:border-slate-850/80 text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />
                  <span>AI Copilot is indexing database & analyzing schemas...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input control row */}
          <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Ask anything (e.g. 'How many POs have status Released?', 'What is the sum of outstanding contracts?')"
              className="flex-1 px-4 py-3 text-xs rounded-lg border border-slate-250 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-850 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              disabled={loading}
            />

            <button
              id="btn-send-llm"
              onClick={() => handleSendMessage()}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white flex items-center gap-1.5 text-xs font-semibold shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
            >
              Send
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Sidebar recommendations panel (Col span 1) */}
        <div className="hidden lg:flex flex-col border-l border-slate-150 dark:border-slate-800 p-5 bg-slate-50/30 dark:bg-slate-900/5 space-y-4">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-450">
            <HelpCircle className="h-4 w-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-wider">Suggested Audits</h4>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-left">
            {PRESET_QUERIES.map((item, idx) => (
              <button
                key={idx}
                id={`btn-preset-query-${idx}`}
                onClick={() => handleSendMessage(item.query)}
                disabled={loading}
                className="p-3 text-left rounded-lg bg-white dark:bg-[#131d30] border border-slate-200 dark:border-slate-850 text-[10px] text-slate-800 dark:text-slate-300 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all shadow-2xs flex flex-col justify-between group cursor-pointer disabled:opacity-50"
              >
                <span className="font-bold text-slate-900 dark:text-slate-100 mb-1">{item.label}</span>
                <span className="text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{item.query}</span>
                <div className="mt-2 text-right opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end text-blue-600 dark:text-blue-400 gap-1 font-semibold">
                  <span>Ask Copilot</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-150 dark:border-slate-850">
            <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed text-left flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Under Tata Steel logistics instructions, models evaluate real time data scopes dynamically. Results correspond to latest manual additions and PDF extractions.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
