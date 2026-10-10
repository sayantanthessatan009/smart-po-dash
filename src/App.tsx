import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  ClipboardList,
  AlertTriangle,
  FolderSync,
  TrendingUp,
  Clock,
  LogOut,
  Bell,
  Search,
  Plus,
  ArrowRight,
  TrendingDown,
  ExternalLink,
  Edit2,
  Trash2,
  Filter,
  CheckCircle,
  HelpCircle,
  Database,
  X,
  FileSpreadsheet,
  Download,
  Moon,
  Sun,
  Briefcase,
  MessageSquare,
  MapPin,
  Calendar,
  Key,
  Check
} from 'lucide-react';

import { PO, SystemAlert, POItem } from './types';
import KPICard from './components/KPICard';
import StatsSection from './components/StatsSection';
import ParserSection from './components/ParserSection';
import POViewer from './components/POViewer';
import AICopilotChat from './components/AICopilotChat';
import { isSupabaseConfigured, syncPOToSupabase, syncAllPOsToSupabase, fetchPOsFromSupabase, deletePOFromSupabase, setSupabaseCredentials, saveSupabaseCredentialsToLocalStorage, clearSupabaseCredentialsFromLocalStorage } from './lib/supabase';

// Helper function to decode Markdown response from Gemini into a beautiful UI without external markdown package overheads
function renderMarkdown(md: string) {
  if (!md) return null;
  const lines = md.split('\n');
  return lines.map((line, ix) => {
    if (line.startsWith('### ')) {
      return (
        <h4 key={ix} className="text-sm font-extrabold text-indigo-900 dark:text-[#a5b4fc] mt-4 mb-2 flex items-center gap-1.5">
          <span className="w-1 h-3.5 bg-indigo-500 dark:bg-indigo-400 rounded-sm" />
          {line.replace('### ', '')}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={ix} className="text-sm font-black text-[#1e293b] dark:text-slate-150 mt-5 mb-2.5 border-b border-slate-100 dark:border-slate-800 pb-1.5 uppercase tracking-wide">
          {line.replace('## ', '')}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={ix} className="text-base font-extrabold text-blue-800 dark:text-blue-400 mt-6 mb-3 flex items-center gap-2">
          {line.replace('# ', '')}
        </h2>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.substring(2);
      return (
        <li key={ix} className="text-[11px] text-slate-700 dark:text-slate-300 ml-4 list-disc my-1 pl-1 leading-relaxed">
          {text.includes('**') ? decodeBolds(text) : text}
        </li>
      );
    }
    if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, '');
      return (
        <li key={ix} className="text-[11px] text-slate-700 dark:text-slate-300 ml-5 list-decimal my-1.5 pl-1 leading-relaxed">
          {text.includes('**') ? decodeBolds(text) : text}
        </li>
      );
    }
    if (line.trim() === '') {
      return <div key={ix} className="h-1.5" />;
    }
    return (
      <p key={ix} className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed my-1 font-sans">
        {line.includes('**') ? decodeBolds(line) : line}
      </p>
    );
  });
}

function decodeBolds(line: string) {
  const parts = line.split('**');
  return parts.map((part, pidx) => pidx % 2 === 1 ? (
    <strong key={pidx} className="font-bold text-slate-900 dark:text-white bg-blue-50/45 dark:bg-indigo-950/40 px-1 rounded">
      {part}
    </strong>
  ) : part);
}

