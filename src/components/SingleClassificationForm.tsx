
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { enhancedClassifyPayeeV3 } from "@/lib/classification/enhancedClassificationV3";
import { createPayeeClassification } from "@/lib/utils";
import ClassificationResultCard from "./ClassificationResultCard";
import { PayeeClassification, ClassificationConfig } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { logger } from '@/lib/logger';

interface SingleClassificationFormProps {
  onComplete?: (results: PayeeClassification[], summary?: any) => void;
}

const SingleClassificationForm = ({ onComplete }: SingleClassificationFormProps) => {
  const [payeeName, setPayeeName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<PayeeClassification | null>(null);
  const [config, setConfig] = useState<ClassificationConfig>({
    aiThreshold: 80,
    bypassRuleNLP: true,
    useEnhanced: true,
    offlineMode: false
  });
  const { toast } = useToast();

  const resetForm = () => {
    setPayeeName("");
    setCurrentResult(null);
    
    toast({
      title: "Form Reset",
      description: "The classification form has been reset. You can now start over.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!payeeName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a payee name to classify.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      logger.info(`Starting V3 classification for: ${payeeName}`);
      
      // Use V3 classification with intelligent escalation
      const result = await enhancedClassifyPayeeV3(payeeName, config);
      const classification = createPayeeClassification(payeeName, result);
      
      logger.info(`V3 Classification result:`, result);
      
      setCurrentResult(classification);
      
      // Call onComplete if provided
      if (onComplete) {
        onComplete([classification]);
      }
      
      toast({
        title: "Classification Complete",
        description: `${payeeName} classified as ${result.classification} with ${result.confidence}% confidence using V3 intelligent escalation.`,
      });
    } catch (error) {
      logger.error("V3 Classification error:", error);
      toast({
        title: "Classification Error",
        description: error instanceof Error ? error.message : "An error occurred while processing your request.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle AI threshold change
  const handleThresholdChange = (value: number[]) => {
    setConfig(prev => ({ ...prev, aiThreshold: value[0] }));
  };

  const handleOfflineModeChange = (checked: boolean) => {
    setConfig(prev => ({ ...prev, offlineMode: checked }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classify Single Payee (V3)</CardTitle>
        <CardDescription>
          Enter a payee name to classify it using the advanced V3 classification system with intelligent escalation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Input
                id="payeeName"
                placeholder="Enter payee name (e.g., John Smith, Acme Corporation)"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>
          
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-md font-medium">V3 Classification Settings</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="aiThreshold">AI Confidence Threshold: {config.aiThreshold}%</Label>
                </div>
                <Slider
                  id="aiThreshold"
                  min={50}
                  max={95}
                  step={5}
                  value={[config.aiThreshold]}
                  onValueChange={handleThresholdChange}
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">
                  Threshold for escalating to AI classification
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="offlineMode"
                  checked={config.offlineMode}
                  onCheckedChange={handleOfflineModeChange}
                  disabled={isProcessing}
                />
                <Label htmlFor="offlineMode">Offline Mode (No AI/Web Search)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                V3 uses intelligent escalation: Rule-Based → Fuzzy Matching → AI → Web Search Enhanced AI
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isProcessing}>
              {isProcessing ? "Classifying..." : "Classify with V3"}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={isProcessing}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </div>
        </form>

        {currentResult && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">V3 Classification Result</h3>
            <ClassificationResultCard result={currentResult} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SingleClassificationForm;
