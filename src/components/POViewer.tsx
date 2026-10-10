import React, { useState, useEffect, useRef } from 'react';
import { PO, POItem } from '../types';
import {
  X,
  FileText,
  User,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Truck,
  MessageSquare,
  Send,
  Loader,
  Sparkles,
  Info,
  CheckCircle2,
  DollarSign,
  Trash2
} from 'lucide-react';

interface POViewerProps {
  po: PO;
  onClose: () => void;
  onUpdateStatus: (id: string, status: PO['status']) => void;
  onDeletePO?: (id: string, e: React.MouseEvent) => void;
}

export default function POViewer({ po, onClose, onUpdateStatus, onDeletePO }: POViewerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'terms' | 'advisor'>('details');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    {
      sender: 'bot',
      text: `Hello! I am the TATA Steel Compliance & Dispatch AI Advisor. I have fully indexed this Purchase Order (${po.orderNo}). Ask me questions about dispatch due warnings, liquidated damages under Clause 3.0, and Kalinganagar/Jamshedpur portal delivery rules.`
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, aiLoading]);

  const handleSendQuery = async (pastedText?: string) => {
    const textToSend = pastedText || userInput;
    if (!textToSend.trim()) return;

    if (!pastedText) {
      setUserInput('');
    }

    setChatMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
    setAiLoading(true);

    try {
      const groqApiKey = localStorage.getItem('tata_groq_api_key') || '';
      const response = await fetch('/api/pos/chat-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ text: textToSend }],
          poContext: po,
          groqApiKey
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
        throw new Error('Invalid response from AI advisor.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Server error speaking to AI.');
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: data.text }]);
    } catch (e: any) {
      console.error(e);
      setChatMessages(prev => [...prev, { sender: 'bot', text: `Failed to synthesize response: ${e.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const PRESETS = [
    { label: 'Calculate delay penalty (LD limit)', query: 'What is the penalty if this order is delayed by 3 weeks?' },
    { label: 'View packing requirements', query: 'What are the packing requirements for items under this PO (pallet standards)?' },
    { label: 'Gate-pass compliance checklist', query: 'Are there any gate entry, validity dates, or invoicing issues under this PO?' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs">
      <div className="h-full w-full max-w-4xl bg-white shadow-2xl flex flex-col">
        {/* Viewer Header */}
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-800 p-2 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Purchase Order Review</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  po.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-300' :
                  po.status === 'Dispatched' ? 'bg-blue-500/20 text-blue-300' :
                  po.status === 'Delayed' ? 'bg-red-500/20 text-red-300' :
                  po.status === 'Preponement of Delivery Schedule' ? 'bg-purple-500/20 text-purple-300' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {po.status}
                </span>
              </div>
              <h2 className="text-lg font-bold">PO: {po.orderNo}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDeletePO && (
              <button
                onClick={(e) => {
                  onDeletePO(po.id, e);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors shadow-xs"
                title="Delete Purchase Contract"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete PO</span>
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors" title="Close modal">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-all ${
              activeTab === 'details' ? 'border-slate-900 text-slate-950 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            PO Sheet Details
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-all ${
              activeTab === 'terms' ? 'border-slate-900 text-slate-950 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Packing & Legal Clauses
          </button>
          <button
            onClick={() => setActiveTab('advisor')}
            className={`px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'advisor' ? 'border-slate-900 text-slate-950 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            AI Compliance Advisor
          </button>
        </div>

        {/* Content Body area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* TATA STEEL standard document styling header */}
              <div id="po-document-box" className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 relative">
                <div className="absolute top-4 right-4 text-right">
                  <p className="text-[10px] font-mono text-slate-400">PRINT DATE: {new Date().toISOString().split('T')[0]}</p>
                  <p className="text-[10px] font-mono text-slate-400">RELEASE: {po.releaseDate}</p>
                </div>
                
                <div className="flex items-center gap-1 text-slate-900 font-extrabold text-lg tracking-widest border-b border-slate-200 pb-4 mb-4">
                  TATA STEEL
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchaser Entity</p>
                    <p className="font-bold text-slate-900">{po.companyName}</p>
                    <p className="leading-relaxed">{po.location}</p>
                    <p className="mt-2"><span className="text-slate-400">Order No: </span><span className="font-medium text-slate-800">{po.orderNo}</span></p>
                    <p><span className="text-slate-400">Order Date: </span><span className="font-medium text-slate-800">{po.orderDate}</span></p>
                    {po.validityStart && (
                      <p><span className="text-slate-400">Validity: </span><span className="font-medium text-slate-800">{po.validityStart} to {po.validityEnd}</span></p>
                    )}
                  </div>

                  <div className="space-y-2 bg-white/70 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier/Vendor Details</p>
                    <p className="font-bold text-slate-900">{po.vendorName}</p>
                    <p><span className="text-slate-400">Vendor Code: </span><span className="font-mono text-slate-800 bg-slate-100 px-1 rounded">{po.vendorCode}</span></p>
                    {po.vendorEmail && <p><span className="text-slate-400">Email: </span><span className="text-slate-800">{po.vendorEmail}</span></p>}
                    {po.vendorPhone && <p><span className="text-slate-400">Phone: </span><span className="text-slate-800">{po.vendorPhone}</span></p>}
                    
                    <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TATA Procurement Contact Key</p>
                      <p className="font-medium text-slate-800">{po.contactPerson} ({po.contactEmail})</p>
                      {po.contactPhone && <p><span className="text-slate-400">Phone: </span><span className="text-slate-800">{po.contactPhone}</span></p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Update Quick Bar */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">Dispatch & Delivery Tracking Actions:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['In Production', 'Dispatched', 'Delivered', 'Delayed', 'Preponement of Delivery Schedule'] as PO['status'][]).map((st) => (
                    <button
                      key={st}
                      onClick={() => onUpdateStatus(po.id, st)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        po.status === st
                          ? 'bg-slate-900 border-slate-900 text-white font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {st === 'Preponement of Delivery Schedule' ? 'Preponed Dispatch' : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active PO Items List Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Item Details Panel</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                        <th className="px-4 py-3">Item No</th>
                        <th className="px-4 py-3">Material No / Group</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Qty / Unit</th>
                        <th className="px-4 py-3 text-right">Unit Price (₹)</th>
                        <th className="px-4 py-3 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {po.items.map((it) => (
                        <tr key={it.id || it.itemNo} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-slate-500">{it.itemNo}</td>
                          <td className="px-4 py-3 font-mono">
                            <span className="block text-slate-800">{it.materialNo}</span>
                            <span className="text-[10px] text-slate-400 block">{it.materialGroupDesc} ({it.materialGroup})</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block font-medium text-slate-800">{it.materialDesc}</span>
                            {it.unloadingPoint && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">Unloading: {it.unloadingPoint}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">{it.qty} {it.unit}</td>
                          <td className="px-4 py-3 text-right font-mono">₹{it.grossPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">₹{it.totalValue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Totals Summary */}
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500 uppercase">Gross Purchase Contract Volume</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">₹{Number(po.totalOrderValue || 0).toLocaleString()} INR</span>
                  </div>
                </div>
              </div>

              {/* AI Insights & Tracking Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2 text-xs">
                    <Info className="h-4 w-4 text-blue-500" />
                    Vendor Compliance Rating
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-extrabold text-slate-800">{po.complianceRating || 90}%</span>
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-900 h-full rounded-full" style={{ width: `${po.complianceRating || 90}%` }} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Compliance calculations prioritize drawing approvals, validity extension dates, and packing standards.</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-900 text-white">
                  <div className="flex items-center gap-2 font-bold mb-2 text-xs text-blue-400">
                    <Sparkles className="h-4 w-4" />
                    AI Procurement Insights
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">{po.aiInsights || 'Analysing dispatch alerts and contract limits...'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
              {/* Packaging Standards Section */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white">
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">1. Packaging Standard (TATA Code Clause 4.2)</h3>
                <ul className="list-disc pl-5 mt-2 space-y-2 text-xs text-slate-600">
                  <li><strong>Clause 4.2.1:</strong> Loose material, gunny bags, and standard plastic are strictly prohibited within Works.</li>
                  <li><strong>Clause 4.2.2:</strong> For any components weighing less than 20kg with total package counts under 25, strict carton box packaging is mandatory. For counts exceeding 25, palletized packaging (Max dimensions 1M x 1M x 1M) must be used.</li>
                  <li><strong>Clause 4.2.3:</strong> Heavy equipment/materials weighing in excess of 20kg must use metallic pallets (IS 2062:1999-GR:A) or recyclable polypropylene pallets to support mechanical cranes and forklifts.</li>
                  <li><strong>Clause 4.2.4:</strong> Strict Single-use Plastic (SUP) ban applies across all Tata Steel Limited warehouses. Drivers violating this rule face immediate penalties.</li>
                </ul>
              </div>

              {/* Delivery & Gate Entry timing details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-slate-200 bg-white">
                  <h3 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">2. Gate Entry & Inbound Timings</h3>
                  <p className="text-slate-600">
                    Road carriers can deliver items only between <strong>6:10 AM and 7:40 PM</strong> (excluding lunch hours 1:00 PM to 2:00 PM) on standard working days.
                    Gate clearances on Sundays require prior procurement director exception approvals. Vehicles older than 15 years are blocked from general gates.
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                  <h3 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    3. Liquidated Damages (Clause 3.0 / 8.0)
                  </h3>
                  <p className="text-slate-600">
                    TATA STEEL operates an automated irrevocable Liquidated Damages (LD) deduction system.
                    Delays beyond the stipulated delivery period attract penalties at the rate of <strong>0.5% of order value per week</strong> up to an irrevocable maximum cap of <strong>5%</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advisor' && (
            <div id="ai-advisor-panel" className="flex flex-col h-[400px] border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              {/* Chat Message Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-xl p-3 text-xs leading-normal shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white rounded-br-none'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                    }`}>
                      {msg.sender === 'bot' && (
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-500 mb-1.5 border-b border-slate-50 pb-0.5">
                          <Sparkles className="h-3 w-3" />
                          AI Advisor Compliance Engine
                        </div>
                      )}
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-slate-500 rounded-xl p-3 text-xs border border-slate-100 flex items-center gap-2">
                      <Loader className="h-3.5 w-3.5 animate-spin text-blue-500" />
                      Consulting TATA PO legal indexes...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Preset Shortcuts bar */}
              <div className="px-4 py-2 bg-white border-t border-slate-150 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleSendQuery(p.query)}
                    disabled={aiLoading}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors font-medium cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Chat Input Form */}
              <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendQuery();
                  }}
                  disabled={aiLoading}
                  placeholder="Ask advisor about packing weights, LD penalties, or dispatch alerts..."
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 focus:outline-hidden focus:border-slate-400 disabled:opacity-50 text-slate-800"
                />
                <button
                  onClick={() => handleSendQuery()}
                  disabled={aiLoading}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
