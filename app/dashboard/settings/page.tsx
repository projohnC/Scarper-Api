"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { ALL_PROVIDERS, type ProviderName } from "@/lib/provider-cache";
import { useIsMobile } from "@/hooks/use-mobile";
import { Settings, CheckCircle2, XCircle } from "lucide-react";

export default function SettingsPage() {
  const [enabledProviders, setEnabledProviders] = useState<ProviderName[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdultConfirm, setShowAdultConfirm] = useState(false);
  const [showProviderManagement, setShowProviderManagement] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: '', message: '' });
  const [errorDialog, setErrorDialog] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: '', message: '' });
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/providers/settings");
      if (res.ok) {
        const data = await res.json();
        setEnabledProviders(data.enabledProviders || []);
      }
    } catch (error) {
      console.error("Error fetching providers:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = (provider: ProviderName) => {
    if (provider === "Adult" && !enabledProviders.includes("Adult")) {
      setShowAdultConfirm(true);
      return;
    }
    
    setEnabledProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  };

  const handleAdultConfirm = () => {
    setEnabledProviders((prev) => [...prev, "Adult"]);
    setShowAdultConfirm(false);
  };

  const saveProviders = async () => {
    setSaving(true);
    try {
      const hasAdult = enabledProviders.includes("Adult");
      const res = await fetch("/api/providers/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          enabledProviders,
          adultConsent: hasAdult 
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setEnabledProviders(data.enabledProviders);
        setShowProviderManagement(false);
        setSuccessDialog({ show: true, title: 'Success!', message: 'Provider settings saved successfully.' });
      } else {
        setErrorDialog({ show: true, title: 'Error', message: 'Failed to save provider settings. Please try again.' });
      }
    } catch (error) {
      console.error("Error saving providers:", error);
      setErrorDialog({ show: true, title: 'Error', message: 'Failed to save provider settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };


  const providersList = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enable or disable content providers for API access
      </p>
      {!loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALL_PROVIDERS.map((provider) => (
            <div 
              key={provider} 
              className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                provider === "Adult" ? "border-red-500/50" : ""
              }`}
            >
              <div className="flex-1">
                <Label className="cursor-pointer font-medium flex items-center gap-2">
                  {provider}
                  {provider === "Adult" && (
                    <span className="text-xs text-red-500">(18+)</span>
                  )}
                </Label>
              </div>
              <Switch
                checked={enabledProviders.includes(provider)}
                onCheckedChange={() => toggleProvider(provider)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <Link 
            href="https://github.com/Anshu78780/ScarperApi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black dark:bg-zinc-900 border-2 border-zinc-800 dark:border-zinc-700 rounded-lg px-4 py-2 hover:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium text-white">Give Star ⭐</span>
          </Link>
        </div>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Providers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {enabledProviders.length} of {ALL_PROVIDERS.length} providers enabled
            </p>
          </div>
          <Button 
            onClick={() => setShowProviderManagement(true)}
            variant="outline"
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Manage Providers
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Request New Features</h2>
            <p className="text-sm text-muted-foreground">
              Want a new provider or feature? Join our Telegram channel to request!
            </p>
          </div>
          <Link
            href="https://t.me/ScreenScapee"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Join Telegram
            </Button>
          </Link>
        </div>
      </Card>

      {isMobile ? (
        <Drawer open={showProviderManagement} onOpenChange={setShowProviderManagement}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Manage Providers</DrawerTitle>
              <DrawerDescription>
                Enable or disable content providers for API access
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 max-h-[60vh] overflow-y-auto">
              {providersList}
            </div>
            <DrawerFooter>
              <Button onClick={saveProviders} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showProviderManagement} onOpenChange={setShowProviderManagement}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Providers</DialogTitle>
              <DialogDescription>
                Enable or disable content providers for API access
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {providersList}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowProviderManagement(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveProviders} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={showAdultConfirm} onOpenChange={setShowAdultConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adult Content Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you 18 years or older? By enabling this provider, you confirm that you are at least 18 years of age and agree to access adult content. This action will be logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdultConfirm} className="bg-red-600 hover:bg-red-700">
              Yes, I am 18+
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <Dialog open={successDialog.show} onOpenChange={(open) => setSuccessDialog({ ...successDialog, show: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {successDialog.title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {successDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessDialog({ show: false, title: '', message: '' })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={errorDialog.show} onOpenChange={(open) => setErrorDialog({ ...errorDialog, show: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {errorDialog.title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {errorDialog.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorDialog({ show: false, title: '', message: '' })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
