import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export const LoadingState = () => {
  const [message, setMessage] = useState('Analizando estructura de datos...');
  
  useEffect(() => {
    const messages = [
      'Analizando estructura de datos...',
      'Optimizando parámetros Adstock (Decaimiento)...',
      'Calculando curvas de saturación Hill...',
      'Ajustando Modelo Lineal Dinámico...',
      'Calculando ROI y Atribución...',
      'Generando visualizaciones interactivas...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setMessage(messages[i]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-32 bg-white/50 backdrop-blur-sm rounded-3xl border border-slate-100 shadow-xl max-w-2xl mx-auto">
      <div className="relative mb-12">
        <div className="w-32 h-32 border-8 border-slate-100 rounded-full animate-pulse"></div>
        <div className="w-32 h-32 border-8 border-mmm-blue-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0 shadow-lg shadow-mmm-blue-500/20"></div>
        <div className="absolute top-0 left-0 w-32 h-32 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-mmm-blue-500 animate-spin-slow" />
        </div>
      </div>
      
      <motion.div
        key={message}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.5 }}
        className="text-center px-8"
      >
        <h3 className="text-2xl font-bold text-slate-800 mb-4 tracking-tight">
          Entrenando Modelo Inteligente
        </h3>
        <p className="text-lg text-slate-500 font-medium">
          {message}
        </p>
      </motion.div>
    </div>
  );
};
