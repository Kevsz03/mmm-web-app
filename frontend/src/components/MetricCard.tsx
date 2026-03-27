import { motion } from 'framer-motion';
import { HelpCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'purple' | 'slate';
  tooltip?: string;
}

export const MetricCard = ({ title, value, subtitle, trend, color = 'blue', tooltip }: Props) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    purple: 'bg-violet-50 text-violet-700 border-violet-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const trendIcon = {
    up: <ArrowUpRight className="w-4 h-4 text-emerald-500" />,
    down: <ArrowDownRight className="w-4 h-4 text-rose-500" />,
    neutral: <Minus className="w-4 h-4 text-slate-400" />,
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={`relative p-6 rounded-2xl border ${colorMap[color].split(' ')[2]} bg-white shadow-sm hover:shadow-md transition-all duration-300`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
          {title}
          {tooltip && (
            <div className="group relative ml-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-tight">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          )}
        </h3>
        {trend && (
            <div className={`p-1.5 rounded-full ${trend === 'up' ? 'bg-emerald-50' : trend === 'down' ? 'bg-rose-50' : 'bg-slate-50'}`}>
                {trendIcon[trend]}
            </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${color === 'slate' ? 'text-slate-700' : 'text-slate-900'}`}>
            {value}
        </span>
      </div>
      
      <p className="text-xs font-medium text-slate-400 mt-2">
        {subtitle}
      </p>
    </motion.div>
  );
};
