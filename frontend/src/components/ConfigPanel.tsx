import { useState } from 'react';
import type { ComponentType } from 'react';
import { cn } from '../lib/utils';
import { ChevronRight, Plus, X, Search, Settings, HelpCircle, BarChart2, Calendar, DollarSign, Activity, Layers, MousePointerClick, Trash } from 'lucide-react';

type SectionHeaderProps = { title: string; icon: ComponentType<{ className?: string }>; active: boolean; onClick: () => void };
const SectionHeader = ({ title, icon: Icon, active, onClick }: SectionHeaderProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-between w-full px-4 py-3 text-sm font-semibold transition-all rounded-lg mb-2",
      active ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon className={cn("w-4 h-4", active ? "text-mmm-blue-600" : "text-slate-400")} />
      {title}
    </div>
    <ChevronRight className={cn("w-4 h-4 transition-transform", active ? "rotate-90 text-slate-400" : "text-slate-300")} />
  </button>
);

interface Props {
  columns: string[];
  config: {
    dateCol: string;
    targetCol: string;
    mediaChannels: { name: string; activity_col: string; spend_col: string }[];
    controlCols: string[];
    model_type?: string;
  };
  onConfigChange: (newConfig: Props['config']) => void;
  onTrain: () => void;
  onSelectionModeChange: (mode: { field: string, index?: number, subfield?: string } | null) => void;
  activeSelection: { field: string, index?: number, subfield?: string } | null;
  onDeleteColumn?: (col: string) => void;
}

