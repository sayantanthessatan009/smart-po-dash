import React, { useState, useRef } from 'react';
import { 
  Upload, Sparkles, FileText, CheckCircle2, ChevronRight, RefreshCw, 
  AlertTriangle, Trash2, Layers, PlusCircle, CheckCircle, 
  FileStack, Clock, AlertCircle, FileSpreadsheet, Eye
} from 'lucide-react';
import { PO } from '../types';

interface ParserSectionProps {
  onAddParsedPO: (po: PO) => void;
  onAddParsedPOs?: (pos: PO[]) => void;
}

export interface BatchItem {
  id: string;
  name: string;
  size: string;
  base64?: string;
  ocrText?: string;
  status: 'idle' | 'parsing' | 'success' | 'error';
  extractedPO?: PO;
  error?: string;
}

export default function ParserSection({ onAddParsedPO, onAddParsedPOs }: ParserSectionProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalErrorMsg, setGlobalErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add uploaded PDF files to queue
  const addFilesToQueue = (files: File[]) => {
    const validFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (validFiles.length === 0) {
      setGlobalErrorMsg('Please upload valid Purchase Order PDF files (.pdf).');
      return;
    }

    setGlobalErrorMsg(null);
    validFiles.forEach((file, index) => {
      const reader = new FileReader();
      const itemId = `po_batch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
      
      reader.onload = () => {
        const result = reader.result as string;
        // Cleanly separate base64 payload
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        
        const newItem: BatchItem = {
          id: itemId,
          name: file.name,
          size: `${Math.round(file.size / 1024) || 1} KB`,
          base64: base64Data.replace(/\s+/g, ''),
          status: 'idle'
        };

        setBatchQueue(prev => {
          const next = [...prev, newItem];
          if (!selectedPreviewId) setSelectedPreviewId(itemId);
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveBatchItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBatchQueue(prev => {
      const next = prev.filter(item => item.id !== id);
      if (selectedPreviewId === id) {
        setSelectedPreviewId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setBatchQueue([]);
    setSelectedPreviewId(null);
    setPastedText('');
    setGlobalErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process single item via backend extraction pipeline
  const parseSingleItem = async (item: BatchItem): Promise<PO> => {
    const groqApiKey = localStorage.getItem('tata_groq_api_key') || '';
    const geminiApiKey = localStorage.getItem('tata_gemini_api_key') || '';

    const payload: {
      fileName: string;
      ocrText?: string;
      pdfData?: string;
      groqApiKey?: string;
      geminiApiKey?: string;
    } = {
      fileName: item.name,
      groqApiKey: groqApiKey || undefined,
      geminiApiKey: geminiApiKey || undefined
    };

    if (item.base64) {
      payload.pdfData = item.base64;
    }
    if (item.ocrText) {
      payload.ocrText = item.ocrText;
    }

    const response = await fetch('/api/pos/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}: ${rawText.substring(0, 100)}`);
      }
      throw new Error('Invalid JSON received from server.');
    }

    if (!response.ok) {
      throw new Error(data.error || 'Document extraction failed');
    }

    return data as PO;
  };

  // Smooth batch processing of queue
  const handleRunBatchExtraction = async () => {
    if (activeTab === 'paste') {
      if (!pastedText.trim()) {
        setGlobalErrorMsg('Please paste Purchase Order text into the input area.');
        return;
      }
      const pasteId = `paste_${Date.now()}`;
      const pasteItem: BatchItem = {
        id: pasteId,
        name: `PO_Document_${new Date().toISOString().split('T')[0]}.txt`,
        size: `${Math.round(pastedText.length / 1024) || 1} KB`,
        ocrText: pastedText.trim(),
        status: 'idle'
      };
      setBatchQueue([pasteItem]);
      setSelectedPreviewId(pasteId);
      await processQueueItems([pasteItem]);
      return;
    }

    if (batchQueue.length === 0) {
      setGlobalErrorMsg('Please upload one or more Purchase Order PDF files to begin extraction.');
      return;
    }

    await processQueueItems(batchQueue);
  };

  const processQueueItems = async (itemsToProcess: BatchItem[]) => {
    setIsProcessing(true);
    setGlobalErrorMsg(null);

    for (let i = 0; i < itemsToProcess.length; i++) {
      const current = itemsToProcess[i];
      if (current.status === 'success' && current.extractedPO) {
        continue; // Already successfully extracted
      }

      setBatchQueue(prev => prev.map(it => it.id === current.id ? { ...it, status: 'parsing', error: undefined } : it));
      setSelectedPreviewId(current.id);

      try {
        const extracted = await parseSingleItem(current);
        setBatchQueue(prev => prev.map(it => it.id === current.id ? { ...it, status: 'success', extractedPO: extracted } : it));
      } catch (err: any) {
        console.warn(`Extraction failed for ${current.name}:`, err.message);
        setBatchQueue(prev => prev.map(it => it.id === current.id ? { ...it, status: 'error', error: err.message || 'Extraction failed' } : it));
      }

      if (i < itemsToProcess.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setIsProcessing(false);
  };

  // Commit individual extracted PO to active database
  const handleCommitSingle = (item: BatchItem) => {
    if (item.extractedPO) {
      onAddParsedPO(item.extractedPO);
      handleRemoveBatchItem(item.id);
    }
  };

  // Commit all successfully extracted POs in batch
  const handleCommitAll = async () => {
    const successfulPOs = batchQueue.map(b => b.extractedPO).filter((p): p is PO => !!p);
    if (successfulPOs.length === 0) return;

    if (onAddParsedPOs) {
      onAddParsedPOs(successfulPOs);
    } else {
      for (const po of successfulPOs) {
        onAddParsedPO(po);
      }
    }

    setBatchQueue([]);
    setSelectedPreviewId(null);
    setPastedText('');
  };

  const successfulCount = batchQueue.filter(b => b.status === 'success').length;
  const pendingCount = batchQueue.filter(b => b.status === 'idle').length;
  const errorCount = batchQueue.filter(b => b.status === 'error').length;
  const totalValueSum = batchQueue.reduce((sum, b) => sum + (b.extractedPO?.totalOrderValue || 0), 0);
  const totalItemsSum = batchQueue.reduce((sum, b) => sum + (b.extractedPO?.items?.length || 0), 0);

  const activeItem = batchQueue.find(b => b.id === selectedPreviewId) || batchQueue[0];

  return (
    <div id="parser-central-container" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden transition-all duration-200 text-left">
      {/* Header with Mode Switcher & Real Extraction Pipeline Details */}
      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/20 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Purchase Order Document Intelligence & Batch Extractor
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Real Extraction Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload your TATA Steel Purchase Order PDF files for high-fidelity extraction of contract headers, line materials, drawings, pricing, and compliance parameters.
          </p>
        </div>

        {/* Input Mode Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-slate-200/60 dark:bg-slate-800/80 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-[#1f293d] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <FileStack className="h-3.5 w-3.5" />
              Upload PDF Files
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-white dark:bg-[#1f293d] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Paste Raw PO Text
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Upload & Queue (7 Cols) */}
        <div id="parser-input-panel" className="lg:col-span-7 space-y-4">
          
          {activeTab === 'upload' ? (
            <>
              {/* Multi-Drop Drag & Drop Zone */}
              <div
                id="pdf-drop-zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-4 ring-blue-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2.5">
                  <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900 shadow-xs">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Drop TATA Steel Purchase Order PDF(s) Here
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Select one or multiple real PO contracts to extract simultaneously
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-900/50 mt-1">
                    Browse Files from Device
                  </span>
                </div>
              </div>

              {/* Batch Queue List Header & Actions */}
              {batchQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                      <FileStack className="h-4 w-4 text-blue-500" />
                      <span>Upload Queue ({batchQueue.length} {batchQueue.length === 1 ? 'file' : 'files'})</span>
                      {successfulCount > 0 && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                          {successfulCount} Extracted
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="h-3 w-3" /> Add More
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <button
                        onClick={handleClearAll}
                        className="text-[11px] text-rose-500 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Clear Queue
                      </button>
                    </div>
                  </div>

                  {/* Batch Items Cards List */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {batchQueue.map((item, idx) => {
                      const isSelected = item.id === (activeItem?.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedPreviewId(item.id)}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 w-4 shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="h-7 w-7 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-extrabold text-[9px] flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900">
                              PDF
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span>{item.size}</span>
                                {item.extractedPO && (
                                  <>
                                    <span>•</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      PO #{item.extractedPO.orderNo} — ₹{Number(item.extractedPO.totalOrderValue).toLocaleString()} ({item.extractedPO.items.length} items)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'idle' && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Ready
                              </span>
                            )}
                            {item.status === 'parsing' && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold flex items-center gap-1 animate-pulse">
                                <RefreshCw className="h-3 w-3 animate-spin" /> Extracting...
                              </span>
                            )}
                            {item.status === 'success' && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-emerald-500" /> Extracted
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded font-bold flex items-center gap-1" title={item.error}>
                                <AlertCircle className="h-3 w-3" /> Error
                              </span>
                            )}

                            <button
                              onClick={(e) => handleRemoveBatchItem(item.id, e)}
                              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remove file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Paste Raw Text Area */
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Paste Raw Purchase Order Text Content (from SAP / PDF text):
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setGlobalErrorMsg(null);
                }}
                rows={10}
                placeholder="Paste real Purchase Order text here, e.g.&#10;TATA STEEL LIMITED...&#10;Order No. :- 2101032846/T03&#10;Vendor Code :- P056&#10;Item No. :- 00010..."
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1322] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>
          )}

          {/* Pipeline Information */}
          <div className="bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-150 dark:border-slate-800 flex items-start gap-2.5 text-[11px]">
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[9px]">
                High-Fidelity Document Intelligence Engine
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[10.5px] leading-normal">
                Processes PDF documents via multimodal intelligence with automatic high-speed deterministic parser fallback to prevent rate-limit interruptions.
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <span>⚡ Fast Batch Pipeline</span>
              {batchQueue.length > 0 && (
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  • {batchQueue.length} files queued
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-parse-po"
                onClick={handleRunBatchExtraction}
                disabled={isProcessing || (activeTab === 'upload' && batchQueue.length === 0) || (activeTab === 'paste' && !pastedText.trim())}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Extracting ({successfulCount + errorCount}/{batchQueue.length})...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {activeTab === 'upload' && batchQueue.length > 1
                      ? `Extract All ${batchQueue.length} POs`
                      : 'Extract Purchase Order'}
                  </>
                )}
              </button>
            </div>
          </div>

          {globalErrorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p className="mt-0.5">{globalErrorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Staging & Extracted Results Inspection (5 Cols) */}
        <div id="parser-preview-panel" className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-4 flex flex-col justify-between h-full min-h-[380px]">
          
          {/* Top Staging Metrics Bar */}
          {batchQueue.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2 text-center pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Extracted POs</span>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                  {successfulCount} / {batchQueue.length}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {totalItemsSum}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Batch Total</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate block">
                  ₹{Number(totalValueSum).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Active Item Staging Details */}
          {activeItem?.status === 'parsing' ? (
            <div className="flex flex-col items-center justify-center my-auto py-12 space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
              <div className="text-center animate-pulse">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Extracting {activeItem.name}...
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] mx-auto leading-normal">
                  Parsing purchase order clauses, drawing mechanical items, unit rates, and GST parameters...
                </p>
              </div>
            </div>
          ) : activeItem?.extractedPO ? (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-bold">Successfully Extracted</span>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    {activeItem.name}
                  </span>
                </div>

                <div className="mt-2">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    PO #{activeItem.extractedPO.orderNo}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {activeItem.extractedPO.companyName} • {activeItem.extractedPO.location}
                  </p>
                </div>

                {/* Extracted Stats Grid */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-[#131d30] p-3 rounded-lg border border-slate-150 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Total Order Value</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                      ₹{Number(activeItem.extractedPO.totalOrderValue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Vendor Name</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                      {activeItem.extractedPO.vendorName} ({activeItem.extractedPO.vendorCode})
                    </span>
                  </div>

                  <div className="col-span-2 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                        Line Items ({activeItem.extractedPO.items?.length || 0})
                      </span>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {activeItem.extractedPO.items?.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5 rounded border border-slate-150 dark:border-slate-800">
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-slate-400 mr-1">#{it.itemNo}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                              {it.materialDesc}
                            </span>
                            {it.drawingNo && (
                              <span className="ml-1 text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-600 px-1 rounded font-mono">
                                Drw: {it.drawingNo}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-slate-600 dark:text-slate-400 shrink-0 font-bold">
                            {it.qty} {it.unit} @ ₹{Number(it.grossPrice).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 border-t border-slate-100 dark:border-slate-800/80 pt-1.5 text-[10px]">
                    <span className="text-slate-400 dark:text-slate-500 block">Payment & Delivery</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                      {activeItem.extractedPO.paymentTerm} • {activeItem.extractedPO.deliveryTerms}
                    </span>
                  </div>
                </div>

                {activeItem.extractedPO.aiInsights && (
                  <div className="mt-2.5 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-[10px] text-amber-800 dark:text-amber-400 leading-normal">
                    <span className="font-bold block">💡 Contract Summary:</span>
                    {activeItem.extractedPO.aiInsights}
                  </div>
                )}
              </div>

              {/* Commit Action Buttons */}
              <div className="pt-3 space-y-2 mt-auto">
                {successfulCount > 1 && (
                  <button
                    id="btn-confirm-all-pos"
                    onClick={handleCommitAll}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Commit All {successfulCount} Extracted POs to Database
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  id="btn-confirm-single-po"
                  onClick={() => handleCommitSingle(activeItem)}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                    successfulCount > 1
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm & Commit PO #{activeItem.extractedPO.orderNo}
                </button>
              </div>
            </div>
          ) : activeItem?.status === 'error' ? (
            <div className="text-center my-auto py-10 flex flex-col items-center justify-center space-y-2">
              <AlertCircle className="h-10 w-10 text-rose-500" />
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                Extraction Notice for {activeItem.name}
              </p>
              <p className="text-[10px] text-slate-400 max-w-[220px]">
                {activeItem.error || 'Please verify document format.'}
              </p>
            </div>
          ) : (
            <div className="text-center my-auto py-12 flex flex-col items-center justify-center space-y-2">
              <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Ready to Extract
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[220px] leading-normal mx-auto">
                  Upload your TATA Steel Purchase Order PDF(s) on the left to preview extracted items, rates, and parameters.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
