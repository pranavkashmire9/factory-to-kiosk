import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface WastageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  kioskId: string;
  items: Array<{ name: string; quantity: number }>;
  onWastageAdded: () => void;
}

const WastageModal = ({
  open,
  onOpenChange,
  orderId,
  kioskId,
  items,
  onWastageAdded,
}: WastageModalProps) => {
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedItem || !quantity || !reason) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const wastageQty = parseInt(quantity);
    if (wastageQty <= 0 || isNaN(wastageQty)) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Insert wastage record
      const { error: wastageError } = await supabase
        .from("wastage")
        .insert({
          kiosk_id: kioskId,
          order_id: orderId,
          item_name: selectedItem,
          quantity: wastageQty,
          reason: reason,
        });

      if (wastageError) throw wastageError;

      // Subtract from kiosk inventory
      const { data: currentStock, error: fetchError } = await supabase
        .from("kiosk_inventory")
        .select("stock")
        .eq("kiosk_id", kioskId)
        .eq("item_name", selectedItem)
        .single();

      if (fetchError) throw fetchError;

      const newStock = Math.max(0, currentStock.stock - wastageQty);

      const { error: updateError } = await supabase
        .from("kiosk_inventory")
        .update({ stock: newStock })
        .eq("kiosk_id", kioskId)
        .eq("item_name", selectedItem);

      if (updateError) throw updateError;

      toast({
        title: "Wastage Recorded",
        description: `${wastageQty} units of ${selectedItem} marked as wastage`,
      });

      onWastageAdded();
      onOpenChange(false);
      
      // Reset form
      setSelectedItem("");
      setQuantity("");
      setReason("");
    } catch (error: any) {
      console.error("Error recording wastage:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record wastage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Wastage</DialogTitle>
          <DialogDescription>
            Record wastage for items in this order
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="item">Item</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger id="item">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item, idx) => (
                  <SelectItem key={idx} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity wasted"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Broken">Broken</SelectItem>
                <SelectItem value="Bad Quality">Bad Quality</SelectItem>
                <SelectItem value="Something Else">Something Else</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Wastage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WastageModal;
