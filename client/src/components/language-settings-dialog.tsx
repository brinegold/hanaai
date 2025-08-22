import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LanguageSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const languages: Language[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
];

const LanguageSettingsDialog: React.FC<LanguageSettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem("selectedLanguage") || "en";
  });

  const handleLanguageSelect = (languageCode: string) => {
    setCurrentLanguage(languageCode);
    localStorage.setItem("selectedLanguage", languageCode);
    
    // Store language preference in localStorage for persistence
    const selectedLang = languages.find(lang => lang.code === languageCode);
    
    toast({
      title: "Language Changed",
      description: `Language switched to ${selectedLang?.name}`,
    });

    // In a real implementation, you would trigger a language change event
    // that updates all text throughout the application
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: languageCode } 
    }));
  };

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your language preference has been saved",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-black border-gray-200 max-w-md w-[90%] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#4F9CF9]" />
            Language Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Select your preferred language for the website
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageSelect(language.code)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  currentLanguage === language.code
                    ? "border-[#4F9CF9] bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{language.flag}</span>
                  <div className="text-left">
                    <div className="font-medium text-black">{language.name}</div>
                    <div className="text-sm text-gray-500">{language.nativeName}</div>
                  </div>
                </div>
                {currentLanguage === language.code && (
                  <Check className="h-5 w-5 text-[#4F9CF9]" />
                )}
              </button>
            ))}
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Language changes will take effect immediately. 
              Some content may require a page refresh to fully update.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
              onClick={handleSave}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LanguageSettingsDialog;
