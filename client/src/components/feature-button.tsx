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
      className="feature-button flex flex-col items-center p-3 bg-white rounded-lg transition-all hover:transform hover:-translate-y-1"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-lg bg-blue flex items-center justify-center mb-2 text-blue">
        <Icon size={18} />
      </div>
      <span className="text-xs text-black">{label}</span>
    </button>
  );
};

export default FeatureButton;
