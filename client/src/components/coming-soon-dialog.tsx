import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

interface ComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}

const ComingSoonDialog: React.FC<ComingSoonDialogProps> = ({
  open,
  onOpenChange,
  title,
}) => {
  const { t } = useLanguage();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-black border-gray-200 max-w-md w-[90%]">
        <DialogHeader>
          <DialogTitle className="text-black text-center">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4 py-6">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-[#4F9CF9]" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-black">{t('common.comingSoon')}</h3>
            <p className="text-sm text-gray-600">
              {t('common.featureUnderDevelopment')}
            </p>
          </div>

          <Button
            className="w-full bg-[#4F9CF9] hover:bg-[#E0B83C] text-black"
            onClick={() => onOpenChange(false)}
          >
            {t('common.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComingSoonDialog;