function formatSupabaseError(lastError: string): string {
  if (!lastError) return 'Unknown connection or database error.';
  const errStr = String(lastError).toLowerCase();
  if (errStr.includes('relation "purchase_orders" does not exist') || errStr.includes('relation "public.purchase_orders" does not exist')) {
    return 'CRITICAL ERROR: Table "purchase_orders" does not exist in your Supabase database yet. Run the SQL schema script provided in Settings to create it.';
  }
  if (errStr.includes('column') || errStr.includes('does not exist') || errStr.includes('mismatch')) {
    return `SCHEMA MISMATCH ERROR: Your existing Supabase "purchase_orders" table is missing columns or has an outdated schema. Please run the SQL schema script in Settings to re-create the table. (Details: ${lastError})`;
  }
  if (errStr.includes('invalid input syntax for type uuid')) {
    return 'ID TYPE MISMATCH: Your existing table is using "uuid" for the "id" column, but the app uses the Purchase Order Number (TEXT) as the unique ID. Run the SQL script in Settings to drop and recreate the table.';
  }
  return `Supabase error: ${lastError}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'maintenance' | 'parser' | 'alerts' | 'settings' | 'reports' | 'chat'>('dashboard');
  const [pos, setPOs] = useState<PO[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [poToDeleteModal, setPoToDeleteModal] = useState<PO | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [plantFilter, setPlantFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsSearchQuery, setItemsSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tata_po_theme') === 'dark';
    } catch {
      return false;
    }
  });

  // Report/Actions State
  const [aiReportContent, setAiReportContent] = useState<string>('');
  const [isCompilingReport, setIsCompilingReport] = useState<boolean>(false);
  const [checklist, setChecklist] = useState<{id: string; title: string; category: string; targetPO: string; done: boolean}[]>([
    { id: 'act-1', title: 'Issue dispatch warning notice to Precision Spares (due to delayed drawing approvals).', category: 'Delay Contingency', targetPO: '2101032846/T03', done: false },
    { id: 'act-2', title: 'Verify packing pallet certificates for greater than 20kg structural spares.', category: 'Gate Compliance', targetPO: '2101031888/A01', done: false },
    { id: 'act-3', title: 'Request dynamic eta coordinates via logistics secondary provider.', category: 'Transit Optimization', targetPO: '2101027608/A01', done: false },
    { id: 'act-4', title: 'Audit and approve gate physical release draft.', category: 'Logistics Action', targetPO: '2101010485/101', done: false },
    { id: 'act-5', title: 'Coordinate with Sneha Bagchi at Kalinganagar for bulk storage approvals.', category: 'Warehouse Planning', targetPO: 'Tinplate Division', done: true }
  ]);

  // AI Configuration State (Gemini Flash Latest as Default, Groq GPT-OSS as Fallback)
  const [manualGeminiKey, setManualGeminiKey] = useState(() => {
    try {
      return localStorage.getItem('tata_gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [manualGroqKey, setManualGroqKey] = useState(() => {
    try {
      return localStorage.getItem('tata_groq_api_key') || '';
    } catch {
      return '';
    }
  });
  const [aiKeyStatus, setAiKeyStatus] = useState<string | null>(null);

  const handleSaveAiKeys = () => {
    try {
      if (manualGeminiKey.trim()) {
        localStorage.setItem('tata_gemini_api_key', manualGeminiKey.trim());
      } else {
        localStorage.removeItem('tata_gemini_api_key');
      }
      if (manualGroqKey.trim()) {
        localStorage.setItem('tata_groq_api_key', manualGroqKey.trim());
      } else {
        localStorage.removeItem('tata_groq_api_key');
      }
      setAiKeyStatus('AI configuration saved! Gemini Flash Latest will act as default engine, with Groq GPT-OSS as automatic fallback.');
      setTimeout(() => setAiKeyStatus(null), 4000);
    } catch (e: any) {
      setAiKeyStatus('Failed to save keys: ' + e.message);
    }
  };

  // Hook to persist theme and set dark mode body background
  useEffect(() => {
    try {
      localStorage.setItem('tata_po_theme', isDark ? 'dark' : 'light');
    } catch (e) {
      console.error(e);
    }
  }, [isDark]);
  
  // State for manual PO Creation/Edit Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPOForm, setNewPOForm] = useState<Partial<PO>>({
    orderNo: '',
    companyName: 'TATA STEEL LIMITED',
    location: 'Kalinganagar Industrial Estate',
    orderDate: new Date().toISOString().split('T')[0],
    releaseDate: new Date().toISOString().split('T')[0],
    contactPerson: '',
    contactEmail: '',
    vendorCode: 'P056',
    vendorName: 'PRECISION SPARES MFG CO',
    vendorEmail: 'precision.spares@yahoo.co.in',
    paymentTerm: '100% within 45 days of satisfactory receipt of Material',
    deliveryTerms: 'Ex Works 3PL',
    status: 'Released',
    items: []
  });
  
  // Staging state for a single item being added to the new PO form
  const [itemFormStaging, setItemFormStaging] = useState<Partial<POItem>>({
    itemNo: '00010',
    materialNo: '',
    materialDesc: '',
    materialGroup: '307',
    materialGroupDesc: 'DRAWING MECHANICAL',
    qty: 1,
    unit: 'NOS',
    grossPrice: 0,
    unloadingPoint: 'Blast Furc Mech'
  });

  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [manualSupabaseUrl, setManualSupabaseUrl] = useState(() => {
    try {
      return localStorage.getItem('tata_supabase_url') || '';
    } catch {
      return '';
    }
  });
  const [manualSupabaseAnonKey, setManualSupabaseAnonKey] = useState(() => {
    try {
      return localStorage.getItem('tata_supabase_anon_key') || '';
    } catch {
      return '';
    }
  });

  const handleSaveManualSupabase = () => {
    if (!manualSupabaseUrl.trim() || !manualSupabaseAnonKey.trim()) {
      alert('Please enter both Supabase URL and Anon Key.');
      return;
    }
    saveSupabaseCredentialsToLocalStorage(manualSupabaseUrl.trim(), manualSupabaseAnonKey.trim());
    setSupabaseConnected(true);
    setSupabaseMessage({ text: 'Credentials saved! Connection to Supabase Cloud active. Any new or modified POs will sync in real time.', type: 'success' });
  };

  const handleClearManualSupabase = () => {
    clearSupabaseCredentialsFromLocalStorage();
    setManualSupabaseUrl('');
    setManualSupabaseAnonKey('');
    setSupabaseConnected(isSupabaseConfigured());
    setSupabaseMessage({ text: 'Manual credentials cleared. Reverted to backend environment variables.', type: 'info' });
  };

  const [isPullingSupabase, setIsPullingSupabase] = useState(false);
  const [isPushingSupabase, setIsPushingSupabase] = useState(false);
  const [supabaseMessage, setSupabaseMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Manual pull from Supabase Cloud
  const handlePullFromSupabase = async () => {
    if (!isSupabaseConfigured()) {
      setSupabaseMessage({ text: 'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', type: 'error' });
      return;
    }

    setIsPullingSupabase(true);
    setSupabaseMessage({ text: 'Connecting and fetching purchase orders from Supabase...', type: 'info' });

    try {
      const dbPOs = await fetchPOsFromSupabase() || [];
      if (!dbPOs || dbPOs.length === 0) {
        setSupabaseMessage({ text: 'Connection successful! However, no purchase orders were found in your Supabase database table.', type: 'info' });
        return;
      }

      // Merge Supabase POs with existing ones in state
      setPOs(prev => {
        const deduplicate = (arr: PO[]) => {
          const seen = new Set<string>();
          return arr.filter(p => {
            if (!p || !p.id) return false;
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        };

        const uniquePrev = deduplicate(prev);
        const uniqueDbPOs = deduplicate(dbPOs);

        const poMap = new Map<string, PO>();
        // First load all existing ones
        uniquePrev.forEach(p => poMap.set(p.id, p));
        // Then overwrite or add Supabase ones
        uniqueDbPOs.forEach(p => poMap.set(p.id, p));
        const merged = Array.from(poMap.values());

        // Sync back to the local backend cache so the server is updated too!
        fetch('/api/pos/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        })
        .then(res => {
          if (res.ok) console.log('Successfully synced merged list to server.');
        })
        .catch(err => console.error('Failed to sync merged PO list to server:', err));

        return merged;
      });

      setSupabaseMessage({ text: `Successfully pulled ${dbPOs.length} purchase orders from Supabase Cloud. Locally updated and synced to backend server.`, type: 'success' });
    } catch (err: any) {
      console.error('Supabase pull failed:', err);
      setSupabaseMessage({ text: `Failed to pull from Supabase: ${err.message || err}`, type: 'error' });
    } finally {
      setIsPullingSupabase(false);
    }
  };

  // Manual push to Supabase Cloud
  const handlePushToSupabase = async () => {
    if (!isSupabaseConfigured()) {
      setSupabaseMessage({ text: 'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.', type: 'error' });
      return;
    }

    if (pos.length === 0) {
      setSupabaseMessage({ text: 'There are no purchase orders to push.', type: 'info' });
      return;
    }

    setIsPushingSupabase(true);
    setSupabaseMessage({ text: `Pushing ${pos.length} purchase orders to Supabase Cloud in a fast secure batch...`, type: 'info' });

    try {
      const result = await syncAllPOsToSupabase(pos);
      if (result.success) {
        setSupabaseMessage({ text: `Successfully pushed all ${result.count} purchase orders to Supabase Cloud.`, type: 'success' });
      } else {
        const lastError = result.error || 'Unknown error';
        const errorDetail = `Failed to push purchase orders: ${formatSupabaseError(lastError)}`;
        setSupabaseMessage({ text: errorDetail, type: 'error' });
      }
    } catch (err: any) {
      console.error('Supabase push failed:', err);
      setSupabaseMessage({ text: `Failed to push to Supabase: ${err.message || err}`, type: 'error' });
    } finally {
      setIsPushingSupabase(false);
    }
  };

  // Maintain client-side cache as secondary source-of-truth
  useEffect(() => {
    if (hasLoaded) {
      try {
        localStorage.setItem('tata_po_cache', JSON.stringify(pos));
      } catch (e) {
        console.error('Failed to write PO cache to localStorage:', e);
      }
    }
  }, [pos, hasLoaded]);

  useEffect(() => {
    if (hasLoaded) {
      try {
        localStorage.setItem('tata_alerts_cache', JSON.stringify(alerts));
      } catch (e) {
        console.error('Failed to write alerts cache to localStorage:', e);
      }
    }
  }, [alerts, hasLoaded]);

  // Fetch initial POs & Alerts from server and reconcile
  const loadInitialData = async () => {
    try {
      // 0. Fetch Supabase configuration dynamically from server first (bypassing static build env constraints)
      try {
        const configRes = await fetch('/api/supabase-config');
        if (configRes.ok) {
          const config = await configRes.json();
          if (config.supabaseUrl && config.supabaseAnonKey) {
            setSupabaseCredentials(config.supabaseUrl, config.supabaseAnonKey);
            setSupabaseConnected(true);
          }
        }
      } catch (err) {
        console.error('Failed to load dynamic Supabase config from backend:', err);
      }

      let currentPOs: PO[] = [];
      let currentAlerts: SystemAlert[] = [];

      // 1. Fetch POs
      try {
        const posRes = await fetch('/api/pos');
        if (posRes.ok) {
          currentPOs = await posRes.json();
        }
      } catch (e) {
        console.error('Failed to fetch POs:', e);
      }

      // 2. Fetch Alerts
      try {
        const alertsRes = await fetch('/api/alerts');
        if (alertsRes.ok) {
          currentAlerts = await alertsRes.json();
        }
      } catch (e) {
        console.error('Failed to fetch alerts:', e);
      }

      // 2.5 Fetch from Supabase Cloud if configured
      let supabasePOs: PO[] | null = null;
      if (isSupabaseConfigured()) {
        setSupabaseConnected(true);
        try {
          supabasePOs = await fetchPOsFromSupabase();
          console.log('Successfully pre-fetched POs from Supabase Cloud.');
        } catch (err) {
          console.error('Failed to pre-fetch POs from Supabase during initialization:', err);
        }
      }

      // 3. Reconcile with localStorage cache and Supabase Cloud
      let cachedPOs: PO[] = [];
      try {
        const cachedPOStr = localStorage.getItem('tata_po_cache');
        if (cachedPOStr) cachedPOs = JSON.parse(cachedPOStr);
      } catch (err) {
        console.warn('Error reading PO cache:', err);
      }

      let cachedAlerts: SystemAlert[] = [];
      try {
        const cachedAlertStr = localStorage.getItem('tata_alerts_cache');
        if (cachedAlertStr) cachedAlerts = JSON.parse(cachedAlertStr);
      } catch (err) {
        console.warn('Error reading alerts cache:', err);
      }

      const deduplicate = (arr: PO[]) => {
        const seen = new Set<string>();
        return arr.filter(p => {
          if (!p || !p.id) return false;
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      };

      const uniqueCurrentPOs = deduplicate(currentPOs);
      const uniqueCachedPOs = deduplicate(cachedPOs);
      const uniqueSupabasePOs = supabasePOs ? deduplicate(supabasePOs) : null;
      // Reconcile with Supabase as master database if active
      let finalPOs: PO[] = [];
      let isSupabaseAuthorizedSeedNeeded = false;

      if (uniqueSupabasePOs !== null) {
        // Supabase is configured and successfully fetched
        if (uniqueSupabasePOs.length > 0) {
          // Supabase has records, it is the master source of truth. Wipe out any other local state/stale cache.
          finalPOs = uniqueSupabasePOs;
        } else {
          // Supabase is configured but empty (e.g. brand new table). We seed Supabase with our local data.
          const localMap = new Map<string, PO>();
          uniqueCurrentPOs.forEach(p => localMap.set(p.id, p));
          uniqueCachedPOs.forEach(p => localMap.set(p.id, p));
          finalPOs = Array.from(localMap.values());
          isSupabaseAuthorizedSeedNeeded = finalPOs.length > 0;
        }
      } else {
        // Supabase is not configured yet or fetching failed. Reconcile with local server and browser caches.
        const localMap = new Map<string, PO>();
        uniqueCurrentPOs.forEach(p => localMap.set(p.id, p));
        uniqueCachedPOs.forEach(p => localMap.set(p.id, p));
        finalPOs = Array.from(localMap.values());
      }

      // Check if we need to sync the reconciled results back to the server's local memory/file
      const finalPOMap = new Map<string, PO>();
      finalPOs.forEach(p => finalPOMap.set(p.id, p));

      const needsPOSync = uniqueCurrentPOs.length !== finalPOs.length || 
        uniqueCurrentPOs.some(serverPO => {
          const mergedPO = finalPOMap.get(serverPO.id);
          return !mergedPO || JSON.stringify(mergedPO) !== JSON.stringify(serverPO);
        });

      /*
 
       // 1. Load server POs first (as baseline)
       uniqueCurrentPOs.forEach(p => poMap.set(p.id, p));
 
       // 2. Merge local cache (overwrite baseline if cache has it, since cache represents user's latest browser state)
       if (uniqueCachedPOs.length > 0) {
         uniqueCachedPOs.forEach(p => {
           poMap.set(p.id, p);
         });
       }
 
       // 3. Merge Supabase POs (ultimate cloud source of truth, overwrite anything else)
       if (uniqueSupabasePOs && uniqueSupabasePOs.length > 0) {
         uniqueSupabasePOs.forEach(p => {
           poMap.set(p.id, p);
         });
       }
 
       let finalPOs = Array.from(poMap.values());
 
       // Check if we need to sync the merged results back to the server's local file
       const needsPOSync = uniqueCurrentPOs.length !== finalPOs.length || 
         uniqueCurrentPOs.some(serverPO => {
           const mergedPO = poMap.get(serverPO.id);
           return !mergedPO || JSON.stringify(mergedPO) !== JSON.stringify(serverPO);
         }) || (uniqueSupabasePOs && uniqueSupabasePOs.length > 0);

      */
      let needsAlertSync = false;
      let finalAlerts = [...currentAlerts];
      if (cachedAlerts.length > 0) {
        // Find cached alerts not present on server
        const missingAlerts = cachedAlerts.filter(cached => !currentAlerts.some(server => server.id === cached.id));
        if (missingAlerts.length > 0) {
          finalAlerts = [...finalAlerts, ...missingAlerts];
          needsAlertSync = true;
        }
      }

      // 4. Update local state
      setPOs(finalPOs);
      setAlerts(finalAlerts);
      setHasLoaded(true);

      // 5. Heal server-side ephemeral database files if needed
      if (needsPOSync && finalPOs.length > 0) {
        console.log(`Auto-healing: Syncing ${finalPOs.length} POs back to server...`);
        fetch('/api/pos/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPOs)
        }).catch(err => console.error('Failed to sync POs during auto-healing:', err));
      }

      // 5.5 Auto-backup newly added/reconciled local/server POs to Supabase Cloud on startup if configured
      if (isSupabaseConfigured() && isSupabaseAuthorizedSeedNeeded && finalPOs.length > 0) {
        console.log(`Auto-backing up ${finalPOs.length} POs to Supabase Cloud...`);
        syncAllPOsToSupabase(finalPOs).then(result => {
          if (result.success) {
            console.log(`Successfully auto-backed up ${result.count} POs to Supabase Cloud.`);
          } else {
            console.warn('Auto-backup to Supabase Cloud failed:', result.error);
          }
        }).catch(err => console.error('Auto-backup to Supabase exception:', err));
      }

      if (needsAlertSync && finalAlerts.length > 0) {
        console.log(`Auto-healing: Syncing ${finalAlerts.length} Alerts back to server...`);
        fetch('/api/alerts/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalAlerts)
        }).catch(err => console.error('Failed to sync alerts during auto-healing:', err));
      }

    } catch (e) {
      console.error('Error fetching data from API endpoints:', e);
      // Fallback directly to cache if fetch fails completely
      try {
        const cachedPOStr = localStorage.getItem('tata_po_cache');
        if (cachedPOStr) setPOs(JSON.parse(cachedPOStr));
        const cachedAlertStr = localStorage.getItem('tata_alerts_cache');
        if (cachedAlertStr) setAlerts(JSON.parse(cachedAlertStr));
      } catch (err) {
        console.error('Cache fallback failed:', err);
      }
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    loadInitialData();
    setSupabaseConnected(isSupabaseConfigured());
  }, []);

  // Update real status flow
  const handleUpdatePOStatus = async (id: string, status: PO['status']) => {
    const poToUpdate = pos.find(p => p.id === id || p.orderNo === id);
    const targetId = poToUpdate?.id || id;

    // Optimistically update React state
    setPOs(prev => prev.map(p => (p.id === targetId || p.orderNo === id || p.id === id) ? { ...p, status } : p));
    if (selectedPO?.id === targetId || selectedPO?.id === id) {
      setSelectedPO(prev => prev ? { ...prev, status } : null);
    }

    try {
      const encodedId = encodeURIComponent(targetId);
      const response = await fetch(`/api/pos/${encodedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        const updated = await response.json();
        setPOs(prev => prev.map(p => p.id === updated.id ? updated : p));
        if (selectedPO?.id === updated.id) {
          setSelectedPO(updated);
        }
        
        // Refresh Alerts
        const alertsRes = await fetch('/api/alerts');
        if (alertsRes.ok) {
          setAlerts(await alertsRes.json());
        }

        // Auto-sync status update to Supabase
        if (supabaseConnected || isSupabaseConfigured()) {
          setSupabaseMessage({ text: `Syncing status update for PO ${updated.orderNo || id} to Supabase Cloud...`, type: 'info' });
          const syncRes = await syncPOToSupabase(updated);
          if (syncRes.success) {
            setSupabaseMessage({ text: `Successfully synced status update for PO ${updated.orderNo || id} to Supabase Cloud.`, type: 'success' });
          } else {
            const formattedErr = formatSupabaseError(syncRes.error || 'Unknown error');
            setSupabaseMessage({ text: `Status updated locally. Supabase note: ${formattedErr}`, type: 'error' });
          }
        }
      }
    } catch (error) {
      console.error('Failed to update status on server:', error);
    }
  };

  // Add parsed or newly generated Purchase Order
  const handleAddParsedPO = async (po: PO) => {
    try {
      const response = await fetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(po)
      });

      if (response.ok) {
        const addedPO = await response.json();
        setPOs(prev => [addedPO, ...prev.filter(p => p.id !== addedPO.id)]);
        setActiveTab('maintenance');
        
        // Refresh Alerts
        const alertsRes = await fetch('/api/alerts');
        if (alertsRes.ok) {
          setAlerts(await alertsRes.json());
        }

        // Sync in cloud database (Supabase)
        if (supabaseConnected || isSupabaseConfigured()) {
          setSupabaseMessage({ text: `Real-time Syncing new purchase order ${addedPO.orderNo || addedPO.id} to Supabase Cloud...`, type: 'info' });
          const syncRes = await syncPOToSupabase(addedPO);
          if (syncRes.success) {
            setSupabaseMessage({ text: `Successfully synced new purchase order ${addedPO.orderNo || addedPO.id} to Supabase Cloud!`, type: 'success' });
          } else {
            const formattedErr = formatSupabaseError(syncRes.error || 'Unknown error');
            setSupabaseMessage({ text: `Failed to sync new PO ${addedPO.orderNo || addedPO.id} to Supabase: ${formattedErr}`, type: 'error' });
          }
        }
      }
    } catch (error) {
      console.error('Failed to commit parsed PO to server:', error);
    }
  };

  // Batch Add / Commit multiple parsed Purchase Orders
  const handleAddParsedPOs = async (newPOs: PO[]) => {
    try {
      if (!newPOs || newPOs.length === 0) return;

      const response = await fetch('/api/pos/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos: newPOs })
      });

      if (response.ok) {
        const result = await response.json();
        const savedList: PO[] = result.pos || newPOs;
        const savedIds = new Set(savedList.map(p => p.id));
        
        setPOs(prev => [...savedList, ...prev.filter(p => !savedIds.has(p.id))]);
        setActiveTab('maintenance');

        // Refresh Alerts
        const alertsRes = await fetch('/api/alerts');
        if (alertsRes.ok) {
          setAlerts(await alertsRes.json());
        }

        // Sync batch in cloud database (Supabase)
        if (supabaseConnected || isSupabaseConfigured()) {
          setSupabaseMessage({ text: `Batch syncing ${savedList.length} purchase orders to Supabase Cloud...`, type: 'info' });
          let successCount = 0;
          for (const item of savedList) {
            const syncRes = await syncPOToSupabase(item);
            if (syncRes.success) successCount++;
          }
          setSupabaseMessage({ text: `Successfully synced ${successCount}/${savedList.length} batch POs to Supabase Cloud!`, type: 'success' });
        }
      } else {
        // Fallback to sequential commit if batch endpoint encounters issue
        for (const singlePo of newPOs) {
          await handleAddParsedPO(singlePo);
        }
      }
    } catch (error) {
      console.error('Failed to batch commit parsed POs to server:', error);
    }
  };

  // Delete Purchase Order Trigger
  const handleDeletePO = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const poToDelete = pos.find(p => p.id === id || p.orderNo === id);
    if (poToDelete) {
      setPoToDeleteModal(poToDelete);
    } else {
      executeDeletePO(id, id);
    }
  };

  const executeDeletePO = async (targetId: string, targetOrderNo: string) => {
    // 1. Immediate optimistic removal from UI state
    setPOs(prev => prev.filter(p => p.id !== targetId && p.orderNo !== targetOrderNo && p.id !== targetOrderNo && p.orderNo !== targetId));
    if (selectedPO?.id === targetId || selectedPO?.orderNo === targetOrderNo || selectedPO?.id === targetOrderNo) {
      setSelectedPO(null);
    }

    try {
      // 2. Send DELETE request to local Express backend with URL-encoding
      const encodedId = encodeURIComponent(targetId);
      const res = await fetch(`/api/pos/${encodedId}`, { method: 'DELETE' });
      if (!res.ok && targetOrderNo !== targetId) {
        const encodedOrderNo = encodeURIComponent(targetOrderNo);
        await fetch(`/api/pos/${encodedOrderNo}`, { method: 'DELETE' });
      }

      // 3. Auto-Sync deletion with Supabase Cloud
      if (supabaseConnected || isSupabaseConfigured()) {
        setSupabaseMessage({ text: `Syncing deletion of PO ${targetOrderNo} with Supabase Cloud...`, type: 'info' });
        
        let syncSuccess = await deletePOFromSupabase(targetId);
        if (!syncSuccess && targetOrderNo !== targetId) {
          syncSuccess = await deletePOFromSupabase(targetOrderNo);
        }

        if (syncSuccess) {
          setSupabaseMessage({ text: `Successfully deleted PO ${targetOrderNo} from Supabase Cloud!`, type: 'success' });
        } else {
          setSupabaseMessage({ text: `Deleted PO ${targetOrderNo} locally and updated JSON cache.`, type: 'info' });
        }
      }
    } catch (error) {
      console.error('Failed to delete PO:', error);
    }
  };

  const confirmDeletePO = () => {
    if (!poToDeleteModal) return;
    const target = poToDeleteModal;
    setPoToDeleteModal(null);
    executeDeletePO(target.id, target.orderNo || target.id);
  };

  // Dismiss alert message
  const handleDismissAlert = async (id: string) => {
    try {
      const response = await fetch('/api/alerts/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: id })
      });
      if (response.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
      }
    } catch (error) {
      console.error('Error clearing alarm:', error);
    }
  };

  // Clear all alerts
  const handleClearAllAlerts = async () => {
    try {
      const response = await fetch('/api/alerts/clear-all', { method: 'POST' });
      if (response.ok) {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Compile active PO parameters into an Excel-compatible CSV file and trigger download
  const handleDownloadWeeklyExcel = () => {
    // UTF-8 Byte Order Mark (BOM) ensures Microsoft Excel decodes all Indian currency and contact details without layout warnings
    const BOM = "\uFEFF";
    let csv = "Order No,Company Name,Location,Order Date,Validity End,Vendor Code,Vendor Name,Payment Term,Delivery Term,Status,Total PO Value,Item No,Material No,Material Desc,Qty,Unit,UMC,Gross Price (Individual Price),Total Item Value,Unloading Point,Packing Charges,Forwarding Charges,Delivery Days,Drawing Number,Part Number,Model Number,Make\n";
    
    filteredPOs.forEach(po => {
      const escapedCompanyName = `"${po.companyName?.replace(/"/g, '""') || ''}"`;
      const escapedLocation = `"${po.location?.replace(/"/g, '""') || ''}"`;
      const escapedVendorName = `"${po.vendorName?.replace(/"/g, '""') || ''}"`;
      const escapedPayTerms = `"${po.paymentTerm?.replace(/"/g, '""') || ''}"`;
      const escapedDelTerms = `"${po.deliveryTerms?.replace(/"/g, '""') || ''}"`;
      const escapedStatus = po.status || 'Released';
      const totalPOValue = po.totalOrderValue || 0;
      
      if (po.items && po.items.length > 0) {
        po.items.forEach(it => {
          const itemNo = it.itemNo || '';
          const materialNo = it.materialNo || '';
          const materialDesc = `"${it.materialDesc?.replace(/"/g, '""') || ''}"`;
          const qty = it.qty || 0;
          const unit = `"${it.unit?.replace(/"/g, '""') || ''}"`;
          const umc = `"${it.umc?.replace(/"/g, '""') || it.unit?.replace(/"/g, '""') || ''}"`;
          const grossPrice = it.grossPrice || 0;
          const totalValue = it.totalValue || 0;
          const unloadingPoint = `"${it.unloadingPoint?.replace(/"/g, '""') || ''}"`;
          const packingCharges = it.packingCharges || 0;
          const forwardingCharges = it.forwardingCharges || 0;
          const delDays = it.delDays !== undefined ? it.delDays : '';
          const drawingNo = `"${it.drawingNo?.replace(/"/g, '""') || ''}"`;
          const partNo = `"${it.partNo?.replace(/"/g, '""') || it.materialNo?.replace(/"/g, '""') || ''}"`;
          const modelNo = `"${it.modelNo?.replace(/"/g, '""') || ''}"`;
          const make = `"${it.make?.replace(/"/g, '""') || ''}"`;
          
          csv += `${po.orderNo},${escapedCompanyName},${escapedLocation},${po.orderDate},${po.validityEnd || ''},${po.vendorCode},${escapedVendorName},${escapedPayTerms},${escapedDelTerms},${escapedStatus},${totalPOValue},${itemNo},${materialNo},${materialDesc},${qty},${unit},${umc},${grossPrice},${totalValue},${unloadingPoint},${packingCharges},${forwardingCharges},${delDays},${drawingNo},${partNo},${modelNo},${make}\n`;
        });
      } else {
        csv += `${po.orderNo},${escapedCompanyName},${escapedLocation},${po.orderDate},${po.validityEnd || ''},${po.vendorCode},${escapedVendorName},${escapedPayTerms},${escapedDelTerms},${escapedStatus},${totalPOValue},"","","","","","","",0,"",0,0,"","","","",""\n`;
      }
    });
    
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fromStr = startDateFilter ? `_From_${startDateFilter}` : '';
    const toStr = endDateFilter ? `_To_${endDateFilter}` : '';
    link.setAttribute("download", `TATA_Steel_Weekly_PO_Database_${new Date().toISOString().split('T')[0]}${fromStr}${toStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compile full database of contracts and alerts with AI Report Strategic Auditor (Gemini-powered)
  const handleCompileAIReport = async () => {
    setIsCompilingReport(true);
    setAiReportContent('');
    try {
      const groqApiKey = localStorage.getItem('tata_groq_api_key') || '';
      const response = await fetch('/api/reports/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos: filteredPOs, alerts, groqApiKey })
      });
      if (response.ok) {
        const data = await response.json();
        setAiReportContent(data.report || 'No strategic recommendation report compiled.');
      } else {
        const errData = await response.json();
        setAiReportContent(`### Compilation Failure\n\n${errData.error || 'Unknown server failure. Please check if Gemini API key (GEMINI_API_KEY) is correctly input under Settings > Secrets.'}`);
      }
    } catch (e: any) {
      setAiReportContent(`### Strategic Report Unreachable\n\nError: ${e.message}. Host network failure.`);
    } finally {
      setIsCompilingReport(false);
    }
  };

  // Form submit for raw creation
  const handleAddItemToForm = () => {
    const qty = Number(itemFormStaging.qty) || 1;
    const price = Number(itemFormStaging.grossPrice) || 0;
    const itemValue = qty * price;

    const newItem: POItem = {
      id: `man_item_${Date.now()}`,
      itemNo: itemFormStaging.itemNo || '00010',
      materialNo: itemFormStaging.materialNo || 'GENERIC-MRO',
      materialDesc: itemFormStaging.materialDesc || 'Generic Maintenance Spare Parts',
      materialGroup: itemFormStaging.materialGroup || '307',
      materialGroupDesc: itemFormStaging.materialGroupDesc || 'MECHANICAL',
      qty,
      unit: itemFormStaging.unit || 'NOS',
      grossPrice: price,
      totalValue: itemValue,
      unloadingPoint: itemFormStaging.unloadingPoint
    };

    setNewPOForm(prev => {
      const items = [...(prev.items || []), newItem];
      return {
        ...prev,
        items,
        totalOrderValue: items.reduce((sum, item) => sum + item.totalValue, 0)
      };
    });

    // Reset item form
    const currentNum = Number(itemFormStaging.itemNo) || 10;
    const nextNumStr = String(currentNum + 10).padStart(5, '0');
    setItemFormStaging({
      itemNo: nextNumStr,
      materialNo: '',
      materialDesc: '',
      materialGroup: '307',
      materialGroupDesc: 'DRAWING MECHANICAL',
      qty: 1,
      unit: 'NOS',
      grossPrice: 0,
      unloadingPoint: 'Blast Furc Mech'
    });
  };

  const handleCreatePOFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPOForm.orderNo) {
      alert('Order Number is required.');
      return;
    }
    if (!newPOForm.items || newPOForm.items.length === 0) {
      alert('Please add at least one material item below first.');
      return;
    }

    let computedValidityEnd = '';
    try {
      if (newPOForm.orderDate) {
        const d = new Date(newPOForm.orderDate);
        if (!isNaN(d.getTime())) {
          computedValidityEnd = new Date(d.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
      }
    } catch (e) {
      console.error('Failed to compute validity end date:', e);
    }

    const createdPO: PO = {
      id: (newPOForm.orderNo || '').replace(/\s+/g, '_').replace(/\//g, '_'),
      orderNo: newPOForm.orderNo || '',
      companyName: newPOForm.companyName || 'TATA STEEL LIMITED',
      location: newPOForm.location || 'Kalinganagar Area',
      orderDate: newPOForm.orderDate || '',
      releaseDate: newPOForm.releaseDate || '',
      validityStart: newPOForm.orderDate,
      validityEnd: computedValidityEnd || undefined, // 6 months validity default or empty if invalid
      contactPerson: newPOForm.contactPerson || 'Sneha Bagchi',
      contactEmail: newPOForm.contactEmail || 'expedite@tatasteel.com',
      vendorCode: newPOForm.vendorCode || 'P056',
      vendorName: newPOForm.vendorName || 'PRECISION SPARES MFG CO',
      vendorEmail: newPOForm.vendorEmail || 'precision.spares@yahoo.co.in',
      totalOrderValue: newPOForm.totalOrderValue || 0,
      currency: 'INR',
      paymentTerm: newPOForm.paymentTerm || '100% within 45 days of sat receipt',
      deliveryTerms: newPOForm.deliveryTerms || 'Ex Works 3PL',
      status: newPOForm.status as PO['status'] || 'Released',
      complianceChecked: true,
      complianceRating: 85,
      items: newPOForm.items || [],
      aiInsights: 'Drafted manually. Schedule and dispatch trackers initiated.'
    };

    handleAddParsedPO(createdPO);
    setShowCreateModal(false);
  };

  // Filter calculations
  const filteredPOs = pos.filter(po => {
    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    
    let matchesPlant = true;
    if (plantFilter !== 'ALL') {
      const loc = (po.location || '').toLowerCase();
      if (plantFilter === 'Kalinganagar') {
        matchesPlant = loc.includes('kalinganagar') || loc.includes('duburi');
      } else if (plantFilter === 'Jamshedpur') {
        matchesPlant = loc.includes('jamshedpur') || loc.includes('tisco') || loc.includes('jam');
      } else if (plantFilter === 'Gamharia') {
        matchesPlant = loc.includes('gamharia') || loc.includes('tgs');
      } else if (plantFilter === 'Others') {
        matchesPlant = !loc.includes('kalinganagar') && !loc.includes('duburi') && 
                       !loc.includes('jamshedpur') && !loc.includes('tisco') && 
                       !loc.includes('gamharia') && !loc.includes('tgs');
      }
    }

    let matchesDate = true;
    if (startDateFilter) {
      matchesDate = matchesDate && po.orderDate >= startDateFilter;
    }
    if (endDateFilter) {
      matchesDate = matchesDate && po.orderDate <= endDateFilter;
    }

    const matchesSearch = 
      (po.orderNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.vendorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.contactPerson || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.items || []).some(it => (it.materialDesc || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesPlant && matchesSearch && matchesDate;
  });

  const unreadAlerts = alerts.filter(a => !a.read);
  const totalValueActive = filteredPOs
    .filter(p => p.status !== 'Delivered')
    .reduce((sum, p) => sum + Number(p.totalOrderValue || 0), 0);

  const pendingDrawingsCount = filteredPOs.filter(p => !p.complianceChecked || (p.complianceRating ?? 0) < 90).length;

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none transition-colors duration-200 ${
      isDark ? 'bg-[#0b0f19] text-[#e2e8f0]' : 'bg-[#f1f5f9] text-[#1e293b]'
    }`}>
      {/* Visual Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-6 py-3 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-blue-800 dark:bg-blue-600 rounded flex items-center justify-center text-white font-extrabold text-xl tracking-tighter">
            T
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-none flex items-center gap-2">
              TATA PO HUB
              <span className="text-[9px] uppercase font-bold tracking-widest bg-blue-100/80 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">Compliance</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supply Chain & Procurement Intelligence</p>
          </div>
        </div>

        {/* Action badges & Clock */}
        <div className="flex items-center gap-3">
          {/* Active AI Status Badge */}
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/50 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="uppercase tracking-wide">Gemini Active</span>
          </div>

          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${
            supabaseConnected 
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-400' 
              : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${supabaseConnected ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="uppercase tracking-wide">
              {supabaseConnected ? 'Supabase Synced' : 'Offline State'}
            </span>
          </div>

          {/* Theme Toggler Button */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 text-slate-400 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-750 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className="relative rounded-lg p-2 text-slate-400 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-[#1f293d] hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Main Full-Width Content Container & Sidebar Grid */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-60 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 p-4 space-y-2 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2">Menu</div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <TrendingUp className={`h-4 w-4 ${activeTab === 'dashboard' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'maintenance'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <ClipboardList className={`h-4 w-4 ${activeTab === 'maintenance' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Purchase Orders</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'maintenance' ? 'bg-blue-100 dark:bg-blue-900 text-blue-850 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>{pos.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('parser')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'parser'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Sparkles className={`h-4 w-4 ${activeTab === 'parser' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span>AI Document Parser</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <MessageSquare className={`h-4 w-4 ${activeTab === 'chat' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">AI Workspace Copilot</span>
              <span className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">LLM</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'reports'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <FileSpreadsheet className={`h-4 w-4 ${activeTab === 'reports' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Reports & Actions</span>
              <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">Audit</span>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'alerts'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <AlertTriangle className={`h-4 w-4 ${activeTab === 'alerts' ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="flex-1 text-left">Dispatch & LD alarms</span>
              {unreadAlerts.length > 0 && (
                <span className="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">{unreadAlerts.length}</span>
              )}
            </button>
          </nav>

          <div className="pt-4">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2">Advanced Config</div>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeTab === 'settings'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                }`}
              >
                <FolderSync className={`h-4 w-4 ${activeTab === 'settings' ? 'text-blue-700' : 'text-slate-400'}`} />
                <span>Supabase Sync Panel</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Tab content area */}
        <main className="flex-1 p-6 space-y-6 overflow-x-hidden">

          {/* Global Real-Time Supabase Sync Message Banner */}
          {supabaseMessage && (
            <div className={`p-4 rounded-xl border text-xs shadow-xs transition-all duration-300 animate-fadeIn ${
              supabaseMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                : supabaseMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-400 font-medium'
                : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-400'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-2 items-center">
                  <span className="flex h-2 w-2 relative mt-0.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      supabaseMessage.type === 'success' ? 'bg-emerald-400' : supabaseMessage.type === 'error' ? 'bg-rose-400' : 'bg-blue-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      supabaseMessage.type === 'success' ? 'bg-emerald-500' : supabaseMessage.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
                    }`}></span>
                  </span>
                  <div>
                    <span className="font-bold mr-1.5">[Supabase Cloud Status]</span>
                    {supabaseMessage.text}
                  </div>
                </div>
                <button 
                  onClick={() => setSupabaseMessage(null)} 
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold ml-2 text-sm cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          
          {/* LOGISTICS TIMELINE DATE PICKER CONTROL PANEL */}
          {activeTab !== 'chat' && (
            <div id="logistics-timeline-control" className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-all flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="p-2 bg-blue-50 dark:bg-slate-800 rounded-lg text-blue-700 dark:text-blue-400 shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-250 uppercase tracking-wider flex items-center gap-2">
                    Logistics Temporal Window
                    {(startDateFilter || endDateFilter) && (
                      <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[9px] lowercase font-extrabold px-1.5 py-0.5 rounded-full">
                        Filter active ({filteredPOs.length} of {pos.length})
                      </span>
                    )}
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    Select release dates to refine active spreadsheets, analytical reports and PDF extractions.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                {/* Pre-sets */}
                <div className="flex gap-1 bg-slate-105 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      !startDateFilter && !endDateFilter 
                        ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                    }`}
                  >
                    All Time
                  </button>
                  <button 
                    onClick={() => { setStartDateFilter('2026-04-01'); setEndDateFilter('2026-06-30'); }}
                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      startDateFilter === '2026-04-01' && endDateFilter === '2026-06-30'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                    }`}
                  >
                    Q1 FY26
                  </button>
                  <button 
                    onClick={() => { setStartDateFilter('2026-01-01'); setEndDateFilter('2026-12-31'); }}
                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                      startDateFilter === '2026-01-01' && endDateFilter === '2026-12-31'
                        ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250'
                    }`}
                  >
                    CY 2026
                  </button>
                </div>

                {/* Date Inputs */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 text-[8px] font-extrabold text-slate-400">FROM</span>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="pl-12 pr-2 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-705 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 focus:outline-hidden"
                    />
                  </div>
                  <span className="text-slate-400 font-extrabold text-xs">→</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 text-[8px] font-extrabold text-slate-400">TO</span>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="pl-8 pr-2 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-705 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Clear Button */}
                {(startDateFilter || endDateFilter) && (
                  <button
                    onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                    className="p-1 px-2 border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-900/60 dark:hover:bg-red-950/20 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    title="Clear date selection"
                  >
                    Clear <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Row: KPI summaries */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  id="kpi-total-val"
                  title="Total Values Active"
                  value={`₹${totalValueActive.toLocaleString()}`}
                  icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
                  description="Outstanding active procurement capital"
                  colorClass="bg-blue-50/70 border-blue-500"
                />
                <KPICard
                  id="kpi-pos-count"
                  title="Total PO Volume"
                  value={pos.length}
                  icon={<Layers className="h-5 w-5 text-slate-700" />}
                  description="Indexed purchase agreement sheets"
                  colorClass="bg-slate-50 border-slate-700"
                  onClick={() => setActiveTab('maintenance')}
                />
                <KPICard
                  id="kpi-drawings"
                  title="Pending Compliance Checks"
                  value={pendingDrawingsCount}
                  icon={<Sparkles className="h-5 w-5 text-purple-600" />}
                  description="Requires drawing or validity reviews"
                  colorClass="bg-purple-50/70 border-purple-500"
                  onClick={() => setActiveTab('alerts')}
                />
                <KPICard
                  id="kpi-active-alerts"
                  title="Outstanding Alarms"
                  value={unreadAlerts.length}
                  icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                  description="Validity warnings / LD penalties at risk"
                  colorClass="bg-red-50/70 border-red-500"
                  onClick={() => setActiveTab('alerts')}
                />
              </div>

              {/* Middle Row: Tech Recharts layouts */}
              <StatsSection pos={filteredPOs} />
              
              {/* Quick dispatch tracking list panel */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Dispatch Compliance Tracker</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Estimated Arrival (ETA) checklist monitor (filtered to temporal range)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredPOs.map(po => (
                    <div
                      key={po.id}
                      onClick={() => setSelectedPO(po)}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800/80 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">{po.orderNo}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase truncate max-w-[80px] ${
                          po.status === 'Delivered' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' :
                          po.status === 'Dispatched' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300' :
                          po.status === 'Delayed' ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300' :
                          po.status === 'Preponement of Delivery Schedule' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300' :
                          'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`} title={po.status}>
                          {po.status === 'Preponement of Delivery Schedule' ? 'Preponed' : po.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">{po.vendorName}</p>
                      
                      <div className="border-t border-slate-200 dark:border-slate-800/80 pt-2 mt-2 space-y-1.5 text-[11px]">
                        <p className="flex justify-between">
                          <span className="text-slate-400 dark:text-slate-500">ETA target:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{po.etaDate || 'N/A'}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-400 dark:text-slate-500">Compliance score:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{po.complianceRating}%</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              {/* Maintenance Tools Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-100 p-4 rounded-xl shadow-xs">
                {/* Search and Filters */}
                <div className="flex flex-1 w-full gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search POs by Vendor, item parts, contact names..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-slate-400 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-150 rounded-lg px-3 py-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-transparent focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All PO Statuses</option>
                      <option value="Released">Released</option>
                      <option value="In Production">In Production</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Delayed">Delayed</option>
                      <option value="Preponement of Delivery Schedule">Preponed Dispatch</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-150 rounded-lg px-3 py-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <select
                      value={plantFilter}
                      onChange={(e) => setPlantFilter(e.target.value)}
                      className="bg-transparent focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Plants / Locations</option>
                      <option value="Kalinganagar">Kalinganagar Plant</option>
                      <option value="Jamshedpur">Jamshedpur Plant</option>
                      <option value="Gamharia">Gamharia Plant</option>
                      <option value="Others">Other areas</option>
                    </select>
                  </div>
                </div>

                <div className="w-full sm:w-auto">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Create Custom PO
                  </button>
                </div>
              </div>

              {/* Purchase Orders Table Panel */}
              <div className="rounded-xl border border-slate-150 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-5 py-3">Order No</th>
                      <th className="px-5 py-3">Location & Supplier</th>
                      <th className="px-5 py-3 text-right">Items Volume</th>
                      <th className="px-5 py-3 text-right font-medium">Value (INR)</th>
                      <th className="px-5 py-3">Terms Key</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPOs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                          No Purchase Orders matched your active criteria. Try adjusting the search keywords.
                        </td>
                      </tr>
                    ) : (
                      filteredPOs.map((po) => (
                        <tr
                          key={po.id}
                          onClick={() => setSelectedPO(po)}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-4 font-mono font-bold text-slate-950">
                            {po.orderNo}
                            <span className="block text-[10px] text-slate-400 font-normal">Date: {po.orderDate}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold block text-slate-800 truncate max-w-[150px]">{po.vendorName}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">{po.location}</span>
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-slate-850">
                            {(po.items || []).length} parts
                            <span className="block text-[10px] text-slate-400 font-normal">
                              ({(po.items || []).reduce((sum, item) => sum + item.qty, 0)} units)
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-bold text-slate-900">
                            ₹{Number(po.totalOrderValue || 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-4 text-xs font-semibold text-slate-500">
                            <span className="block truncate max-w-[120px]">{po.deliveryTerms}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">{po.paymentTerm}</span>
                          </td>
                          <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={po.status}
                              onChange={(e) => handleUpdatePOStatus(po.id, e.target.value as PO['status'])}
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-slate-400 ${
                                po.status === 'Delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                po.status === 'Dispatched' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                po.status === 'Delayed' ? 'bg-red-50 text-red-800 border-red-200' :
                                po.status === 'Preponement of Delivery Schedule' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <option value="Released">Released</option>
                              <option value="In Production">In Production</option>
                              <option value="Dispatched">Dispatched</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Delayed">Delayed</option>
                              <option value="Preponement of Delivery Schedule">Preponed Dispatch</option>
                            </select>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={(e) => handleDeletePO(po.id, e)}
                              className="p-2 text-slate-400 hover:text-red-550 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete Purchase Contract"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'parser' && (
            <div className="space-y-6">
              <ParserSection 
                onAddParsedPO={handleAddParsedPO} 
                onAddParsedPOs={handleAddParsedPOs}
              />
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              {/* Alarms maintainer */}
              <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Dispatch, Gateway, & LD Penalty Alarms</h3>
                    <p className="text-xs text-slate-400">Keep track of critical gate entries and liquidated damages risks</p>
                  </div>
                  {alerts.length > 0 && (
                    <button
                      onClick={handleClearAllAlerts}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-100 transition-colors"
                    >
                      Dismiss All Alarms
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-12">No alerts generated currently.</p>
                  ) : (
                    alerts.map((al) => (
                      <div
                        key={al.id}
                        className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
                          al.read ? 'bg-slate-50/50 border-slate-100 opacity-60' :
                          al.severity === 'high' ? 'bg-red-50/60 border-red-100 text-red-950 font-medium' :
                          al.severity === 'medium' ? 'bg-amber-50/60 border-amber-100 text-amber-950' : 'bg-blue-50/60 border-blue-100 text-blue-950'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-lg p-2 mt-0.5 ${
                            al.severity === 'high' ? 'bg-red-100 text-red-600' :
                            al.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{al.title}</span>
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">PO: {al.poNo}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-normal max-w-2xl">{al.message}</p>
                            <span className="text-[10px] text-slate-450 block mt-2 font-medium">{al.date}</span>
                          </div>
                        </div>

                        {!al.read && (
                          <button
                            onClick={() => handleDismissAlert(al.id)}
                            className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Main title bar of the command center */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                       <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                       Strategic Reports & Logistics Command Central
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Assess financial exposure under Liquidated Damages, track contract timelines, download weekly databases, and compile corporate strategic audits.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <button
                      onClick={handleDownloadWeeklyExcel}
                      className="text-xs font-bold bg-[#1e293b] hover:bg-[#0f172a] dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      Download Weekly Database (Excel CSV)
                    </button>
                  </div>
                </div>
              </div>

              {/* Top Row Grid: Excel Database Downloader info card + Action Items Checklist board */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visual Card 1: Exporter Spec Sheet */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between transition-colors">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-450 mb-3 flex items-center gap-1.5">
                      <Database className="h-4 w-4 text-slate-400" />
                      Weekly Database Export specifications
                    </h4>
                    
                    <div className="space-y-2.5 mt-2">
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-800 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">File Signature Format:</span>
                        <span className="font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">Standard Excel UTF-8 CSV</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-800 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">Active Records Index:</span>
                        <span className="font-mono bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold">{filteredPOs.length} of {pos.length} Purchase Contracts</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-800 flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-350">Excel Integrity:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          ● Ready for MS Excel
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-slate-450 dark:text-slate-500 mt-4 leading-normal">
                      Note: Under Indian logistics laws, TATA Steel suppliers are requested to retain this physical download log for at least 180 days after drawing approval releases.
                    </p>
                  </div>

                  <div className="pt-5 border-t border-slate-100 dark:border-slate-850 mt-4">
                    <button
                      onClick={handleDownloadWeeklyExcel}
                      className="w-full text-center text-xs font-bold py-2.5 bg-blue-100 dark:bg-blue-950/60 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Compile and Download Excel Weekly database (.csv)
                    </button>
                  </div>
                </div>

                {/* Card 2: Interactive Logistics Action Items Checklist */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4 text-amber-500" />
                        Logistics & Auditing Actionables
                      </h4>
                      <p className="text-[11px] text-slate-450 mt-0.5">Track step-by-step mitigation duties live</p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-full">
                      {checklist.filter(c => c.done).length} / {checklist.length} Complete
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                    <div 
                      className="bg-blue-700 dark:bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${(checklist.filter(c => c.done).length / checklist.length) * 100}%` }}
                    />
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {checklist.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, done: !c.done } : c));
                        }}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                          item.done 
                            ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-150 dark:border-slate-850 opacity-60' 
                            : 'bg-white dark:bg-[#131d30] border-slate-200 dark:border-slate-850 hover:bg-slate-50/60 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => {}} // Done in parent div click
                          className="mt-0.5 cursor-pointer accent-blue-600 shrink-0"
                        />
                        <div className="flex-1 text-left">
                          <p className={`text-xs font-semibold leading-tight ${item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-medium">
                            <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wide">{item.category}</span>
                            <span className="text-slate-305">•</span>
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 py-0.2 rounded">PO Context: {item.targetPO}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Lower Section Grid: Live Cost Penalty Report & Live AI Strategic Planner */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Live Cost Liability & Delayed Contract Analysis */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs lg:col-span-1 transition-colors">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-450 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    Liquidated Damages (LD) Clause Exposure
                  </h4>

                  <div className="space-y-4">
                    <div className="bg-red-50/65 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-xs">
                      <span className="block font-bold text-red-900 dark:text-red-400 uppercase tracking-widest text-[10px]">TATA Standard Penalty Math</span>
                      <p className="mt-1 text-red-750 dark:text-red-350 leading-normal">
                        Contracts carry a standard 0.5% per week penalty clause capped at 5% maximum of total order capital for late delivery.
                      </p>
                    </div>

                    <div className="text-xs font-bold text-slate-500 dark:text-slate-450">Delayed / Preponed Contracts Liability Audit:</div>
                    
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {pos.filter(p => p.status === 'Delayed' || p.status === 'In Production' || p.status === 'Preponement of Delivery Schedule').length === 0 ? (
                        <p className="text-xs text-slate-450 italic text-center py-6">No active contracts subject to late LD penalties.</p>
                      ) : (
                        pos.filter(p => p.status === 'Delayed' || p.status === 'In Production' || p.status === 'Preponement of Delivery Schedule').map(po => {
                          // Let's compute potential weeks late (say 3 weeks delay default for delayed/in-prod demo)
                          const isReallyDelayed = po.status === 'Delayed';
                          const isPreponed = po.status === 'Preponement of Delivery Schedule';
                          const weeksOverdue = isReallyDelayed ? 4 : isPreponed ? 0 : 2;
                          // calculate 0.5% * weeksOverdue up to 5% Max
                          const rate = Math.min(0.005 * weeksOverdue, 0.05);
                          const calculatedPenalty = Math.round(po.totalOrderValue * rate);
                          
                          return (
                            <div key={po.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-150 dark:border-slate-800 flex justify-between items-start text-xs">
                              <div className="text-left">
                                <span className="font-extrabold text-slate-800 dark:text-slate-100">{po.orderNo}</span>
                                <span className="block text-[10px] text-slate-400 dark:text-slate-450">{po.vendorName}</span>
                                {isPreponed ? (
                                  <span className="block text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1">✓ Preponed Schedule (Zero Penalty)</span>
                                ) : (
                                  <span className="block text-[10px] text-red-500 dark:text-rose-400 font-semibold mt-1">*{weeksOverdue} Weeks Est. Delay ({Math.round(rate * 100 * 10) / 10}% charge)</span>
                                )}
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className={`block text-[11px] font-black ${isPreponed ? 'text-purple-600 dark:text-purple-400' : 'text-rose-655 dark:text-rose-455'}`}>₹{calculatedPenalty.toLocaleString()}</span>
                                <span className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-450">{isPreponed ? 'Delivery Secured' : 'Est Penalty Risk'}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-150 dark:border-slate-800">
                      <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Average Dispatch Compliance Rate</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400">
                          {Math.round(pos.reduce((sum, po) => sum + (po.complianceRating || 85), 0) / (pos.length || 1))}%
                        </span>
                        <span className="text-xs text-slate-450 dark:text-slate-400">TATA Quality Gate target: 90%</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Gemini Powered AI Strategic Compliance Planner */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs lg:col-span-2 flex flex-col min-h-[380px] transition-colors">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 pr-1">
                    <div className="text-left">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-450 flex items-center gap-1.5 leading-none">
                        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        AI Strategic Procurement Advisor
                      </h4>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-1 leading-none">Generate dynamic deep audits using real model intelligence</p>
                    </div>

                    <button
                      onClick={handleCompileAIReport}
                      disabled={isCompilingReport}
                      className="text-xs font-bold bg-[#4f46e5] hover:bg-[#4338ca] dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 text-white px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                    >
                      {isCompilingReport ? (
                        <>
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                          Auditing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Compile Strategic Audit Report
                        </>
                      )}
                    </button>
                  </div>

                  {/* Auditor Output Content Panel */}
                  <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800 rounded-xl p-4.5 overflow-y-auto max-h-[340px] flex flex-col text-left">
                    {isCompilingReport ? (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16">
                        <div className="animate-pulse flex space-x-2">
                          <div className="h-2 w-2 bg-purple-600 dark:bg-purple-450 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="h-2 w-2 bg-purple-600 dark:bg-purple-450 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="h-2 w-2 bg-purple-600 dark:bg-purple-450 rounded-full animate-bounce" />
                        </div>
                        <p className="text-xs text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider animate-pulse">
                          Querying contract clauses & alerts log...
                        </p>
                        <p className="text-[10px] text-slate-450 dark:text-slate-550 text-center max-w-sm">
                          Gemini 2.0 is loading Liquidated Damages thresholds, compiling supplier compliance indexes and drafting mitigation checklists...
                        </p>
                      </div>
                    ) : aiReportContent ? (
                      <div className="markdown-body space-y-1.5 pr-1 font-sans">
                        {renderMarkdown(aiReportContent)}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-16">
                        <FileSpreadsheet className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Strategic Compliance Audit Unexecuted</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-normal">
                            Click "Compile Strategic Audit" above to run an advanced corporate evaluation of active POs with live Gemini AI logic.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* LIVE WEEKLY DATABASE SPREADSHEET (PO ITEMS AS NEW INTEGRATED RECORDS) */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-4 mb-4">
                  <div className="text-left">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <FileSpreadsheet className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                      Weekly Database - Interactive Item-Level Spreadsheet
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Each PO item is displayed as a unique line record, featuring detailed logistical parameters: packing/forwarding charges, delivery days, drawing/part figures, and brand descriptors.
                    </p>
                  </div>
                  
                  {/* Search filter for items spreadsheet */}
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search items by desc, part, drawing, make..."
                      value={itemsSearchQuery}
                      onChange={(e) => setItemsSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-4 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-hidden placeholder:text-slate-400"
                    />
                    <span className="absolute left-2.5 top-2.5 text-slate-400">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="border-b border-slate-150 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
                        <th className="py-3 px-3">Order No</th>
                        <th className="py-3 px-3">Item No</th>
                        <th className="py-3 px-3">Material & Description</th>
                        <th className="py-3 px-3">Drawing Number</th>
                        <th className="py-3 px-3">Part Number</th>
                        <th className="py-3 px-3">Model Number</th>
                        <th className="py-3 px-3">Make</th>
                        <th className="py-3 px-3 text-center">UMC</th>
                        <th className="py-3 px-3 text-right">Qty</th>
                        <th className="py-3 px-3 text-right">Price per Unit</th>
                        <th className="py-3 px-3 text-right">Packing Charges</th>
                        <th className="py-3 px-3 text-right">Forwarding Charges</th>
                        <th className="py-3 px-3 text-center">Del Days</th>
                        <th className="py-3 px-3 text-right">Total Item Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-left">
                      {(() => {
                        const allItemRows = filteredPOs.flatMap(po => 
                          (po.items || []).map(it => ({
                            ...it,
                            orderNo: po.orderNo,
                            vendorName: po.vendorName,
                            status: po.status
                          }))
                        );

                        const filteredRows = allItemRows.filter(row => {
                          if (!itemsSearchQuery) return true;
                          const query = itemsSearchQuery.toLowerCase();
                          return (
                            (row.orderNo || '').toLowerCase().includes(query) ||
                            (row.materialDesc || '').toLowerCase().includes(query) ||
                            (row.materialNo || '').toLowerCase().includes(query) ||
                            (row.drawingNo || '').toLowerCase().includes(query) ||
                            (row.partNo || '').toLowerCase().includes(query) ||
                            (row.modelNo || '').toLowerCase().includes(query) ||
                            (row.make || '').toLowerCase().includes(query)
                          );
                        });

                        if (filteredRows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={14} className="py-8 text-center text-slate-450 italic">
                                No PO item records match the search query. Try typing another manufacturer keyword or material name.
                              </td>
                            </tr>
                          );
                        }

                        return filteredRows.map((row, idx) => (
                          <tr key={`${row.orderNo}_${row.itemNo}_${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                              <div>{row.orderNo}</div>
                              <div className="text-[9px] text-slate-400 font-normal line-clamp-1 truncate max-w-[150px]">{row.vendorName}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500 font-medium">
                              {row.itemNo}
                            </td>
                            <td className="py-3 px-3 text-left">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block max-w-[280px] leading-tight mb-0.5">{row.materialDesc}</span>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {row.materialNo}</span>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {row.drawingNo ? (
                                <span className="bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/60">
                                  {row.drawingNo}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">None</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono max-w-[120px] truncate">
                              {row.partNo ? (
                                <span className="bg-slate-105 dark:bg-slate-800 text-slate-650 dark:text-slate-350 text-[10px] px-1.5 py-0.5 rounded">
                                  {row.partNo}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono max-w-[120px] truncate">
                              {row.modelNo ? (
                                <span className="bg-slate-105 dark:bg-slate-800 text-slate-650 dark:text-slate-350 text-[10px] px-1.5 py-0.5 rounded">
                                  {row.modelNo}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {row.make ? (
                                <span className="font-extrabold text-[10px] text-teal-750 dark:text-teal-400 uppercase bg-teal-50 dark:bg-teal-950/40 border border-teal-150 dark:border-teal-900/40 px-1.5 py-0.5 rounded">
                                  {row.make}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                              {row.umc || row.unit || 'NOS'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {row.qty}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              ₹{row.grossPrice.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              ₹{(row.packingCharges !== undefined ? row.packingCharges : 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                              ₹{(row.forwardingCharges !== undefined ? row.forwardingCharges : 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {row.delDays !== undefined && row.delDays !== '' ? (
                                <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-850 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded">
                                  {row.delDays} days
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-blue-700 dark:text-blue-400">
                              ₹{row.totalValue.toLocaleString()}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* AI Models & Document Intelligence Configuration */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs max-w-3xl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    AI Document Intelligence & Free-Tier Engine Settings
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    Gemini Flash Latest Active (Default)
                  </span>
                </div>

                <div className="space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-normal">
                  <p>
                    Document parsing, compliance analysis, and strategic audits prioritize <strong>Gemini Flash Latest</strong> (or <strong>gemini-3.1-flash-lite</strong>) as the default engine.
                    If Gemini encounters temporary demand spikes (503) or quota exhaustion, the app automatically transitions to <strong>Groq Free Tier (OpenAI GPT-OSS 120B)</strong> as a reliable fallback.
                  </p>

                  {aiKeyStatus && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 font-medium">
                      ✓ {aiKeyStatus}
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1a2236] border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Gemini API Key (Default Engine Override)
                        </label>
                        <input
                          type="password"
                          value={manualGeminiKey}
                          onChange={(e) => setManualGeminiKey(e.target.value)}
                          placeholder="AIzaSy... (leave blank to use system key)"
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block">
                          Uses model <code className="text-purple-600 font-bold">gemini-flash-latest</code> / <code className="text-purple-600 font-bold">gemini-3.1-flash-lite</code>
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Groq API Key (Automatic Fallback Only)
                        </label>
                        <input
                          type="password"
                          value={manualGroqKey}
                          onChange={(e) => setManualGroqKey(e.target.value)}
                          placeholder="gsk_... (leave blank to use system key)"
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                        />
                        <span className="text-[9px] text-slate-400 mt-1 block">
                          Uses free model <code className="text-amber-600 font-bold">openai/gpt-oss-120b</code> as fallback
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleSaveAiKeys}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-xs text-xs flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Save AI Keys
                      </button>
                      {(manualGeminiKey || manualGroqKey) && (
                        <button
                          onClick={() => {
                            setManualGeminiKey('');
                            setManualGroqKey('');
                            localStorage.removeItem('tata_gemini_api_key');
                            localStorage.removeItem('tata_groq_api_key');
                            setAiKeyStatus('Cleared custom keys; reverted to system default credentials.');
                            setTimeout(() => setAiKeyStatus(null), 3000);
                          }}
                          className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Reset to System Keys
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supabase & Cloud Sync Intelligence */}
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs max-w-3xl">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                  Supabase & Cloud Sync Intelligence
                </h3>

                <div className="space-y-5 text-xs text-slate-600 dark:text-slate-400 leading-normal">
                  <p>
                    Your Purchase Order Dashboard stores contracts server-side automatically using high-fidelity offline JSON caches.
                    To connect to your **Supabase Database Cloud** in real-time, you can set secrets inside AI Studio Settings or **paste them directly below** for instant browser synchronization.
                  </p>

                  {/* Manual Credentials Entry Form */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1a2236] border border-slate-200 dark:border-slate-800 space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                      <Key className="h-3.5 w-3.5 text-blue-500" />
                      Direct Browser Connection (Saves to secure local cache)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          Supabase Project API URL
                        </label>
                        <input
                          type="text"
                          value={manualSupabaseUrl}
                          onChange={(e) => setManualSupabaseUrl(e.target.value)}
                          placeholder="https://your-project-id.supabase.co"
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                          Supabase Anon Key (Public Key)
                        </label>
                        <input
                          type="password"
                          value={manualSupabaseAnonKey}
                          onChange={(e) => setManualSupabaseAnonKey(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleSaveManualSupabase}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-xs text-xs flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> Save & Connect
                      </button>
                      {(manualSupabaseUrl || manualSupabaseAnonKey) && (
                        <button
                          onClick={handleClearManualSupabase}
                          className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Clear Cached Settings
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connection Status Panel */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Database Connection Status:</h4>
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full relative ${supabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {supabaseConnected && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                      </span>
                      <div>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {supabaseConnected ? 'Supabase Synced & Connected' : 'Offline Mode (Local JSON Cache Only)'}
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {supabaseConnected 
                            ? `Active URL: ${manualSupabaseUrl ? manualSupabaseUrl.substring(0, 30) + '...' : 'System environment URL'}` 
                            : 'To sync to Supabase Cloud, save credentials above or define VITE_SUPABASE_URL.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cloud Sync & Recovery Action Panel */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Cloud Sync & Recovery Actions:</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Since the containerized playground is reset on reboot, use these manual controls to back up all current purchase contracts from your local disk cache to your cloud Supabase database, or pull historic cloud contracts back to this container.
                    </p>
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handlePullFromSupabase}
                        disabled={!supabaseConnected || isPullingSupabase || isPushingSupabase}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer shadow-xs text-xs"
                      >
                        <Download className={`h-3.5 w-3.5 ${isPullingSupabase ? 'animate-spin' : ''}`} />
                        {isPullingSupabase ? 'Pulling Data...' : 'Pull & Sync from Supabase'}
                      </button>
                      
                      <button
                        onClick={handlePushToSupabase}
                        disabled={!supabaseConnected || isPullingSupabase || isPushingSupabase}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer shadow-xs text-xs"
                      >
                        <FolderSync className={`h-3.5 w-3.5 ${isPushingSupabase ? 'animate-spin' : ''}`} />
                        {isPushingSupabase ? 'Push All to Supabase' : 'Push All to Supabase'}
                      </button>
                    </div>

                    {!supabaseConnected && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-amber-800 dark:text-amber-400 text-[10.5px]">
                        <strong>⚠️ Sync Buttons Disabled:</strong> Save valid Supabase credentials in the panel above first to activate cloud transfer capabilities.
                      </div>
                    )}
                  </div>

                  {/* SQL Schema helper for easy setup and restore */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-blue-600" />
                      Supabase SQL Schema Script (Run in SQL Editor)
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                      If some columns are missing or if you need to create the table, run this SQL script in your **Supabase SQL Editor** to construct the perfect schema. 
                    </p>
                    <div className="relative">
                      <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[9px] overflow-x-auto max-h-48 leading-relaxed select-all">
{`-- OPTIONAL: If you already have an outdated table, uncomment and run the line below to reset it:
-- DROP TABLE IF EXISTS purchase_orders CASCADE;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL,
  company_name TEXT,
  location TEXT,
  order_date TEXT,
  release_date TEXT,
  validity_start TEXT,
  validity_end TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  vendor_code TEXT,
  vendor_name TEXT,
  vendor_email TEXT,
  vendor_phone TEXT,
  total_value NUMERIC,
  currency TEXT,
  payment_term TEXT,
  delivery_terms TEXT,
  logistics_partner TEXT,
  status TEXT,
  dispatched_date TEXT,
  eta_date TEXT,
  tracking_number TEXT,
  compliance_checked BOOLEAN DEFAULT true,
  compliance_rating NUMERIC,
  liquidated_damages_clause TEXT,
  notes TEXT,
  ai_insights TEXT,
  items TEXT, -- maps items list as robust JSON representation
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- CRITICAL: Disable Row Level Security (RLS) to allow public anonymous API insert/select operations
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;`}
                      </pre>
                      <button 
                        onClick={(e) => {
                          navigator.clipboard.writeText(`-- OPTIONAL: Reset table
-- DROP TABLE IF EXISTS purchase_orders CASCADE;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL,
  company_name TEXT,
  location TEXT,
  order_date TEXT,
  release_date TEXT,
  validity_start TEXT,
  validity_end TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  vendor_code TEXT,
  vendor_name TEXT,
  vendor_email TEXT,
  vendor_phone TEXT,
  total_value NUMERIC,
  currency TEXT,
  payment_term TEXT,
  delivery_terms TEXT,
  logistics_partner TEXT,
  status TEXT,
  dispatched_date TEXT,
  eta_date TEXT,
  tracking_number TEXT,
  compliance_checked BOOLEAN DEFAULT true,
  compliance_rating NUMERIC,
  liquidated_damages_clause TEXT,
  notes TEXT,
  ai_insights TEXT,
  items TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;`);
                          const btn = e.currentTarget;
                          const originalText = btn.innerText;
                          btn.innerText = 'Copied!';
                          setTimeout(() => { btn.innerText = originalText; }, 2000);
                        }}
                        className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[9px] font-bold cursor-pointer transition-all"
                      >
                        Copy SQL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <AICopilotChat pos={pos} alerts={alerts} />
          )}
        </main>
      </div>

      {/* Footer Bar */}
      <footer className="h-10 bg-slate-105 border-t border-slate-200 px-6 flex items-center justify-between text-[10px] font-semibold text-slate-500 shrink-0 uppercase tracking-widest bg-white">
        <div>System Architecture: React.js + Tailwind + Supabase + Gemini 2.0</div>
        <div className="flex space-x-4">
          <span>Session ID: AF-2910</span>
          <span>Node: IND-MUM-01</span>
          <span className="text-emerald-600 font-bold">● System Optimized</span>
        </div>
      </footer>

      {/* PO Detailed Modal/Drawer Overlay */}
      {selectedPO && (
        <POViewer
          po={selectedPO}
          onClose={() => setSelectedPO(null)}
          onUpdateStatus={handleUpdatePOStatus}
          onDeletePO={handleDeletePO}
        />
      )}

      {/* Delete Confirmation Modal */}
      {poToDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex items-center gap-3.5 text-red-600 mb-4">
              <div className="p-3 bg-red-100/80 rounded-xl">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Purchase Contract</h3>
                <p className="text-xs text-slate-500 font-medium">This action will remove the record</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to permanently delete Purchase Order <strong className="text-slate-900 font-bold">{poToDeleteModal.orderNo}</strong> ({poToDeleteModal.vendorName})?
              <br />
              <span className="text-xs text-slate-500 mt-1 block">This will erase the contract from your active dashboard and auto-sync deletion with Supabase Cloud.</span>
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPoToDeleteModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePO}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual PO Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-950 text-white">
              <h3 className="text-sm font-extrabold">Generate Custom Purchase Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePOFormSubmit} className="overflow-y-auto p-6 space-y-5 text-xs flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Order number / id</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2101010485/101"
                    value={newPOForm.orderNo}
                    onChange={(e) => setNewPOForm(prev => ({ ...prev, orderNo: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Work Location</label>
                  <input
                    type="text"
                    required
                    value={newPOForm.location}
                    onChange={(e) => setNewPOForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Purchase Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ankit Kumar"
                    value={newPOForm.contactPerson}
                    onChange={(e) => setNewPOForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Purchase Contact Email</label>
                  <input
                    type="email"
                    placeholder="e.g. admin@tatasteel.com"
                    value={newPOForm.contactEmail}
                    onChange={(e) => setNewPOForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              </div>

              {/* Items Staging Addition Table */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Add Material Items to PO</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-450 uppercase mb-1">Part / Material No</label>
                    <input
                      type="text"
                      placeholder="e.g., 5531A0320"
                      value={itemFormStaging.materialNo}
                      onChange={(e) => setItemFormStaging(p => ({ ...p, materialNo: e.target.value }))}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-450 uppercase mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="e.g., PHASE INSULATORS GH50"
                      value={itemFormStaging.materialDesc}
                      onChange={(e) => setItemFormStaging(p => ({ ...p, materialDesc: e.target.value }))}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-450 uppercase mb-1">Group Description</label>
                    <input
                      type="text"
                      value={itemFormStaging.materialGroupDesc}
                      onChange={(e) => setItemFormStaging(p => ({ ...p, materialGroupDesc: e.target.value }))}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-450 uppercase mb-1">Quantity</label>
                    <input
                      type="number"
                      value={itemFormStaging.qty}
                      onChange={(e) => setItemFormStaging(p => ({ ...p, qty: Number(e.target.value) }))}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-450 uppercase mb-1">Unit Price (₹)</label>
                    <input
                      type="number"
                      value={itemFormStaging.grossPrice}
                      onChange={(e) => setItemFormStaging(p => ({ ...p, grossPrice: Number(e.target.value) }))}
                      className="w-full border border-slate-200 rounded-md p-2 bg-white"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItemToForm}
                      className="w-full py-2 bg-slate-900 text-white rounded-md font-bold uppercase hover:bg-slate-800 transition-colors"
                    >
                      Append Item
                    </button>
                  </div>
                </div>

                {/* Staged Items List preview */}
                {newPOForm.items && newPOForm.items.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 text-[11px] bg-white">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-100 text-slate-500 font-bold">
                          <th className="px-3 py-2">Item No</th>
                          <th className="px-3 py-2">Material / Part</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {newPOForm.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-3 py-2 font-mono font-bold text-slate-400">{it.itemNo}</td>
                            <td className="px-3 py-2">
                              <div>{it.materialDesc}</div>
                              <div className="text-[10px] text-slate-400">{it.materialNo}</div>
                            </td>
                            <td className="px-3 py-2 font-medium">{it.qty} {it.unit}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">₹{it.totalValue.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Release Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
