
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import BatchClassificationForm from "@/components/BatchClassificationForm";
import KeywordExclusionManager from "@/components/KeywordExclusionManager";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { isOpenAIInitialized } from "@/lib/openai/client";

const Index = () => {
  const [classificationResults, setClassificationResults] = useState<PayeeClassification[]>([]);
  const [lastProcessingSummary, setLastProcessingSummary] = useState<BatchProcessingResult | null>(null);
  const [isApiKeySet, setIsApiKeySet] = useState(isOpenAIInitialized());

  const handleClassificationComplete = (results: PayeeClassification[], summary?: BatchProcessingResult) => {
    setClassificationResults(results);
    if (summary) {
      setLastProcessingSummary(summary);
    }
  };

  const handleApiKeyChange = () => {
    setIsApiKeySet(isOpenAIInitialized());
  };

  const handleApiKeySet = () => {
    setIsApiKeySet(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Payee Classification</h1>
            <p className="text-muted-foreground">AI-powered batch processing with keyword exclusions</p>
          </div>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="classification" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="classification">Batch Classification</TabsTrigger>
            <TabsTrigger value="keywords">Keyword Exclusions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="classification" className="mt-6">
            <BatchClassificationForm 
              onComplete={handleClassificationComplete}
              onApiKeySet={handleApiKeySet}
              onApiKeyChange={handleApiKeyChange}
            />
          </TabsContent>
          
          <TabsContent value="keywords" className="mt-6">
            <KeywordExclusionManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
