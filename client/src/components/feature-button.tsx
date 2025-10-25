import React from "react";
import { Italic } from "lucide-react";

interface FeatureButtonProps {
  icon: Italic;
  label: string;
  onClick?: () => void;
}

const FeatureButton: React.FC<FeatureButtonProps> = ({ icon: Icon, label, onClick }) => {
  return (
    <button
      className="feature-button flex flex-col items-center p-3 rounded-lg transition-all hover:transform hover:-translate-y-1"
      style={{ backgroundColor: 'rgba(45, 27, 105, 0.9)' }}
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-2 text-white">
        <Icon size={18} />
      </div>
      <span className="text-xs text-white">{label}</span>
    </button>
  );
};

export default FeatureButton;
