"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export default function SettingsPage() {
  const [enabledProviders, setEnabledProviders] = useState<ProviderName[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdultConfirm, setShowAdultConfirm] = useState(false);

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
        alert("Provider settings saved successfully");
      } else {
        alert("Failed to save provider settings");
      }
    } catch (error) {
      console.error("Error saving providers:", error);
      alert("Failed to save provider settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Providers</h2>
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
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={saveProviders} disabled={saving}>
              {saving ? "Saving..." : "Save Provider Settings"}
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={showAdultConfirm} onOpenChange={setShowAdultConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adult Content Confirmation</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold">Are you 18 years or older?</p>
              <p className="text-sm">
                By enabling this provider, you confirm that you are at least 18 years of age 
                and agree to access adult content. This action will be logged.
              </p>
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
    </div>
  );
}