export const ConfigPanel = ({ columns, config, onConfigChange, onTrain, onSelectionModeChange, activeSelection, onDeleteColumn }: Props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'core' | 'media' | 'controls' | 'model' | null>('core');

  const filteredColumns = columns.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSelect = (field: string, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const handleMediaChange = (index: number, field: string, value: string) => {
    const newMedia = [...config.mediaChannels];
    newMedia[index] = { ...newMedia[index], [field]: value };
    onConfigChange({ ...config, mediaChannels: newMedia });
  };

  const addChannel = () => {
    onConfigChange({
      ...config,
      mediaChannels: [...config.mediaChannels, { name: `Channel ${config.mediaChannels.length + 1}`, activity_col: '', spend_col: '' }]
    });
  };

  const removeChannel = (index: number) => {
    const newMedia = [...config.mediaChannels];
    newMedia.splice(index, 1);
    onConfigChange({ ...config, mediaChannels: newMedia });
  };

  const toggleControl = (col: string) => {
    const newControls = config.controlCols.includes(col)
      ? config.controlCols.filter(c => c !== col)
      : [...config.controlCols, col];
    onConfigChange({ ...config, controlCols: newControls });
  };

  const toggleSelection = (field: string, index?: number, subfield?: string) => {
      if (activeSelection?.field === field && activeSelection?.index === index && activeSelection?.subfield === subfield) {
          onSelectionModeChange(null);
      } else {
          onSelectionModeChange({ field, index, subfield });
      }
  };

  const isSelecting = (field: string, index?: number, subfield?: string) => {
      return activeSelection?.field === field && activeSelection?.index === index && activeSelection?.subfield === subfield;
  };


  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-80 shadow-xl shadow-slate-200/50 z-20">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-400" />
          Configuración
        </h3>
        <div className="relative group">
            <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute right-0 top-6 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                Selecciona las columnas correspondientes a cada variable.
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        <SectionHeader 
            title="Datos Principales" 
            icon={Calendar} 
            active={activeSection === 'core'} 
            onClick={() => setActiveSection(activeSection === 'core' ? null : 'core')} 
        />
        
        {activeSection === 'core' && (
            <div className="space-y-4 px-2 pb-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Fecha</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select 
                                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md p-2 pl-3 pr-8 focus:ring-2 focus:ring-mmm-blue-500/20 focus:border-mmm-blue-500 outline-none transition-all appearance-none"
                                value={config.dateCol}
                                onChange={(e) => handleSelect('dateCol', e.target.value)}
                            >
                                <option value="">Seleccionar...</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronRight className="w-3 h-3 absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" />
                        </div>
                        <button 
                            onClick={() => toggleSelection('dateCol')}
                            className={cn(
                                "p-2 rounded-md border transition-colors",
                                isSelecting('dateCol') ? "bg-mmm-blue-100 border-mmm-blue-300 text-mmm-blue-600" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                            title="Seleccionar desde la tabla"
                        >
                            <MousePointerClick className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">KPI Objetivo</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <select 
                                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md p-2 pl-3 pr-8 focus:ring-2 focus:ring-mmm-blue-500/20 focus:border-mmm-blue-500 outline-none transition-all appearance-none"
                                value={config.targetCol}
                                onChange={(e) => handleSelect('targetCol', e.target.value)}
                            >
                                <option value="">Seleccionar...</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronRight className="w-3 h-3 absolute right-3 top-3 text-slate-400 rotate-90 pointer-events-none" />
                        </div>
                        <button 
                            onClick={() => toggleSelection('targetCol')}
                            className={cn(
                                "p-2 rounded-md border transition-colors",
                                isSelecting('targetCol') ? "bg-mmm-blue-100 border-mmm-blue-300 text-mmm-blue-600" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                            title="Seleccionar desde la tabla"
                        >
                            <MousePointerClick className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        )}

        <SectionHeader 
            title="Canales de Medios" 
            icon={BarChart2} 
            active={activeSection === 'media'} 
            onClick={() => setActiveSection(activeSection === 'media' ? null : 'media')} 
        />
        
        {activeSection === 'media' && (
            <div className="space-y-4 px-2 pb-4 animate-in slide-in-from-top-2 duration-200">
                {config.mediaChannels.map((channel, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200 relative group">
                        <button 
                            onClick={() => removeChannel(idx)}
                            className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-3 h-3" />
                        </button>
                        <input 
                            className="bg-transparent border-none text-sm font-semibold text-slate-700 w-full mb-2 focus:ring-0 p-0"
                            value={channel.name}
                            onChange={(e) => handleMediaChange(idx, 'name', e.target.value)}
                            placeholder="Nombre del Canal"
                        />
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Activity className="w-3 h-3 text-slate-400" />
                                <div className="flex-1 flex gap-1">
                                    <select 
                                        className="w-full text-xs bg-white border border-slate-200 rounded p-1.5 focus:border-mmm-blue-500 outline-none"
                                        value={channel.activity_col}
                                        onChange={(e) => handleMediaChange(idx, 'activity_col', e.target.value)}
                                    >
                                        <option value="">Actividad...</option>
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button 
                                        onClick={() => toggleSelection('mediaChannels', idx, 'activity_col')}
                                        className={cn(
                                            "p-1.5 rounded border transition-colors",
                                            isSelecting('mediaChannels', idx, 'activity_col') ? "bg-mmm-blue-100 border-mmm-blue-300 text-mmm-blue-600" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        <MousePointerClick className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-3 h-3 text-slate-400" />
                                <div className="flex-1 flex gap-1">
                                    <select 
                                        className="w-full text-xs bg-white border border-slate-200 rounded p-1.5 focus:border-mmm-blue-500 outline-none"
                                        value={channel.spend_col}
                                        onChange={(e) => handleMediaChange(idx, 'spend_col', e.target.value)}
                                    >
                                        <option value="">Inversión...</option>
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button 
                                        onClick={() => toggleSelection('mediaChannels', idx, 'spend_col')}
                                        className={cn(
                                            "p-1.5 rounded border transition-colors",
                                            isSelecting('mediaChannels', idx, 'spend_col') ? "bg-mmm-blue-100 border-mmm-blue-300 text-mmm-blue-600" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        <MousePointerClick className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                <button 
                    onClick={addChannel}
                    className="w-full py-2 text-xs font-medium text-mmm-blue-600 bg-mmm-blue-50 hover:bg-mmm-blue-100 rounded-lg border border-mmm-blue-200 border-dashed transition-colors flex items-center justify-center gap-1"
                >
                    <Plus className="w-3 h-3" /> Agregar Canal
                </button>
            </div>
        )}

        <SectionHeader 
            title="Variables de Control" 
            icon={Layers} 
            active={activeSection === 'controls'} 
            onClick={() => setActiveSection(activeSection === 'controls' ? null : 'controls')} 
        />

        {activeSection === 'controls' && (
             <div className="px-2 pb-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
                        <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-8 pr-2 text-xs focus:ring-1 focus:ring-mmm-blue-500 outline-none"
                            placeholder="Buscar columna..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => toggleSelection('controlCols')}
                        className={cn(
                            "p-1.5 rounded border transition-colors",
                            isSelecting('controlCols') ? "bg-mmm-blue-100 border-mmm-blue-300 text-mmm-blue-600" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                        )}
                        title="Seleccionar múltiples desde la tabla"
                    >
                        <MousePointerClick className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {filteredColumns.filter(c => c !== config.dateCol && c !== config.targetCol).map(col => (
                        <div key={col} className="flex items-center justify-between group/item px-2 py-1.5 hover:bg-slate-50 rounded">
                            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                <input 
                                    type="checkbox"
                                    className="rounded border-slate-300 text-mmm-blue-600 focus:ring-mmm-blue-500 w-3.5 h-3.5"
                                    checked={config.controlCols.includes(col)}
                                    onChange={() => toggleControl(col)}
                                />
                                <span className={cn("text-xs truncate", config.controlCols.includes(col) ? "text-slate-900 font-medium" : "text-slate-500 group-hover/item:text-slate-700")}>{col}</span>
                            </label>
                            {onDeleteColumn && (
                                <button
                                    onClick={() => onDeleteColumn(col)}
                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity p-1"
                                    title="Eliminar columna"
                                >
                                    <Trash className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
             </div>
        )}

        {/* Model Selection Removed - Default to all */}
        {/*
        <SectionHeader 
            title="Tipo de Modelo" 
            icon={GitBranch} 
            active={activeSection === 'model'} 
            onClick={() => setActiveSection(activeSection === 'model' ? null : 'model')} 
        />

        {activeSection === 'model' && (
            <div className="px-2 pb-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input 
                            type="radio" 
                            name="model_type" 
                            value="RecursiveLS" 
                            checked={config.model_type !== 'pydlm'} 
                            onChange={() => handleSelect('model_type', 'RecursiveLS')}
                            className="mt-1 text-mmm-blue-600 focus:ring-mmm-blue-500"
                        />
                        <div>
                            <span className="block text-sm font-semibold text-slate-800">Recursive Least Squares (DLM)</span>
                            <span className="block text-xs text-slate-500 mt-1">Estándar. Rápido y robusto para series temporales con coeficientes variables.</span>
                        </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input 
                            type="radio" 
                            name="model_type" 
                            value="pydlm" 
                            checked={config.model_type === 'pydlm'} 
                            onChange={() => handleSelect('model_type', 'pydlm')}
                            className="mt-1 text-mmm-blue-600 focus:ring-mmm-blue-500"
                        />
                        <div>
                            <span className="block text-sm font-semibold text-slate-800">Bayesian DLM (PyDLM)</span>
                            <span className="block text-xs text-slate-500 mt-1">Avanzado. Modelo Bayesiano dinámico para capturar mejor la incertidumbre y estacionalidad compleja.</span>
                        </div>
                    </label>
                </div>
            </div>
        )}
        */}



      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button 
            onClick={onTrain}
            className="w-full py-3 bg-slate-900 hover:bg-black text-white text-sm font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-95"
        >
            Entrenar Modelo
            <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
