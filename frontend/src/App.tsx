import { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, FileText, BarChart2, Settings, Download, CheckCircle, AlertCircle, ChevronRight, Plus, Trash, HelpCircle, ArrowLeft, Loader2, LayoutGrid, Zap, PieChart, Database, Eye, X, TrendingUp, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Brush, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { HowItWorks } from './components/HowItWorks';
import { MetricCard } from './components/MetricCard';
import { Tabs } from './components/Tabs';
import { FileUpload } from './components/FileUpload';
import { LoadingState } from './components/LoadingState';
import { DataGrid } from './components/DataGrid';
import { ConfigPanel } from './components/ConfigPanel';

const API_URL = 'http://localhost:8000';

function App() {
  const [step, setStep] = useState<'upload' | 'studio' | 'processing_base' | 'base_models' | 'processing_dlm' | 'dlm_results'>('upload');
  const [activeTab, setActiveTab] = useState<'data' | 'preview'>('data');
  const [columns, setColumns] = useState<string[]>([]);
  const [filename, setFilename] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  // Configuration State
  const [config, setConfig] = useState({
    dateCol: '',
    targetCol: '',
    mediaChannels: [] as {name: string, activity_col: string, spend_col: string}[],
    controlCols: [] as string[],
    model_type: 'pydlm'
  });
  
  const [activeSelection, setActiveSelection] = useState<{field: string, index?: number, subfield?: string} | null>(null);

  const handleColumnClick = (col: string) => {
    if (!activeSelection) return;

    const { field, index, subfield } = activeSelection;

    if (field === 'dateCol') {
        setConfig(prev => ({ ...prev, dateCol: col }));
        setActiveSelection(null);
    } else if (field === 'targetCol') {
        setConfig(prev => ({ ...prev, targetCol: col }));
        setActiveSelection(null);
    } else if (field === 'mediaChannels' && typeof index === 'number' && subfield) {
        setConfig(prev => {
            const newMedia = [...prev.mediaChannels];
            newMedia[index] = { ...newMedia[index], [subfield]: col };
            return { ...prev, mediaChannels: newMedia };
        });
        setActiveSelection(null);
    } else if (field === 'controlCols') {
        setConfig(prev => {
            const newControls = prev.controlCols.includes(col)
                ? prev.controlCols.filter(c => c !== col)
                : [...prev.controlCols, col];
            return { ...prev, controlCols: newControls };
        });
        // Keep selection mode active for multiple selections
    }
  };
  
  // Base Models State
  const [baseModels, setBaseModels] = useState<any>(null);
  const [selectedBaseModel, setSelectedBaseModel] = useState<string>('Ridge');
  const [priors, setPriors] = useState<any[]>([]);
  const [ridgeAlpha, setRidgeAlpha] = useState(1.0);
  
  // Results State
  const [results, setResults] = useState<any>(null);
  const [activeVariation, setActiveVariation] = useState<string>('Ridge'); // Default to Ridge
  const [resultTab, setResultTab] = useState('overview');
  
  // Prediction / Optimization State
  const [optimizeBudget, setOptimizeBudget] = useState<number>(10000);
  const [optimizePeriods, setOptimizePeriods] = useState<number>(4);
  const [channelBounds, setChannelBounds] = useState<Record<string, [number, number]>>({});
  const [optimizationResults, setOptimizationResults] = useState<any>(null);

  // Initialize Optimization Scenario when results change
  useEffect(() => {
    if (results && results.roi) {
        const initialBounds: Record<string, [number, number]> = {};
        Object.keys(results.roi).forEach(canal => {
            initialBounds[canal] = [-0.2, 0.5]; // Default: -20% to +50%
        });
        setChannelBounds(initialBounds);
        setOptimizationResults(null);
    }
  }, [results]);

  const handleOptimize = async () => {
      try {
          const res = await axios.post(`${API_URL}/optimize_budget`, {
              total_budget: optimizeBudget,
              periods: optimizePeriods,
              bounds: channelBounds
          });
          setOptimizationResults(res.data);
      } catch (err) {
          console.error("Error calculating optimization:", err);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData);
      const cols = res.data.columns;
      setColumns(cols);
      setFilename(res.data.filename);
      setRowCount(res.data.rows);
      setStep('studio');
      setActiveTab('data');
      setError('');
      
      // Auto-detect channels
      detectChannels(cols);

      // Fetch preview data
      const previewRes = await axios.get(`${API_URL}/data/preview`);
      setPreviewData(previewRes.data.data);
    } catch (err) {
      setError('Error al subir el archivo. Asegúrate de que sea un archivo CSV o Excel válido.');
      console.error(err);
    }
  };

  const detectChannels = (cols: string[]) => {
      // Basic heuristics
      // 1. Identify Date
      const dateKeywords = ['date', 'fecha', 'time', 'period', 'week', 'month', 'day'];
      const dateCol = cols.find(c => dateKeywords.some(k => c.toLowerCase().includes(k))) || '';
      
      // 2. Identify Target (Sales, Conversions)
      const targetKeywords = ['sales', 'ventas', 'revenue', 'ingresos', 'conversions', 'conversiones', 'orders', 'pedidos'];
      const targetCol = cols.find(c => targetKeywords.some(k => c.toLowerCase().includes(k))) || '';

      // 3. Identify Media Channels (Pairs of Spend/Impression or similar)
      // Look for columns with 'spend', 'cost', 'inversion'
      const spendKeywords = ['spend', 'cost', 'inversion', 'gasto', 'budget'];
      const activityKeywords = ['impression', 'imp', 'click', 'clic', 'grp', 'reach', 'alcance', 'session'];
      
      const potentialSpend = cols.filter(c => spendKeywords.some(k => c.toLowerCase().includes(k)));
      const potentialActivity = cols.filter(c => activityKeywords.some(k => c.toLowerCase().includes(k)));
      
      const mediaChannels: {name: string, activity_col: string, spend_col: string}[] = [];
      
      // Try to match spend/activity by common prefix
      // E.g. "TV_Spend" and "TV_Imp" -> prefix "TV"
      
      potentialSpend.forEach(sCol => {
          // Clean suffixes to find base name
          let baseName = sCol;
          spendKeywords.forEach(k => {
              const regex = new RegExp(`[\\s_.-]?${k}[\\s_.-]?`, 'i');
              baseName = baseName.replace(regex, '').trim();
          });
          
          if (!baseName) return; // Identifying just "Spend" is ambiguous if multiple
          
          // Find matching activity
          // Strict match first: activity col contains baseName
          let aCol = potentialActivity.find(a => a.toLowerCase().includes(baseName.toLowerCase()));
          
          if (aCol) {
              mediaChannels.push({
                  name: baseName,
                  activity_col: aCol,
                  spend_col: sCol
              });
          }
      });
      
      // Update config
      setConfig(prev => ({
          ...prev,
          dateCol: dateCol,
          targetCol: targetCol,
          mediaChannels: mediaChannels.length > 0 ? mediaChannels : prev.mediaChannels,
          // Default controls: columns not used elsewhere
          controlCols: [] 
      }));
  };

  const handleTrainBaseModels = async () => {
    if (!config.dateCol || !config.targetCol || config.mediaChannels.length === 0) {
      setError('Por favor completa la configuración: Fecha, Objetivo y al menos un Canal de Medios.');
      return;
    }
    
    for (const ch of config.mediaChannels) {
        if (!ch.name || !ch.activity_col || !ch.spend_col) {
            setError('Por favor completa todos los campos para los canales de medios.');
            return;
        }
    }

    setStep('processing_base');
    setError('');

    try {
      const res = await axios.post(`${API_URL}/train_base_models`, {
        date_col: config.dateCol,
        target_col: config.targetCol,
        media_config: config.mediaChannels,
        control_cols: config.controlCols,
        ridge_alpha: ridgeAlpha
      });
      
      setBaseModels(res.data.models);
      
      // Initialize priors from Ridge model if available, else first
      const defaultModel = res.data.models['Ridge'] ? 'Ridge' : Object.keys(res.data.models)[0];
      setSelectedBaseModel(defaultModel);
      
      const stats = res.data.models[defaultModel].stats;
      const initialPriors = stats.map((s: any) => ({
          canal: s.canal,
          initial_value: s.beta,
          SE: s.se || 1.0,
          df: 0.95, // Default discount factor for DLM
          vif: s.vif,
          t_value: s.t_value,
          contribution: s.contribution,
          abs_contribution: s.abs_contribution,
          pct_contribution: s.pct_contribution
      }));
      setPriors(initialPriors);
      
      setStep('base_models');
    } catch (err) {
      setError('Error al entrenar los modelos base.');
      setStep('studio');
      console.error(err);
    }
  };

  const handleBaseModelChange = (method: string) => {
      setSelectedBaseModel(method);
      if (baseModels && baseModels[method]) {
          const stats = baseModels[method].stats;
          const updatedPriors = stats.map((s: any) => {
              const existingPrior = priors.find(p => p.canal === s.canal);
              return {
                  canal: s.canal,
                  initial_value: s.beta,
                  SE: s.se || 1.0,
                  df: existingPrior ? existingPrior.df : 0.95,
                  vif: s.vif,
                  t_value: s.t_value,
                  contribution: s.contribution,
                  abs_contribution: s.abs_contribution,
                  pct_contribution: s.pct_contribution
              };
          });
          setPriors(updatedPriors);
      }
  };

  const handleTrainDLM = async () => {
    setStep('processing_dlm');
    setError('');

    try {
      await axios.post(`${API_URL}/train_dlm`, {
        date_col: config.dateCol,
        target_col: config.targetCol,
        media_config: config.mediaChannels,
        control_cols: config.controlCols,
        model_type: config.model_type,
        priors: priors,
        best_params: baseModels[selectedBaseModel].best_params
      });
      
      const res = await axios.get(`${API_URL}/results`);
      setResults(res.data);
      
      // We only have one result now (DLM)
      setStep('dlm_results');
      setActiveTab('preview');
    } catch (err) {
      setError('Error al entrenar el modelo DLM.');
      setStep('base_models');
      console.error(err);
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'mmm_resultados.xlsx');
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden">
      {/* Header - Flourish Style */}
      <header className="bg-slate-900 text-white h-14 flex items-center justify-between px-4 shadow-md flex-shrink-0 z-50">
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep('upload')}>
                 <div className="bg-mmm-blue-500 p-1.5 rounded-lg">
                    <BarChart2 className="w-5 h-5 text-white" />
                 </div>
                 <span className="font-bold text-lg tracking-tight">MMM Builder</span>
             </div>
             {filename && (
                 <>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-200">{filename}</span>
                    </div>
                 </>
             )}
         </div>

         {step === 'studio' && (
             <div className="absolute left-1/2 transform -translate-x-1/2 flex bg-slate-800 rounded-lg p-1">
                 <button 
                    onClick={() => setActiveTab('data')}
                    className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'data' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                    Datos
                 </button>
                 <button 
                    onClick={() => setActiveTab('preview')}
                    className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'preview' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                    Resultados
                 </button>
             </div>
         )}

         <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowGuide(!showGuide)}
                className="text-slate-400 hover:text-white transition-colors"
             >
                <HelpCircle className="w-5 h-5" />
             </button>
             {activeTab === 'preview' && (
                 <button 
                    onClick={handleExport}
                    className="flex items-center px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors border border-slate-600"
                 >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                 </button>
             )}
         </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex">
        <AnimatePresence>
            {error && (
            <motion.div 
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-red-200 text-red-600 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 min-w-[400px]"
            >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
                <button onClick={() => setError('')} className="ml-auto text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                </button>
            </motion.div>
            )}
        </AnimatePresence>

        {step === 'upload' && (
             <div className="w-full h-full flex items-center justify-center bg-slate-50 p-8">
                 <div className="max-w-4xl w-full">
                     <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Carga tus datos históricos</h1>
                        <p className="text-slate-500 text-lg">Comienza tu análisis subiendo un archivo CSV o Excel.</p>
                     </div>
                     <FileUpload onFileSelect={handleFileUpload} accept=".csv,.xlsx" />
                     
                     <div className="mt-8 text-center">
                        <button 
                            onClick={async () => {
                                // Create a dummy file or just skip to config with empty data if handled
                                // But better to actually upload a sample.
                                // For now, let's just create a dummy CSV in memory and upload it.
                                const csvContent = "Date,Sales,TV_Spend,TV_Impressions,Radio_Spend,Radio_Impressions,Search_Spend,Search_Clicks\n2023-01-01,10000,5000,100000,2000,50000,1000,2000\n2023-01-08,12000,6000,120000,2000,50000,1500,3000\n2023-01-15,11000,5500,110000,2000,50000,1200,2500";
                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                const file = new File([blob], "sample_data.csv", { type: 'text/csv' });
                                
                                // Reuse handleFileUpload logic partially
                                const formData = new FormData();
                                formData.append('file', file);
                                
                                try {
                                    const res = await axios.post(`${API_URL}/upload`, formData);
                                    setColumns(res.data.columns);
                                    setFilename("sample_data.csv");
                                    setRowCount(res.data.rows);
                                    setStep('studio');
                                    setActiveTab('data');
                                    setError('');
                                    const previewRes = await axios.get(`${API_URL}/data/preview`);
                                    setPreviewData(previewRes.data.data);
                                } catch (err) {
                                    console.error(err);
                                }
                            }}
                            className="text-sm text-mmm-blue-600 hover:text-mmm-blue-700 font-medium underline decoration-dashed underline-offset-4 hover:decoration-solid"
                        >
                            ¿No tienes datos? Prueba con un archivo de ejemplo
                        </button>
                     </div>
                 </div>
             </div>
        )}

        {(step === 'processing_base' || step === 'processing_dlm') && (
             <div className="w-full h-full flex items-center justify-center bg-slate-50">
                 <LoadingState />
             </div>
        )}

        {step === 'base_models' && (
             <div className="w-full h-full overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
                 <div className="max-w-6xl mx-auto space-y-8">
                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="mb-6 border-b border-slate-100 pb-4">
                             <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                 <Settings className="w-6 h-6 text-mmm-blue-500" />
                                 Modelos Base & Selección
                             </h2>
                             <p className="text-slate-500 mt-2">
                                 Selecciona el modelo base que mejor represente tus datos. Los resultados servirán como valores iniciales (priors) para el modelo DLM final.
                             </p>
                         </div>

                         {/* Variation Selector */}
                         <div className="flex items-center space-x-4 mb-6">
                             <span className="text-sm font-medium text-slate-500">Mejor Modelo:</span>
                             <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-sm">
                                 {['Linear', 'Ridge', 'RandomForest'].map((method) => (
                                     <button
                                         key={method}
                                         onClick={() => handleBaseModelChange(method)}
                                         className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                             selectedBaseModel === method 
                                             ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                                             : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                         }`}
                                     >
                                         {method === 'Linear' ? 'Regresión Lineal' : 
                                          method === 'Ridge' ? 'Ridge (Recomendado)' : 
                                          'Random Forest'}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         
                         <div className="overflow-x-auto">
                             <table className="w-full text-left border-collapse">
                                 <thead>
                                     <tr className="bg-slate-50 border-y border-slate-200">
                                         <th className="p-3 text-sm font-semibold text-slate-700">Canal</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">Beta</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">SE</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">t-value</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">VIF</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">Contribución Absoluta</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">Contribución %</th>
                                         <th className="p-3 text-sm font-semibold text-slate-700">df (Dinámico)</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {priors.map((prior, index) => (
                                         <tr key={prior.canal} className="border-b border-slate-100 hover:bg-slate-50/50">
                                             <td className="p-3 text-sm font-medium text-slate-800">{prior.canal}</td>
                                             <td className="p-3">
                                                 <input 
                                                     type="number"
                                                     step="any"
                                                     value={prior.initial_value} 
                                                     onChange={(e) => {
                                                         const newPriors = [...priors];
                                                         newPriors[index].initial_value = parseFloat(e.target.value) || 0;
                                                         setPriors(newPriors);
                                                     }}
                                                     className="w-24 p-1.5 border border-slate-300 rounded focus:ring-mmm-blue-500 focus:border-mmm-blue-500 text-sm"
                                                 />
                                             </td>
                                             <td className="p-3 text-sm text-slate-600">{prior.SE.toFixed(4)}</td>
                                             <td className={`p-3 text-sm ${Math.abs(prior.t_value) < 1.96 ? 'text-red-500' : 'text-slate-600'}`}>
                                                {prior.t_value.toFixed(2)}
                                             </td>
                                             <td className={`p-3 text-sm ${prior.vif > 10 ? 'text-red-500' : 'text-slate-600'}`}>
                                                {prior.vif === Infinity ? 'Inf' : prior.vif.toFixed(2)}
                                             </td>
                                             <td className="p-3 text-sm text-slate-600">${Math.round(prior.abs_contribution).toLocaleString()}</td>
                                             <td className="p-3 text-sm text-slate-600">{(prior.pct_contribution * 100).toFixed(1)}%</td>
                                             <td className="p-3">
                                                <input 
                                                     type="number"
                                                     step="0.01"
                                                     min="0"
                                                     max="1"
                                                     value={prior.df} 
                                                     onChange={(e) => {
                                                         const newPriors = [...priors];
                                                         newPriors[index].df = parseFloat(e.target.value) || 0.95;
                                                         setPriors(newPriors);
                                                     }}
                                                     className="w-20 p-1.5 border border-slate-300 rounded focus:ring-mmm-blue-500 focus:border-mmm-blue-500 text-sm"
                                                 />
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                        
                        <div className="mt-8 flex justify-end gap-4">
                            <button 
                                onClick={() => setStep('studio')}
                                className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                            >
                                Volver a Datos
                            </button>
                            <button 
                                onClick={handleTrainDLM}
                                className="px-6 py-2 bg-mmm-blue-600 text-white rounded-lg hover:bg-mmm-blue-700 font-medium transition-colors shadow-sm"
                            >
                                Entrenar DLM Final
                            </button>
                        </div>
                     </div>
                 </div>
             </div>
        )}

        {step === 'studio' && (
            <div className="w-full h-full flex">
                <ConfigPanel 
                    columns={columns} 
                    config={config} 
                    onConfigChange={setConfig} 
                    onTrain={handleTrainBaseModels} 
                    onSelectionModeChange={setActiveSelection}
                    activeSelection={activeSelection}
                    onDeleteColumn={(col) => {
                        setColumns(prev => prev.filter(c => c !== col));
                        setPreviewData(prev => prev.map(row => {
                            const newRow = {...row};
                            delete newRow[col];
                            return newRow;
                        }));
                    }}
                />
                <div className="flex-1 bg-slate-100 p-4 overflow-hidden flex flex-col">
                    <div className="bg-white rounded-t-lg border border-slate-200 border-b-0 p-3 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                            <Database className="w-4 h-4 text-slate-400" />
                            Vista de Datos ({rowCount} filas)
                        </h3>
                        <div className="text-xs text-slate-400">
                            Mostrando primeras 50 filas
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <DataGrid 
                            columns={columns} 
                            data={previewData} 
                            config={config} 
                            selectionMode={!!activeSelection}
                            onColumnClick={handleColumnClick}
                        />
                    </div>
                </div>
            </div>
        )}

        {step === 'dlm_results' && results && (
                    <div className="w-full h-full overflow-y-auto bg-slate-50 p-8 custom-scrollbar">
                        <div className="max-w-7xl mx-auto space-y-8">
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <MetricCard 
                                    title="Model Fit (MAPE)" 
                                    value={`${(results.diagnostics.MAPE * 100).toFixed(1)}%`}
                                    subtitle="Precisión del modelo DLM"
                                    trend="up"
                                    color="blue"
                                />
                                <MetricCard 
                                    title="ROI Global" 
                                    value={
                                        (() => {
                                            const rois = Object.values(results.roi as Record<string, {ROI: number, "Total Contribution": number, "Total Spend": number}>);
                                            if (rois.length === 0) return 'N/A';
                                            
                                            const totalContrib = rois.reduce((acc, val) => acc + (val["Total Contribution"] || 0), 0);
                                            const totalSpend = rois.reduce((acc, val) => acc + (val["Total Spend"] || 0), 0);
                                            
                                            if (totalSpend === 0) return 'N/A';
                                            return (totalContrib / totalSpend).toFixed(2);
                                        })()
                                    }
                                    subtitle="Retorno Total de Inversión"
                                    trend="up"
                                    color="green"
                                />
                                <MetricCard 
                                    title="RMSE" 
                                    value={results.diagnostics.RMSE.toFixed(0)}
                                    subtitle="Error Cuadrático"
                                    trend="neutral"
                                    color="slate"
                                />
                                <MetricCard 
                                    title="Durbin-Watson" 
                                    value={results.diagnostics['Durbin-Watson'].toFixed(2)}
                                    subtitle="Estabilidad"
                                    trend="neutral"
                                    color="purple"
                                />
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
                                <div className="border-b border-slate-100 p-4">
                                    <div className="max-w-md">
                                        <Tabs 
                                            activeTab={resultTab} 
                                            onChange={setResultTab}
                                            options={[
                                                { id: 'overview', label: 'Resumen', icon: <LayoutGrid className="w-4 h-4" /> },
                                                { id: 'adstock', label: 'Adstock', icon: <Eye className="w-4 h-4" /> },
                                                { id: 'roi', label: 'ROI & Eficiencia', icon: <PieChart className="w-4 h-4" /> },
                                                { id: 'curves', label: 'Curvas Saturación', icon: <Zap className="w-4 h-4" /> },
                                                { id: 'stats', label: 'Estadísticas', icon: <Database className="w-4 h-4" /> },
                                                { id: 'predict', label: 'Optimización', icon: <TrendingUp className="w-4 h-4" /> }
                                            ]}
                                        />
                                    </div>
                                </div>
                                <div className="p-6">
                                     {resultTab === 'overview' && (
                                        <div className="h-[500px]">
                                             <h3 className="font-bold text-slate-800 mb-4">Descomposición de Ventas (DLM)</h3>
                                             <ResponsiveContainer width="100%" height="100%">
                                               <AreaChart data={results.decomposition} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                                                 <defs>
                                                    <linearGradient id="colorUnexplained" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                                                    </linearGradient>
                                                    <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}/>
                                                    </linearGradient>
                                                 </defs>
                                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                 <XAxis 
                                                    dataKey={config.dateCol} 
                                                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month: 'short', year: '2-digit'})} 
                                                    stroke="#94a3b8" 
                                                    fontSize={12} 
                                                    tickMargin={10} 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                 />
                                                 <YAxis 
                                                    stroke="#94a3b8" 
                                                    fontSize={12} 
                                                    tickFormatter={(val) => `${val / 1000}k`} 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                 />
                                                 <Tooltip 
                                                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                     labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                                                 />
                                                 <Legend verticalAlign="top" height={36}/>
                                                 <Brush 
                                                    dataKey={config.dateCol} 
                                                    height={30} 
                                                    stroke="#cbd5e1"
                                                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month: 'short'})}
                                                    alwaysShowText={false}
                                                 />
                                                 
                                                 {/* Render Areas - Dynamic based on data keys */}
                                                 {/* 1. Base (Trend) & Seasonality - Bottom of Stack */}
                                                 <Area type="monotone" dataKey="Base (Trend)" stackId="1" stroke="#cbd5e1" fill="url(#colorBase)" name="Tendencia Base" isAnimationActive={false} />
                                                 <Area type="monotone" dataKey="Seasonality" stackId="1" stroke="#94a3b8" fill="#e2e8f0" name="Estacionalidad" isAnimationActive={false} />

                                                 {/* 2. Media Channels & Controls */}
                                                 {Object.keys((results.decomposition as any[])?.[0] || {})
                                                    .filter(k => ![config.dateCol, 'Unexplained', 'const', 'Base (Trend)', 'Seasonality'].includes(k))
                                                    .map((key: string, i: number) => (
                                                      <Area 
                                                        key={key} 
                                                        type="monotone" 
                                                        dataKey={key} 
                                                        stackId="1" 
                                                        stroke={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'][i % 6]} 
                                                        fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'][i % 6]} 
                                                        fillOpacity={0.8} 
                                                        name={key.replace('_saturated', '')}
                                                        isAnimationActive={false}
                                                      />
                                                 ))}
                                                 
                                                 {/* 3. Residuals - Top of Stack */}
                                                 <Area type="monotone" dataKey="Unexplained" stackId="1" stroke="#64748b" fill="url(#colorUnexplained)" name="No Explicado" isAnimationActive={false} />
                                               </AreaChart>
                                             </ResponsiveContainer>
                                        </div>
                                     )}
                                     {resultTab === 'adstock' && (
                                         <div className="h-[500px]">
                                             <h3 className="font-bold text-slate-800 mb-4">Efecto Adstock por Canal</h3>
                                             <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={results.adstock_data} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis 
                                                        dataKey={config.dateCol} 
                                                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month: 'short', year: '2-digit'})} 
                                                        stroke="#94a3b8" 
                                                        fontSize={12} 
                                                        tickMargin={10} 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                    />
                                                    <YAxis 
                                                        stroke="#94a3b8" 
                                                        fontSize={12} 
                                                        tickFormatter={(val) => `${val / 1000}k`} 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                                                    />
                                                    <Legend verticalAlign="top" height={36}/>
                                                    <Brush 
                                                        dataKey={config.dateCol} 
                                                        height={30} 
                                                        stroke="#cbd5e1"
                                                        tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {month: 'short'})}
                                                        alwaysShowText={false}
                                                    />
                                                    {Object.keys((results.adstock_data as any[])?.[0] || {})
                                                        .filter(k => k !== config.dateCol)
                                                        .map((key: string, i: number) => {
                                                            const isOriginal = key.endsWith('_Original');
                                                            const colorIndex = Math.floor(i / 2) % 6;
                                                            const color = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'][colorIndex];
                                                            
                                                            return (
                                                                <Line 
                                                                    key={key} 
                                                                    type="monotone" 
                                                                    dataKey={key} 
                                                                    stroke={color}
                                                                    strokeWidth={isOriginal ? 1 : 3}
                                                                    strokeDasharray={isOriginal ? "5 5" : ""}
                                                                    dot={false}
                                                                    name={key.replace('_', ' ')}
                                                                    isAnimationActive={false}
                                                                />
                                                            );
                                                        })}
                                                </LineChart>
                                             </ResponsiveContainer>
                                         </div>
                                     )}
                                     {resultTab === 'roi' && (
                                         <div className="h-[500px]">
                                             <h3 className="font-bold text-slate-800 mb-4">Retorno de Inversión (ROI) - DLM</h3>
                                             <ResponsiveContainer width="100%" height="100%">
                                                  <BarChart data={Object.entries(results.roi).map(([k, v]: any) => ({ name: k, roi: v.ROI })).sort((a, b) => b.roi - a.roi)} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                                    <XAxis type="number" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                                                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={100} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{fill: '#f8fafc', radius: 8}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                    <Bar dataKey="roi" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
                                                  </BarChart>
                                             </ResponsiveContainer>
                                         </div>
                                     )}
                                     {resultTab === 'curves' && (
                                         <div className="h-[500px]">
                                             <h3 className="font-bold text-slate-800 mb-4">Curvas de Respuesta (DLM)</h3>
                                             <ResponsiveContainer width="100%" height="100%">
                                                <LineChart>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="x" type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.toFixed(0)} axisLine={false} tickLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                    <Legend />
                                                    {Object.entries(results.saturation_curves).map(([channel, data]: any, i) => (
                                                        <Line key={channel} data={data} type="monotone" dataKey="y" name={channel} stroke={['#3b82f6', '#8b5cf6', '#10b981'][i % 3]} dot={false} strokeWidth={3} isAnimationActive={false} />
                                                    ))}
                                                </LineChart>
                                             </ResponsiveContainer>
                                         </div>
                                     )}
                                     
                                     {resultTab === 'stats' && (
                                          <div className="h-[500px] overflow-auto flex">
                                              <div className="flex-1">
                                                  <h3 className="font-bold text-slate-800 mb-4">Estadísticas del Modelo (DLM)</h3>
                                                  <table className="w-full text-left border-collapse bg-white">
                                                      <thead>
                                                          <tr className="bg-slate-50 border-y border-slate-200">
                                                              <th className="p-3 text-sm font-semibold text-slate-700">Canal / Variable</th>
                                                              <th className="p-3 text-sm font-semibold text-slate-700">Beta Final</th>
                                                              <th className="p-3 text-sm font-semibold text-slate-700">VIF</th>
                                                              <th className="p-3 text-sm font-semibold text-slate-700">t-value</th>
                                                          </tr>
                                                      </thead>
                                                      <tbody>
                                                          {results.channel_stats && results.channel_stats.map((stat: any) => (
                                                              <tr key={stat.canal} className="border-b border-slate-100 hover:bg-slate-50">
                                                                  <td className="p-3 text-sm font-medium text-slate-800">{stat.canal}</td>
                                                                  <td className="p-3 text-sm text-slate-600">{stat.beta.toFixed(4)}</td>
                                                                  <td className={`p-3 text-sm ${stat.vif > 10 ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                                                                      {stat.vif === Infinity ? 'Inf' : stat.vif.toFixed(2)}
                                                                  </td>
                                                                  <td className={`p-3 text-sm ${Math.abs(stat.t_value) < 1.96 ? 'text-red-500' : 'text-slate-600'}`}>
                                                                      {stat.t_value.toFixed(2)}
                                                                  </td>
                                                              </tr>
                                                          ))}
                                                          {(!results.channel_stats || results.channel_stats.length === 0) && (
                                                              <tr>
                                                                  <td colSpan={4} className="p-4 text-center text-slate-500 text-sm">No hay estadísticas disponibles para este modelo.</td>
                                                              </tr>
                                                          )}
                                                      </tbody>
                                                  </table>
                                                  <div className="mt-4 text-xs text-slate-500 space-y-1">
                                                     <p><strong>VIF (Variance Inflation Factor):</strong> Valores &gt; 10 indican alta multicolinealidad.</p>
                                                     <p><strong>t-value:</strong> Valores absolutos &gt; 1.96 indican significancia estadística (95% confianza).</p>
                                                  </div>
                                              </div>
                                              {/* Panel Lateral para Re-entrenar */}
                                              <div className="w-80 ml-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                                      <Settings className="w-4 h-4 text-mmm-blue-500" />
                                                      Modificar Variables
                                                  </h4>
                                                  <p className="text-xs text-slate-500 mb-4">Ajusta los valores iniciales y reentrena el modelo DLM para ver cómo cambian los resultados.</p>
                                                  
                                                  <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                                                      {priors.map((prior, index) => (
                                                          <div key={prior.canal} className="bg-white p-3 rounded-lg border border-slate-200">
                                                              <label className="text-sm font-medium text-slate-700 block mb-2">{prior.canal}</label>
                                                              <div className="space-y-2">
                                                                  <div className="flex items-center justify-between text-xs">
                                                                      <span className="text-slate-500">Beta Inicial:</span>
                                                                      <input 
                                                                          type="number" step="any"
                                                                          value={prior.initial_value}
                                                                          onChange={(e) => {
                                                                              const newPriors = [...priors];
                                                                              newPriors[index].initial_value = parseFloat(e.target.value) || 0;
                                                                              setPriors(newPriors);
                                                                          }}
                                                                          className="w-20 p-1 border border-slate-300 rounded"
                                                                      />
                                                                  </div>
                                                                  <div className="flex items-center justify-between text-xs">
                                                                      <span className="text-slate-500">SE:</span>
                                                                      <input 
                                                                          type="number" step="any"
                                                                          value={prior.SE}
                                                                          onChange={(e) => {
                                                                              const newPriors = [...priors];
                                                                              newPriors[index].SE = parseFloat(e.target.value) || 0;
                                                                              setPriors(newPriors);
                                                                          }}
                                                                          className="w-20 p-1 border border-slate-300 rounded"
                                                                      />
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      ))}
                                                  </div>
                                                  <button 
                                                      onClick={handleTrainDLM}
                                                      className="mt-4 w-full py-2 bg-mmm-blue-600 hover:bg-mmm-blue-700 text-white rounded-lg font-medium transition-colors"
                                                  >
                                                      Re-entrenar DLM
                                                  </button>
                                              </div>
                                          </div>
                                      )}

                                      {resultTab === 'predict' && (
                                          <div className="min-h-[500px]">
                                              <div className="flex justify-between items-center mb-6">
                                                <h3 className="font-bold text-slate-800">Optimizador de Presupuesto</h3>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-slate-600">Periodos a optimizar:</span>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        max="52" 
                                                        value={optimizePeriods} 
                                                        onChange={(e) => setOptimizePeriods(parseInt(e.target.value) || 1)}
                                                        className="w-20 p-1.5 border border-slate-300 rounded-md text-sm text-center"
                                                    />
                                                </div>
                                              </div>
                                              
                                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                  {/* Controles de Inversión */}
                                                  <div className="lg:col-span-1 space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                                                      <div className="mb-6">
                                                          <h4 className="font-semibold text-slate-700 text-sm mb-2">Presupuesto Total a Invertir</h4>
                                                          <div className="relative">
                                                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                              <input 
                                                                  type="number" 
                                                                  min="0"
                                                                  value={optimizeBudget} 
                                                                  onChange={(e) => setOptimizeBudget(parseFloat(e.target.value) || 0)}
                                                                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-mmm-blue-500 focus:border-mmm-blue-500"
                                                              />
                                                          </div>
                                                      </div>

                                                      <h4 className="font-semibold text-slate-700 text-sm mb-4">Límites de Variación por Canal</h4>
                                                      {Object.keys(channelBounds).map(canal => (
                                                          <div key={canal} className="bg-white p-3 rounded-lg border border-slate-200 mb-3 space-y-2">
                                                              <label className="text-sm font-medium text-slate-700">{canal}</label>
                                                              <div className="flex items-center gap-2">
                                                                  <div className="flex-1">
                                                                      <span className="text-[10px] text-slate-500 block mb-1">Min %</span>
                                                                      <input 
                                                                          type="number" 
                                                                          step="0.1"
                                                                          value={channelBounds[canal][0] * 100} 
                                                                          onChange={(e) => setChannelBounds(prev => ({...prev, [canal]: [parseFloat(e.target.value)/100, prev[canal][1]]}))}
                                                                          className="w-full p-1.5 border border-slate-300 rounded text-xs"
                                                                      />
                                                                  </div>
                                                                  <div className="flex-1">
                                                                      <span className="text-[10px] text-slate-500 block mb-1">Max %</span>
                                                                      <input 
                                                                          type="number" 
                                                                          step="0.1"
                                                                          value={channelBounds[canal][1] * 100} 
                                                                          onChange={(e) => setChannelBounds(prev => ({...prev, [canal]: [prev[canal][0], parseFloat(e.target.value)/100]}))}
                                                                          className="w-full p-1.5 border border-slate-300 rounded text-xs"
                                                                      />
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      ))}
                                                      <button 
                                                        onClick={handleOptimize}
                                                        className="w-full mt-6 py-2.5 bg-mmm-blue-600 hover:bg-mmm-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                                      >
                                                          <TrendingUp className="w-4 h-4" />
                                                          Optimizar Presupuesto
                                                      </button>
                                                  </div>

                                                  {/* Resultados de la Predicción */}
                                                  <div className="lg:col-span-2">
                                                      {optimizationResults ? (
                                                          <div className="space-y-6">
                                                              <div className="grid grid-cols-2 gap-4">
                                                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                      <p className="text-xs text-slate-500 font-medium mb-1">Presupuesto Asignado</p>
                                                                      <p className="text-xl font-bold text-slate-800">${Math.round(optimizationResults.total_budget).toLocaleString()}</p>
                                                                  </div>
                                                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                      <p className="text-xs text-slate-500 font-medium mb-1">Ventas Incrementales Maximizadas</p>
                                                                      <p className="text-xl font-bold text-mmm-blue-600">${Math.round(optimizationResults.optimized_incremental_sales).toLocaleString()}</p>
                                                                  </div>
                                                              </div>

                                                              <div className="h-[300px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                  <h4 className="text-sm font-semibold text-slate-700 mb-4">Inversión Recomendada por Canal</h4>
                                                                  <ResponsiveContainer width="100%" height="100%">
                                                                      <BarChart data={optimizationResults.allocation}>
                                                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                          <XAxis dataKey="canal" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                                                                          <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v/1000}k`} axisLine={false} tickLine={false} />
                                                                          <Tooltip cursor={{fill: '#f8fafc'}} formatter={(val: any) => `$${Math.round(Number(val)).toLocaleString()}`} />
                                                                          <Legend />
                                                                          <Bar dataKey="optimized_spend" name="Inversión Optimizada" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                                          <Bar dataKey="historical_avg_spend" name="Inversión Histórica Promedio" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                                                      </BarChart>
                                                                  </ResponsiveContainer>
                                                              </div>
                                                          </div>
                                                      ) : (
                                                          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300 p-8">
                                                              <Zap className="w-12 h-12 mb-4 text-slate-300" />
                                                              <p className="text-center">Define el presupuesto total y los límites de variación, luego haz clic en "Optimizar Presupuesto" para ver la distribución ideal.</p>
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

        {showGuide && (
             <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                 <div className="max-w-4xl w-full">
                    <HowItWorks onClose={() => setShowGuide(false)} />
                 </div>
             </div>
        )}
      </main>
    </div>
  );
}

export default App;
