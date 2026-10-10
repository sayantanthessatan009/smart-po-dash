import React from 'react';

interface KPICardProps {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  colorClass: string;
  onClick?: () => void;
}

export default function KPICard({
  id,
  title,
  value,
  icon,
  description,
  colorClass,
  onClick
}: KPICardProps) {
  // Determine text-color for certain value cards
  let valueColor = 'text-slate-800 dark:text-slate-100';
  if (title.toLowerCase().includes('alarm') || title.toLowerCase().includes('outstanding')) {
    valueColor = 'text-rose-600 dark:text-rose-400';
  } else if (title.toLowerCase().includes('compliance') || title.toLowerCase().includes('pending')) {
    valueColor = 'text-amber-600 dark:text-amber-400';
  } else if (title.toLowerCase().includes('value') || title.toLowerCase().includes('total')) {
    valueColor = 'text-slate-900 dark:text-white';
  }

  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative bg-white dark:bg-[#111827] p-5 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-450 uppercase">{title}</p>
          <p className={`text-2xl font-extrabold tracking-tight mt-1 ${valueColor}`}>{value}</p>
        </div>
        <div className={`rounded-lg p-2 flex items-center justify-center shrink-0 ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium font-sans">
        <span>{description}</span>
      </div>
    </div>
  );
}
