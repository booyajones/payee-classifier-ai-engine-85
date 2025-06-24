
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { storageService } from "@/services/storageService";

interface StorageStatusIndicatorProps {
  storageStatus: 'localStorage' | 'memory' | 'error';
  isUsingFallback: boolean;
}

const StorageStatusIndicator = ({ storageStatus, isUsingFallback }: StorageStatusIndicatorProps) => {
  if (storageStatus === 'localStorage' && !isUsingFallback) {
    return null;
  }

  const handleClearStorage = () => {
    if (confirm('This will clear all stored data except user preferences. Are you sure?')) {
      storageService.clear();
      window.location.reload();
    }
  };

  const currentSize = storageService.getSize();
  const usagePercent = (currentSize / (4 * 1024 * 1024)) * 100;

  return (
    <Alert className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          {isUsingFallback ? (
            <>
              <strong>Storage Limited:</strong> Using temporary memory storage. 
              Data may be lost on page refresh. ({usagePercent.toFixed(1)}% storage used)
            </>
          ) : (
            <>
              <strong>Storage Warning:</strong> Browser storage is nearly full ({usagePercent.toFixed(1)}% used).
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearStorage}
          className="ml-4"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear Storage
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default StorageStatusIndicator;
