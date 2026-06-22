import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, PlusCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { normalizeFiatPaymentProcessor } from "@/lib/payments/fiat-processor";
import {
  AdminGhostButton,
  AdminGradButton,
  adminInputClass,
  adminSelectTriggerClass,
  adminTextareaClass,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

interface PlatformSetting {
  key: string;
  value: string;
  description: string;
}

interface SettingControlProps {
  setting: PlatformSetting;
  onChange: (key: string, value: string) => void;
}

const SettingControl = ({ setting, onChange }: SettingControlProps) => {
  const [creditPackages, setCreditPackages] = useState<any[]>([]);
  const [algoWeights, setAlgoWeights] = useState<any>({});

  useEffect(() => {
    if (setting.key === "credit_packages") {
      try {
        setCreditPackages(JSON.parse(setting.value || "[]"));
      } catch {
        setCreditPackages([]);
      }
    }
    if (setting.key === "algorithm_weights") {
      try {
        setAlgoWeights(JSON.parse(setting.value || "{}"));
      } catch {
        setAlgoWeights({});
      }
    }
  }, [setting.key, setting.value]);

  const handlePackageChange = (index: number, field: string, value: any) => {
    const updated = [...creditPackages];
    updated[index][field] = parseInt(value, 10) || 0;
    setCreditPackages(updated);
    onChange(setting.key, JSON.stringify(updated));
  };

  const addPackage = () => {
    const updated = [...creditPackages, { amount: 0, price_cents: 0 }];
    setCreditPackages(updated);
    onChange(setting.key, JSON.stringify(updated));
  };

  const removePackage = (index: number) => {
    const updated = creditPackages.filter((_, i) => i !== index);
    setCreditPackages(updated);
    onChange(setting.key, JSON.stringify(updated));
  };

  const handleWeightChange = (key: string, value: any) => {
    const updated = { ...algoWeights, [key]: parseFloat(value) || 0 };
    setAlgoWeights(updated);
    onChange(setting.key, JSON.stringify(updated));
  };

  switch (setting.key) {
    case "active_payment_provider":
    case "fiat_payment_processor":
      return (
        <Select
          value={normalizeFiatPaymentProcessor(setting.value)}
          onValueChange={(value) => onChange(setting.key, value)}
        >
          <SelectTrigger className={cn('w-full max-w-xs', adminSelectTriggerClass)}>
            <SelectValue placeholder="Select processor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onyx">Onyx</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="moonpay">MoonPay</SelectItem>
            <SelectItem value="epoch">Epoch</SelectItem>
            <SelectItem value="goat">GOAT Payments</SelectItem>
            <SelectItem value="uspaymate">USPaymate</SelectItem>
          </SelectContent>
        </Select>
      );

    case "credit_packages":
      return (
        <div className="space-y-4">
          {creditPackages.map((pkg, index) => (
            <div key={index} className="flex items-end gap-4 p-3 admin-card rounded-2xl">
              <div className="flex-1 space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={pkg.amount}
                  onChange={(e) =>
                    handlePackageChange(index, "amount", e.target.value)
                  }
                  className={adminInputClass}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Price (Cents)</Label>
                <Input
                  type="number"
                  value={pkg.price_cents}
                  onChange={(e) =>
                    handlePackageChange(index, "price_cents", e.target.value)
                  }
                  className={adminInputClass}
                />
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removePackage(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <AdminGhostButton onClick={addPackage}>
            <PlusCircle className="h-4 w-4" />
            Add package
          </AdminGhostButton>
        </div>
      );
    
    case "algorithm_weights":
      return (
        <div className="space-y-4">
            {Object.entries(algoWeights).map(([key, value]) => (
                <div key={key} className="flex items-center gap-4">
                    <Label className="w-24 capitalize">{key}</Label>
                    <Input 
                        type="number"
                        value={value as number}
                        onChange={(e) => handleWeightChange(key, e.target.value)}
                        className={cn('w-40', adminInputClass)}
                    />
                </div>
            ))}
        </div>
      );

    case "platform_split":
    case "platform_split_content":
    case "platform_split_ai":
    case "platform_split_store":
    case "price_per_credit":
    case "call_credit_interval":
    case "suggestion_timeframe":
    case "image_gen_credit_cost":
      return (
        <Input
          id={setting.key}
          type="number"
          value={setting.value}
          onChange={(e) => onChange(setting.key, e.target.value)}
          className={cn('w-40', adminInputClass)}
        />
      );

    case "prompt_prefix":
      return (
        <Textarea
          id={setting.key}
          value={setting.value}
          onChange={(e) => onChange(setting.key, e.target.value)}
          rows={5}
          className={adminTextareaClass}
        />
      );

    case "credit_only_ecosystem":
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={setting.key}
            checked={setting.value === "true"}
            onCheckedChange={(checked) => onChange(setting.key, checked.toString())}
          />
          <Label htmlFor={setting.key}>Credit-only ecosystem (PPV, subs, tips, marketplace)</Label>
        </div>
      );

    case "affiliate_require_kyc":
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={setting.key}
            checked={setting.value === "true"}
            onCheckedChange={(checked) => onChange(setting.key, checked.toString())}
          />
          <Label htmlFor={setting.key}>Require KYC for affiliate applications</Label>
        </div>
      );

    case "referral_credit_amount":
      return (
        <Input
          id={setting.key}
          type="number"
          value={setting.value}
          onChange={(e) => onChange(setting.key, e.target.value)}
          className={cn('w-40', adminInputClass)}
        />
      );

    default:
      if (setting.key.includes("enabled")) {
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={setting.key}
              checked={setting.value === "true"}
              onCheckedChange={(checked) =>
                onChange(setting.key, checked.toString())
              }
            />
            <Label htmlFor={setting.key}>Enabled</Label>
          </div>
        );
      }
      return (
        <Textarea
          id={setting.key}
          value={setting.value}
          onChange={(e) => onChange(setting.key, e.target.value)}
          rows={3}
          className={adminTextareaClass}
        />
      );
  }
};

export default SettingControl; 