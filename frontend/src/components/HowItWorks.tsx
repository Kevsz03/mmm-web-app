import { motion } from 'framer-motion';
import { BookOpen, Database, Sliders, TrendingUp } from 'lucide-react';

interface Props {
  onClose?: () => void;
}

export const HowItWorks = ({ onClose }: Props) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
    >
      <div className="bg-mmm-blue-50 p-6 border-b border-mmm-blue-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-mmm-blue-600" />
            Guía Rápida de Uso
          </h2>
          <p className="text-sm text-slate-500 mt-1">Sigue estos pasos para construir tu Marketing Mix Model</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="relative">
          <div className="absolute top-0 left-0 w-8 h-8 bg-mmm-blue-100 rounded-full flex items-center justify-center text-mmm-blue-600 font-bold -translate-x-3 -translate-y-3 shadow-sm">1</div>
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-400 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Prepara tus Datos</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sube un archivo Excel o CSV con columnas de Fecha, Ventas y Medios.
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-0 left-0 w-8 h-8 bg-mmm-blue-100 rounded-full flex items-center justify-center text-mmm-blue-600 font-bold -translate-x-3 -translate-y-3 shadow-sm">2</div>
          <div className="flex flex-col items-center text-center">
             <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-400 shadow-inner">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Selección Variables</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Asigna qué columnas son fechas, objetivos (KPI) y canales de inversión (spend/actividad).
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-0 left-0 w-8 h-8 bg-mmm-blue-100 rounded-full flex items-center justify-center text-mmm-blue-600 font-bold -translate-x-3 -translate-y-3 shadow-sm">3</div>
          <div className="flex flex-col items-center text-center">
             <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-400 shadow-inner">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Preprocesamiento</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ajusta los priors (Initial Value, SE, df) calculados por OLS y define los efectos fijos/dinámicos (R).
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute top-0 left-0 w-8 h-8 bg-mmm-blue-100 rounded-full flex items-center justify-center text-mmm-blue-600 font-bold -translate-x-3 -translate-y-3 shadow-sm">4</div>
          <div className="flex flex-col items-center text-center">
             <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-400 shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Resultados</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analiza ROI, curvas de saturación, estadísticas (VIF, t-value) y exporta.
            </p>
          </div>
        </div>
      </div>
      
      {onClose && (
        <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-100">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 font-medium px-4 py-2">
                Entendido
            </button>
        </div>
      )}
    </motion.div>
  );
};
