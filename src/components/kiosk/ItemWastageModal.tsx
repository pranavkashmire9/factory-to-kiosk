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

interface ItemWastageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kioskId: string;
  itemName: string;
  currentStock: number;
  onWastageAdded: () => void;
}

const ItemWastageModal = ({
  open,
  onOpenChange,
  kioskId,
  itemName,
  currentStock,
  onWastageAdded,
}: ItemWastageModalProps) => {
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!quantity || !reason) {
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

    if (wastageQty > currentStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${currentStock} units available`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Insert wastage record (without order_id since it's direct wastage)
      const { error: wastageError } = await supabase
        .from("wastage")
        .insert({
          kiosk_id: kioskId,
          order_id: "00000000-0000-0000-0000-000000000000", // Placeholder UUID for direct wastage
          item_name: itemName,
          quantity: wastageQty,
          reason: reason,
        });

      if (wastageError) throw wastageError;

      // Subtract from kiosk inventory
      const newStock = Math.max(0, currentStock - wastageQty);

      const { error: updateError } = await supabase
        .from("kiosk_inventory")
        .update({ 
          stock: newStock,
          status: newStock === 0 ? "Out of Stock" : newStock < 10 ? "Low Stock" : "In Stock"
        })
        .eq("kiosk_id", kioskId)
        .eq("item_name", itemName);

      if (updateError) throw updateError;

      toast({
        title: "Wastage Recorded",
        description: `${wastageQty} units of ${itemName} marked as wastage`,
      });

      onWastageAdded();
      onOpenChange(false);
      
      // Reset form
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
          <DialogTitle>Add Wastage - {itemName}</DialogTitle>
          <DialogDescription>
            Record wastage for this item
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantity (Available: {currentStock})</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={currentStock}
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

export default ItemWastageModal;
