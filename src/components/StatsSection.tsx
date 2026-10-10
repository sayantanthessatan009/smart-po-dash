import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend
} from 'recharts';
import { PO } from '../types';
import { 
  Layers, MapPin, CheckCircle, Database, TrendingUp, AlertTriangle, 
  PieChart as PieIcon, BarChart3, ShieldCheck, Activity, ArrowUpRight, 
  Truck, Clock, PackageCheck, AlertCircle, Sparkles, Filter
} from 'lucide-react';

interface StatsSectionProps {
  pos: PO[];
}

export default function StatsSection({ pos }: StatsSectionProps) {
  const [activeChartTab, setActiveChartTab] = useState<'financial' | 'location' | 'status' | 'compliance'>('financial');

  // Format INR nicely (e.g. ₹7.12 L or ₹38.5 K or raw)
  const formatCompactINR = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)} K`;
    return `₹${Math.round(val)}`;
  };

  // 1. Status Breakdown
  const statusCounts = {
    Released: pos.filter(p => p.status === 'Released').length,
    'In Production': pos.filter(p => p.status === 'In Production').length,
    Dispatched: pos.filter(p => p.status === 'Dispatched').length,
    Delivered: pos.filter(p => p.status === 'Delivered').length,
    Delayed: pos.filter(p => p.status === 'Delayed').length,
    Preponed: pos.filter(p => p.status === 'Preponement of Delivery Schedule').length,
  };

  const statusValues = {
    Released: pos.filter(p => p.status === 'Released').reduce((s, p) => s + (p.totalOrderValue || 0), 0),
    'In Production': pos.filter(p => p.status === 'In Production').reduce((s, p) => s + (p.totalOrderValue || 0), 0),
    Dispatched: pos.filter(p => p.status === 'Dispatched').reduce((s, p) => s + (p.totalOrderValue || 0), 0),
    Delivered: pos.filter(p => p.status === 'Delivered').reduce((s, p) => s + (p.totalOrderValue || 0), 0),
    Delayed: pos.filter(p => p.status === 'Delayed').reduce((s, p) => s + (p.totalOrderValue || 0), 0),
    Preponed: pos.filter(p => p.status === 'Preponement of Delivery Schedule').reduce((s, p) => s + (p.totalOrderValue || 0), 0),
  };

  const statusChartData = [
    { name: 'Released', count: statusCounts.Released, value: Math.round(statusValues.Released), color: '#3b82f6' },
    { name: 'In Production', count: statusCounts['In Production'], value: Math.round(statusValues['In Production']), color: '#f59e0b' },
    { name: 'Dispatched', count: statusCounts.Dispatched, value: Math.round(statusValues.Dispatched), color: '#06b6d4' },
    { name: 'Delivered', count: statusCounts.Delivered, value: Math.round(statusValues.Delivered), color: '#10b981' },
    { name: 'Delayed', count: statusCounts.Delayed, value: Math.round(statusValues.Delayed), color: '#ef4444' },
    { name: 'Preponed', count: statusCounts.Preponed, value: Math.round(statusValues.Preponed), color: '#8b5cf6' },
  ].filter(d => d.count > 0);

  // 2. Location breakdown
  const locationSummary: { [key: string]: { value: number; count: number } } = {};
  pos.forEach(po => {
    let loc = 'Other TATA Works';
    const raw = (po.location || '').toLowerCase();
    if (raw.includes('kalinganagar') || raw.includes('duburi') || raw.includes('orissa')) {
      loc = 'Kalinganagar (TSK)';
    } else if (raw.includes('gamharia') || raw.includes('tgs')) {
      loc = 'Gamharia (TGS)';
    } else if (raw.includes('bistupur') || raw.includes('jamshedpur') || raw.includes('tisco')) {
      loc = 'Jamshedpur (Works)';
    } else if (raw.includes('meramandali') || raw.includes('angul')) {
      loc = 'Meramandali (Angul)';
    } else if (raw.includes('sahibabad')) {
      loc = 'Sahibabad Plant';
    } else if (raw.includes('tarapur') || raw.includes('khopoli')) {
      loc = 'Tarapur / Khopoli';
    }

    if (!locationSummary[loc]) {
      locationSummary[loc] = { value: 0, count: 0 };
    }
    locationSummary[loc].value += Number(po.totalOrderValue || 0);
    locationSummary[loc].count += 1;
  });

  const totalCapitalAllLocations = pos.reduce((s, p) => s + (p.totalOrderValue || 0), 0);

  const LOCATION_COLORS = ['#1e40af', '#0284c7', '#0d9488', '#16a34a', '#d97706', '#9333ea', '#64748b'];

  const locationData = Object.keys(locationSummary).map((key, idx) => ({
    name: key,
    value: Math.round(locationSummary[key].value),
    count: locationSummary[key].count,
    share: totalCapitalAllLocations > 0 ? Math.round((locationSummary[key].value / totalCapitalAllLocations) * 100) : 0,
    color: LOCATION_COLORS[idx % LOCATION_COLORS.length]
  }));

  // 3. Financial PO Data
  const poValueData = pos.map(po => {
    const rawNo = (po.orderNo || '').split('/')[0] || po.id || 'N/A';
    const shortNo = rawNo.length > 12 ? `${rawNo.substring(0, 10)}..` : rawNo;
    return {
      orderNo: shortNo,
      fullOrderNo: po.orderNo || po.id,
      totalValue: Math.round(Number(po.totalOrderValue || 0)),
      formattedValue: formatCompactINR(Number(po.totalOrderValue || 0)),
      itemsCount: (po.items || []).length,
      vendorName: po.vendorName || 'TATA Supplier',
      compliance: po.complianceRating ?? 85,
      status: po.status
    };
  });

  // 4. Compliance Trend / Matrix Data
  const complianceData = pos.map((po, index) => ({
    index: index + 1,
    orderNo: (po.orderNo || '').split('/')[0] || `PO-${index + 1}`,
    compliance: po.complianceRating ?? 85,
    threshold: 90,
    delayed: po.status === 'Delayed',
    vendor: po.vendorName,
    value: po.totalOrderValue
  }));

  // Top KPI calculations
  const totalPOValue = pos.reduce((s, p) => s + (p.totalOrderValue || 0), 0);
  const totalActiveCapital = pos.filter(p => p.status !== 'Delivered').reduce((s, p) => s + (p.totalOrderValue || 0), 0);
  const totalDeliveredCapital = pos.filter(p => p.status === 'Delivered').reduce((s, p) => s + (p.totalOrderValue || 0), 0);
  const avgCompliance = pos.length > 0 ? Math.round(pos.reduce((s, p) => s + (p.complianceRating ?? 85), 0) / pos.length) : 0;
  const delayedCapital = pos.filter(p => p.status === 'Delayed').reduce((s, p) => s + (p.totalOrderValue || 0), 0);

  // Custom Rich Tooltip for Recharts
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 dark:bg-black/95 text-white p-3 rounded-lg shadow-2xl border border-slate-700 text-xs backdrop-blur-xs min-w-[200px]">
          <p className="font-bold text-blue-300 border-b border-slate-700 pb-1.5 mb-1.5 flex items-center justify-between">
            <span>{data.fullOrderNo || data.name || label}</span>
            {data.status && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-blue-950 text-blue-300 border border-blue-800">
                {data.status}
              </span>
            )}
          </p>
          {data.vendorName && (
            <p className="text-[10px] text-slate-300 truncate mb-1">
              Supplier: <span className="text-white font-medium">{data.vendorName}</span>
            </p>
          )}
          {payload.map((entry: any, index: number) => {
            const isCurrency = entry.dataKey === 'totalValue' || entry.dataKey === 'value';
            const displayVal = isCurrency ? `₹${Number(entry.value).toLocaleString()}` : entry.value;
            return (
              <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4 py-0.5 text-[11px]">
                <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.fill }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-white">{displayVal}</span>
              </div>
            );
          })}
          {data.itemsCount !== undefined && (
            <p className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800 flex justify-between">
              <span>Catalog Line Items:</span>
              <span className="font-mono font-semibold text-slate-200">{data.itemsCount} items</span>
            </p>
          )}
          {data.share !== undefined && (
            <p className="text-[10px] text-emerald-400 mt-1 pt-1 border-t border-slate-800 flex justify-between">
              <span>Plant Volume Share:</span>
              <span className="font-mono font-bold">{data.share}%</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Visual Infographic Supply Chain Velocity Funnel */}
      <div id="infographic-pipeline-bar" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Procurement & Supply Chain Pipeline Infographic
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-slate-500 dark:text-slate-400">Total Volume:</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-100 font-mono">
              ₹{totalPOValue.toLocaleString()} ({pos.length} Contracts)
            </span>
          </div>
        </div>

        {/* 4-Stage Supply Chain Velocity Pipeline */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Stage 1: Released */}
          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 dark:text-blue-400">
              <span className="flex items-center gap-1.5">
                <FileTextIcon className="h-3.5 w-3.5" /> 1. Released
              </span>
              <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.2 rounded text-[10px]">
                {statusCounts.Released} POs
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white block font-mono">
                {formatCompactINR(statusValues.Released)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Commercial agreements locked</span>
            </div>
          </div>

          {/* Stage 2: In Production */}
          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> 2. Fabrication
              </span>
              <span className="font-mono bg-amber-100 dark:bg-amber-900 px-1.5 py-0.2 rounded text-[10px]">
                {statusCounts['In Production']} POs
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white block font-mono">
                {formatCompactINR(statusValues['In Production'])}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Shop floor & drawing checks</span>
            </div>
          </div>

          {/* Stage 3: Dispatched */}
          <div className="p-3 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-cyan-700 dark:text-cyan-400">
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> 3. In Transit
              </span>
              <span className="font-mono bg-cyan-100 dark:bg-cyan-900 px-1.5 py-0.2 rounded text-[10px]">
                {statusCounts.Dispatched} POs
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white block font-mono">
                {formatCompactINR(statusValues.Dispatched)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">3PL logistics & consignment</span>
            </div>
          </div>

          {/* Stage 4: Delivered */}
          <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <PackageCheck className="h-3.5 w-3.5" /> 4. Store Received
              </span>
              <span className="font-mono bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.2 rounded text-[10px]">
                {statusCounts.Delivered} POs
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white block font-mono">
                {formatCompactINR(statusValues.Delivered)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Unloaded & GRN completed</span>
            </div>
          </div>
        </div>

        {/* Risk & Velocity Callout Badges */}
        {(statusCounts.Delayed > 0 || statusCounts.Preponed > 0) && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {statusCounts.Delayed > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[11px] border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {statusCounts.Delayed} Delayed POs ({formatCompactINR(statusValues.Delayed)} at LD risk)
                </span>
              )}
              {statusCounts.Preponed > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 font-bold text-[11px] border border-purple-200 dark:border-purple-900">
                  <Sparkles className="h-3.5 w-3.5" />
                  {statusCounts.Preponed} Preponed Fast-Track Dispatches
                </span>
              )}
            </div>

            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              ⚡ Live Analytics Synced with TATA ERP Engine
            </span>
          </div>
        )}
      </div>

      {/* Main Interactive Charts Container with Switcher */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
        {/* Chart Header Bar with Navigation Tabs */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/40">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Procurement & Logistics Infographic Analytics Suite
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              High-resolution interactive visualizations for contract volume, geographic footprint, and compliance curves
            </p>
          </div>

          {/* Chart View Selectors */}
          <div className="flex bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setActiveChartTab('financial')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChartTab === 'financial'
                  ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Financial Breakdown
            </button>

            <button
              onClick={() => setActiveChartTab('location')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChartTab === 'location'
                  ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PieIcon className="h-3.5 w-3.5" />
              Works & Plants Split
            </button>

            <button
              onClick={() => setActiveChartTab('status')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChartTab === 'status'
                  ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Status Lifecycle
            </button>

            <button
              onClick={() => setActiveChartTab('compliance')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeChartTab === 'compliance'
                  ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance & LD Radar
            </button>
          </div>
        </div>

        {/* Tab 1: Financial & PO Value Breakdown Chart */}
        {activeChartTab === 'financial' && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Bar Chart (8 Cols) */}
              <div className="lg:col-span-8">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Purchase Order Capital Values vs Line Item Capacity
                    </h4>
                    <p className="text-[11px] text-slate-400">Total contractual commitment (INR) per PO</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                    {poValueData.length} Indexed Contracts
                  </span>
                </div>

                <div className="h-[280px] w-full min-w-0">
                  {poValueData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      No Purchase Order contracts currently match active filters.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={poValueData} margin={{ top: 15, right: 15, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis 
                          dataKey="orderNo" 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                          axisLine={{ stroke: '#cbd5e1' }}
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                          axisLine={false}
                          tickFormatter={(val) => formatCompactINR(val)}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                          iconType="circle"
                          iconSize={8}
                        />
                        <Bar 
                          dataKey="totalValue" 
                          name="PO Value (incl. GST ₹)" 
                          fill="#1e40af" 
                          radius={[6, 6, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Summary Stats Column (4 Cols) */}
              <div className="lg:col-span-4 bg-slate-50/60 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-blue-500" />
                    Capital Allocation Matrix
                  </h4>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Total Committed Capital:</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                        ₹{totalPOValue.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Active In-Progress Capital:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        ₹{totalActiveCapital.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Delivered & Settled Capital:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{totalDeliveredCapital.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Average Contract Size:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {pos.length > 0 ? formatCompactINR(totalPOValue / pos.length) : '₹0'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>💡 Tip: Click on any Purchase Order card below to view granular GST breakdowns and parts drawing files.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Location / Plant Geographic Distribution */}
        {activeChartTab === 'location' && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Donut Chart with Centered Metric (6 Cols) */}
              <div className="lg:col-span-6">
                <div className="mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                    Plant & Works Site Geographic Split
                  </h4>
                  <p className="text-[11px] text-slate-400">Order value concentration across TATA Steel works</p>
                </div>

                <div className="h-[280px] w-full min-w-0 relative flex items-center justify-center">
                  {locationData.length === 0 ? (
                    <div className="text-xs text-slate-400">No plant location data found.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={locationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {locationData.map((entry, index) => (
                            <Cell key={`loc-cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Location Breakdown Table & Badges (6 Cols) */}
              <div className="lg:col-span-6 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
                    Geographic Works Allocation Table
                  </h4>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {locationData.map((loc) => (
                      <div 
                        key={loc.name}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800 flex items-center justify-between text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: loc.color }} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{loc.name}</p>
                            <p className="text-[10px] text-slate-400">{loc.count} Active Contracts</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-mono font-extrabold text-slate-800 dark:text-slate-100">
                            ₹{loc.value.toLocaleString()}
                          </p>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                            {loc.share}% Share
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Total TATA Steel Works Sites:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                    {locationData.length} Locations Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Status & Order Lifecycle */}
        {activeChartTab === 'status' && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Status Bar / Area Chart (8 Cols) */}
              <div className="lg:col-span-8">
                <div className="mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Contract Lifecycle Distribution by Volume & Status
                  </h4>
                  <p className="text-[11px] text-slate-400">Cumulative procurement values per execution stage</p>
                </div>

                <div className="h-[280px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={statusChartData} margin={{ top: 15, right: 15, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                      <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                      <YAxis tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickFormatter={(v) => formatCompactINR(v)} />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar dataKey="value" name="Stage Value (₹)" radius={[6, 6, 0, 0]}>
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-status-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Breakdown Panel (4 Cols) */}
              <div className="lg:col-span-4 bg-slate-50/60 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  Status Breakdown
                </h4>

                <div className="space-y-2 text-xs">
                  {statusChartData.map((st) => (
                    <div key={st.name} className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{st.name}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-900 dark:text-white block">{st.count} POs</span>
                        <span className="text-[10px] text-slate-400">{formatCompactINR(st.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Compliance & Liquidated Damages (LD) Radar */}
        {activeChartTab === 'compliance' && (
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Compliance Line/Area Chart (8 Cols) */}
              <div className="lg:col-span-8">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                      Contract Compliance Score vs TATA Quality Gate (90%)
                    </h4>
                    <p className="text-[11px] text-slate-400">Quality, drawing validations, and ETA reliability indices</p>
                  </div>
                  <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900">
                    Average Score: {avgCompliance}%
                  </span>
                </div>

                <div className="h-[280px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={complianceData} margin={{ top: 15, right: 15, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="complianceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                      <XAxis dataKey="orderNo" tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                      <YAxis domain={[50, 100]} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} unit="%" />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="compliance" 
                        name="Compliance Score (%)" 
                        stroke="#4f46e5" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#complianceGrad)" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="threshold" 
                        name="TATA Standard (90%)" 
                        stroke="#ef4444" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Compliance Insights Box (4 Cols) */}
              <div className="lg:col-span-4 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Quality Audit Highlights
                  </h4>

                  <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                      <span>Standard Target:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">≥ 90% Score</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                      <span>Compliant Contracts:</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {pos.filter(p => (p.complianceRating ?? 85) >= 90).length} of {pos.length}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                      <span>Sub-threshold Contracts:</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {pos.filter(p => (p.complianceRating ?? 85) < 90).length}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                    Contracts falling under 90% are prioritized for vendor follow-up and drawing revision checks in the Alerts center.
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[10px] text-slate-400">
                  Audited against TATA Steel ISO 9001/14001 procurement frameworks.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FileTextIcon(props: any) {
  return <Layers {...props} />;
}
