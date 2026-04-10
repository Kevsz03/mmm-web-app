import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useCallback, useState } from 'react';

interface Props {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept: string;
}

export const FileUpload = ({ onFileSelect, accept }: Props) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Simulate change event
      const event = {
        target: {
          files: e.dataTransfer.files
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onFileSelect(event);
    }
  }, [onFileSelect]);

  return (
    <div 
      className={`
        relative border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300
        ${dragActive ? 'border-mmm-blue-500 bg-mmm-blue-50 scale-[1.02]' : 'border-slate-200 bg-white hover:border-mmm-blue-300 hover:bg-slate-50/50'}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/40 to-transparent rounded-3xl"></div>
      
      <div className="relative z-10 flex flex-col items-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`
            w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-lg
            ${dragActive ? 'bg-mmm-blue-100 text-mmm-blue-600' : 'bg-gradient-to-br from-mmm-blue-50 to-white text-mmm-blue-500 border border-mmm-blue-100'}
          `}
        >
          <Upload className={`w-10 h-10 ${dragActive ? 'animate-bounce' : ''}`} />
        </motion.div>
        
        <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">
          Arrastra y suelta tu archivo aquí
        </h3>
        <p className="text-slate-500 mb-10 text-base max-w-sm mx-auto leading-relaxed">
          Soporta archivos <span className="font-semibold text-slate-700">.CSV</span>, <span className="font-semibold text-slate-700">.XLSX</span> y <span className="font-semibold text-slate-700">.XLS</span> con tus datos históricos.
        </p>
        
        <label className="relative overflow-hidden group inline-flex items-center px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0">
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
          <Upload className="w-5 h-5 mr-3" />
          Seleccionar Archivo Manualmente
          <input type="file" className="hidden" accept={accept} onChange={onFileSelect} />
        </label>
      </div>
    </div>
  );
};
