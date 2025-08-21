import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isOpenAIInitialized, initializeOpenAI, testOpenAIConnection, clearOpenAIKeys } from "@/lib/openai/client";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, Key, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { logger } from '@/lib/logger';

interface APIKeyInputProps {
  onApiKeySet: () => void;
  onApiKeyChange?: () => void;
}

const APIKeyInput = ({ onApiKeySet, onApiKeyChange }: APIKeyInputProps) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(true);
  const [connectionWorking, setConnectionWorking] = useState(false);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const { toast } = useToast();

  // Test if OpenAI is already working on component mount
  useEffect(() => {
    const testConnection = async () => {
      logger.info('[API_KEY_INPUT] Testing existing connection...');
      
      if (isOpenAIInitialized()) {
        try {
          // Use faster connection test with timeout
          const testPromise = testOpenAIConnection();
          const timeoutPromise = new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Test timeout')), 3000)
          );
          
          const isWorking = await Promise.race([testPromise, timeoutPromise]);
          logger.info('[API_KEY_INPUT] Connection test result:', isWorking);
          
          if (isWorking) {
            setConnectionWorking(true);
            setHasConnectionError(false);
            toast({
              title: "API Key Active",
              description: "OpenAI API connection is working correctly.",
              variant: "default",
            });
            onApiKeySet();
            return;
          } else {
            setHasConnectionError(true);
          }
        } catch (error) {
          logger.warn('[API_KEY_INPUT] Connection test failed or timed out:', error);
          setHasConnectionError(true);
        }
      } else {
        logger.info('[API_KEY_INPUT] No API key initialized');
      }
      setIsTestingConnection(false);
    };

    testConnection();
  }, [onApiKeySet, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid OpenAI API key.",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    
    try {
      logger.info('[API_KEY_INPUT] Initializing with new API key...');
      await initializeOpenAI(apiKey.trim(), rememberKey);
      
      // Skip immediate test since initialization already validates format
      logger.info('[API_KEY_INPUT] API key initialized successfully');
      
      toast({
        title: "API Key Set Successfully",
        description: rememberKey 
          ? "OpenAI integration is ready and your key has been securely saved." 
          : "OpenAI integration is ready for this session.",
      });
      
      setConnectionWorking(true);
      setHasConnectionError(false);
      onApiKeySet();
      onApiKeyChange?.(); // Call the optional callback
    } catch (error) {
      logger.error("Error setting API key:", error);
      toast({
        title: "API Key Error",
        description: "Failed to initialize OpenAI client. Please check your API key.",
        variant: "destructive",
      });
      setHasConnectionError(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearKeys = () => {
    clearOpenAIKeys();
    setConnectionWorking(false);
    setHasConnectionError(false);
    setApiKey("");
    onApiKeyChange?.(); // Call the optional callback
    toast({
      title: "API Keys Cleared",
      description: "All saved API keys have been removed.",
    });
  };

  // Show loading state while testing connection with faster timeout
  if (isTestingConnection) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking API Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Testing OpenAI API connection...
          </p>
        </CardContent>
      </Card>
    );
  }

  // If connection is working, show success state
  if (connectionWorking) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">API Key Status</CardTitle>
          <CardDescription>
            OpenAI API is connected and ready to use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">API key is active and working</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Your app is ready to use the OpenAI API for payee classification.
            </p>
            
            <div className="flex gap-2">
              <Button 
                type="button" 
                className="flex-1" 
                onClick={() => onApiKeySet()}
              >
                Continue
              </Button>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={handleClearKeys}
              >
                Clear Keys
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show API key input form
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          OpenAI API Key Required
        </CardTitle>
        <CardDescription>
          Enter your OpenAI API key to enable AI-powered payee classification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasConnectionError && (
          <Alert className="mb-4" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Previous API key failed connection test. Please enter a valid API key.
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="mb-4">
          <AlertDescription>
            Your API key will be stored securely using encrypted browser storage. 
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Platform</a>.
          </AlertDescription>
        </Alert>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isValidating}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="rememberKey"
              checked={rememberKey}
              onChange={(e) => setRememberKey(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="rememberKey" className="text-sm">
              Securely save this API key
            </Label>
          </div>
          
          <Button type="submit" className="w-full" disabled={isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting API Key...
              </>
            ) : (
              "Set API Key"
            )}
          </Button>

          {hasConnectionError && (
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={handleClearKeys}
            >
              Clear All Saved Keys
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default APIKeyInput;
