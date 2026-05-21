import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Presentation, Check } from 'lucide-react';

interface RoleSelectionProps {
  selectedRole: 'student' | 'instructor' | null;
  onSelect: (role: 'student' | 'instructor') => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ selectedRole, onSelect }) => {
  const roles = [
    {
      id: 'student' as const,
      title: 'Student',
      description: 'I want to learn and complete activities',
      icon: GraduationCap,
      color: '#7c6bf0',
    },
    {
      id: 'instructor' as const,
      title: 'Instructor',
      description: 'I want to teach and create activities',
      icon: Presentation,
      color: '#6dd49e',
    },
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      {roles.map((role) => {
        const Icon = role.icon;
        const isSelected = selectedRole === role.id;

        return (
          <motion.div
            key={role.id}
            whileHover={{ scale: 1.02, translateY: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(role.id)}
            className={`relative flex items-center gap-5 p-5 rounded-[20px] cursor-pointer transition-all duration-300 border-2 ${
              isSelected
                ? 'bg-white/[0.08] border-[#7c6bf0] shadow-[0_0_20px_rgba(124,107,240,0.2)]'
                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                isSelected ? 'bg-[#7c6bf0]' : 'bg-white/5'
              }`}
            >
              <Icon size={28} className={isSelected ? 'text-white' : 'text-[#a0a4b8]'} />
            </div>

            <div className="flex-1">
              <h3 className={`text-[17px] font-bold mb-1 ${isSelected ? 'text-white' : 'text-[#e8eaf0]'}`}>
                {role.title}
              </h3>
              <p className="text-[13.5px] text-[#a0a4b8] leading-tight">
                {role.description}
              </p>
            </div>

            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-4 right-4 w-6 h-6 bg-[#7c6bf0] rounded-full flex items-center justify-center shadow-lg"
              >
                <Check size={14} className="text-white" />
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
