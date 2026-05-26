import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, Delete } from 'lucide-react';
import { cn } from '../lib/utils';

interface LockScreenProps {
  savedPassword: string;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ savedPassword, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === savedPassword.length) {
      if (pin === savedPassword) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setPin(''), 500);
      }
    }
  }, [pin, savedPassword, onUnlock]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-primary)]/80 backdrop-blur-2xl"
    >
      <div className="max-w-xs w-full flex flex-col items-center">
        <motion.div
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="mb-8 flex flex-col items-center"
        >
          <div className={cn(
            "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-500",
            error ? "bg-[var(--danger)]/20 text-[var(--danger)] shadow-[0_0_30px_rgba(239,68,68,0.3)]" : "bg-[var(--accent)]/10 text-[var(--accent)] shadow-[0_0_30px_rgba(0,242,255,0.2)]"
          )}>
            {pin.length === savedPassword.length && pin === savedPassword ? <Unlock size={36} /> : <Lock size={36} />}
          </div>
          <h1 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Z-Money</h1>
          <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.3em] font-bold mt-2">加密資產保護中</p>
        </motion.div>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-12">
          {Array.from({ length: savedPassword.length }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-3 h-3 rounded-full border-2 transition-all duration-300",
                pin.length > i 
                  ? "bg-[var(--accent)] border-[var(--accent)] scale-125 shadow-[0_0_10px_var(--accent)]" 
                  : "border-[var(--border)]"
              )}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-xl font-bold hover:bg-[var(--bg-tertiary)] active:scale-90 transition-all text-[var(--text-main)]"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-xl font-bold hover:bg-[var(--bg-tertiary)] active:scale-90 transition-all text-[var(--text-main)]"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-2xl bg-transparent flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--danger)] active:scale-90 transition-all"
          >
            <Delete size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
