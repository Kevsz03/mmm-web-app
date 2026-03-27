import { motion } from 'framer-motion';

interface TabsProps {
  activeTab: string;
  onChange: (tab: string) => void;
  options: { id: string; label: string; icon?: React.ReactNode }[];
}

export const Tabs = ({ activeTab, onChange, options }: TabsProps) => {
  return (
    <div className="flex space-x-1 p-1 bg-slate-100 rounded-xl mb-6">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`
            relative flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg flex-1 transition-colors
            ${activeTab === option.id ? 'text-mmm-blue-700' : 'text-slate-500 hover:text-slate-700'}
          `}
        >
          {activeTab === option.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            {option.icon}
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};
