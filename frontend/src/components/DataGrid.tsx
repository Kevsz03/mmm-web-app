import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ChevronRight, ChevronsRight, HelpCircle, MousePointerClick } from 'lucide-react';

interface Props {
  columns: string[];
  data: any[];
  config: {
    dateCol: string;
    targetCol: string;
    mediaChannels: { name: string; activity_col: string; spend_col: string }[];
    controlCols: string[];
  };
  selectionMode?: boolean;
  onColumnClick?: (col: string) => void;
}

export const DataGrid = ({ columns, data, config, selectionMode, onColumnClick }: Props) => {
  const getColumnColor = (col: string) => {
    if (col === config.dateCol) return 'bg-pink-100 text-pink-700 border-pink-200';
    if (col === config.targetCol) return 'bg-mmm-blue-100 text-mmm-blue-700 border-mmm-blue-200';
    
    // Check media
    const isActivity = config.mediaChannels.some(m => m.activity_col === col);
    const isSpend = config.mediaChannels.some(m => m.spend_col === col);
    if (isActivity || isSpend) return 'bg-purple-100 text-purple-700 border-purple-200';
    
    // Check controls
    if (config.controlCols.includes(col)) return 'bg-orange-100 text-orange-700 border-orange-200';
    
    return 'bg-slate-50 text-slate-500 border-slate-200';
  };

  const getCellColor = (col: string) => {
    if (col === config.dateCol) return 'bg-pink-50';
    if (col === config.targetCol) return 'bg-mmm-blue-50';
    
    const isActivity = config.mediaChannels.some(m => m.activity_col === col);
    const isSpend = config.mediaChannels.some(m => m.spend_col === col);
    if (isActivity || isSpend) return 'bg-purple-50';
    
    if (config.controlCols.includes(col)) return 'bg-orange-50';
    
    return '';
  };

  const getColumnLabel = (col: string) => {
     if (col === config.dateCol) return 'Fecha';
     if (col === config.targetCol) return 'Objetivo';
     if (config.mediaChannels.some(m => m.activity_col === col)) return 'Actividad';
     if (config.mediaChannels.some(m => m.spend_col === col)) return 'Gasto';
     if (config.controlCols.includes(col)) return 'Control';
     return null;
  };

  return (
    <div className={cn(
      "w-full h-full overflow-auto bg-white border rounded-lg shadow-sm transition-all duration-300",
      selectionMode ? "border-mmm-blue-500 ring-4 ring-mmm-blue-500/10" : "border-slate-200"
    )}>
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-xs uppercase sticky top-0 z-10 bg-white shadow-sm">
          <tr>
            <th className="px-4 py-3 border-b border-r border-slate-200 w-16 text-center bg-slate-50 text-slate-400 font-medium">#</th>
            {columns.map((col) => {
                const colorClass = getColumnColor(col);
                const label = getColumnLabel(col);
                return (
                    <th 
                        key={col} 
                        className={cn(
                            "px-4 py-3 border-b border-r border-slate-200 font-semibold min-w-[120px] relative transition-all duration-200", 
                            colorClass,
                            selectionMode ? "cursor-pointer hover:brightness-95 hover:shadow-inner ring-inset hover:ring-2 hover:ring-mmm-blue-400/50" : ""
                        )}
                        onClick={() => selectionMode && onColumnClick && onColumnClick(col)}
                    >
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between">
                                <span>{col}</span>
                                {selectionMode && <MousePointerClick className="w-3 h-3 opacity-50" />}
                            </div>
                            {label && <span className="text-[10px] opacity-75 font-normal mt-0.5">{label}</span>}
                        </div>
                    </th>
                );
            })}
          </tr>
        </thead>
        <tbody className="text-slate-600">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-4 py-2 border-b border-r border-slate-100 text-center font-mono text-xs text-slate-400 bg-slate-50/30">{i + 1}</td>
              {columns.map((col) => (
                <td key={`${i}-${col}`} className={cn(
                  "px-4 py-2 border-b border-r border-slate-100 truncate max-w-[200px] group-hover:border-slate-200 transition-colors",
                  getCellColor(col)
                )}>
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <p>No hay datos para previsualizar</p>
          </div>
      )}
    </div>
  );
};
