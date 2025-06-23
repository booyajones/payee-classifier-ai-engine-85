
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import BatchClassificationForm from "@/components/BatchClassificationForm";
import KeywordExclusionManager from "@/components/KeywordExclusionManager";
import LiveProgressDashboard from "@/components/LiveProgressDashboard";
import ProcessingHistory from "@/components/ProcessingHistory";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { isOpenAIInitialized } from "@/lib/openai/client";
import { ProcessingProvider } from "@/contexts/ProcessingContext";
import { StoredBatchResult } from "@/lib/storage/resultStorage";
import ErrorBoundary from "@/components/ErrorBoundary";

const Index = () => {
  console.log('[INDEX] Index page rendering...');
  
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

  const handleHistoryResultSelect = (result: StoredBatchResult) => {
    setClassificationResults(result.classifications);
    setLastProcessingSummary(result.summary);
  };

  return (
    <ErrorBoundary>
      <ProcessingProvider>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-8 px-4 max-w-6xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold">Payee Classification</h1>
                <p className="text-muted-foreground">AI-powered batch processing with keyword exclusions</p>
              </div>
              <ThemeToggle />
            </div>

            <ErrorBoundary context="Live Progress Dashboard">
              <LiveProgressDashboard />
            </ErrorBoundary>

            <Tabs defaultValue="classification" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="classification">Batch Classification</TabsTrigger>
                <TabsTrigger value="keywords">Keyword Exclusions</TabsTrigger>
                <TabsTrigger value="history">Processing History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="classification" className="mt-6">
                <ErrorBoundary context="Batch Classification">
                  <BatchClassificationForm 
                    onComplete={handleClassificationComplete}
                    onApiKeySet={handleApiKeySet}
                    onApiKeyChange={handleApiKeyChange}
                  />
                </ErrorBoundary>
              </TabsContent>
              
              <TabsContent value="keywords" className="mt-6">
                <ErrorBoundary context="Keyword Exclusions">
                  <KeywordExclusionManager />
                </ErrorBoundary>
              </TabsContent>
              
              <TabsContent value="history" className="mt-6">
                <ErrorBoundary context="Processing History">
                  <ProcessingHistory onResultSelect={handleHistoryResultSelect} />
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </ProcessingProvider>
    </ErrorBoundary>
  );
};

export default Index;
