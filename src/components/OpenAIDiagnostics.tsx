
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wrench, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import {
  getOpenAIClientDiagnostics,
  testOpenAIConnection,
  clearOpenAIKeys,
  isOpenAIInitialized
} from "@/lib/openai/client";
import { getApiKeyDiagnostics, clearAllApiKeys } from "@/lib/backend/apiKeyService";
import { logger } from '@/lib/logger';

interface OpenAIDiagnosticsProps {
  onReset?: () => void;
}

const OpenAIDiagnostics = ({ onReset }: OpenAIDiagnosticsProps) => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [connectionTest, setConnectionTest] = useState<boolean | null>(null);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      logger.info('[DIAGNOSTICS] Running OpenAI diagnostics...');
      
      const clientDiagnostics = getOpenAIClientDiagnostics();
      const storageDiagnostics = getApiKeyDiagnostics();
      const isInitialized = isOpenAIInitialized();
      
      logger.info('[DIAGNOSTICS] Client diagnostics:', clientDiagnostics);
      logger.info('[DIAGNOSTICS] Storage diagnostics:', storageDiagnostics);
      logger.info('[DIAGNOSTICS] Is initialized:', isInitialized);
      
      // Test connection if client appears to be initialized
      let connectionResult = null;
      if (isInitialized) {
        try {
          connectionResult = await testOpenAIConnection();
          logger.info('[DIAGNOSTICS] Connection test result:', connectionResult);
        } catch (error) {
          logger.error('[DIAGNOSTICS] Connection test error:', error);
          connectionResult = false;
        }
      }
      
      setDiagnostics({
        client: clientDiagnostics,
        storage: storageDiagnostics,
        isInitialized,
        timestamp: new Date().toISOString()
      });
      
      setConnectionTest(connectionResult);
      
      toast({
        title: "Diagnostics Complete",
        description: "OpenAI client diagnostics have been updated.",
      });
      
    } catch (error) {
      logger.error('[DIAGNOSTICS] Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: "Failed to run diagnostics. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearAll = () => {
    logger.info('[DIAGNOSTICS] Clearing all OpenAI data...');
    clearOpenAIKeys();
    clearAllApiKeys();
    setDiagnostics(null);
    setConnectionTest(null);
    
    toast({
      title: "Data Cleared",
      description: "All OpenAI client data has been cleared. Please set your API key again.",
    });
    
    onReset?.();
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (status: boolean | null, trueText: string, falseText: string, nullText: string = "Unknown") => {
    if (status === true) return <Badge variant="secondary" className="bg-green-100 text-green-800">{trueText}</Badge>;
    if (status === false) return <Badge variant="secondary" className="bg-red-100 text-red-800">{falseText}</Badge>;
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{nullText}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          OpenAI Client Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              "Run Diagnostics"
            )}
          </Button>
          
          <Button onClick={handleClearAll} variant="destructive">
            Clear All Data
          </Button>
        </div>

        {diagnostics && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Diagnostics run at: {new Date(diagnostics.timestamp).toLocaleString()}
              </AlertDescription>
            </Alert>

            {/* Show encryption key warning if missing */}
            {!diagnostics.storage.hasEncryptionKey && diagnostics.storage.tokenCount > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Encryption Key Missing:</strong> {diagnostics.storage.encryptionKeyStatus}. 
                  Stored API keys cannot be decrypted. Click "Clear All Data" to reset and re-enter your API key.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Client Status</h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Initialized</span>
                    {getStatusBadge(diagnostics.isInitialized, "Yes", "No")}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">In Memory</span>
                    {getStatusBadge(diagnostics.client.isInitialized, "Yes", "No")}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Has Token</span>
                    {getStatusBadge(diagnostics.client.hasCurrentToken, "Yes", "No")}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connection</span>
                    {getStatusBadge(connectionTest, "Working", "Failed", "Not Tested")}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Storage Status</h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Token Map</span>
                    {getStatusBadge(diagnostics.storage.hasTokenMap, "Exists", "Missing")}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Stored Keys</span>
                    <Badge variant="outline">{diagnostics.storage.tokenCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Encryption Key</span>
                    {getStatusBadge(diagnostics.storage.hasEncryptionKey, "Ready", "Missing")}
                  </div>
                  {diagnostics.storage.encryptionKeyStatus && (
                    <div className="text-xs text-muted-foreground">
                      Status: {diagnostics.storage.encryptionKeyStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {diagnostics.storage.tokens.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Stored Tokens (last 8 chars)</h4>
                <div className="flex flex-wrap gap-1">
                  {diagnostics.storage.tokens.map((token: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      ...{token}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {connectionTest === false && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Connection test failed. The API key may be invalid or there may be a network issue.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenAIDiagnostics;
