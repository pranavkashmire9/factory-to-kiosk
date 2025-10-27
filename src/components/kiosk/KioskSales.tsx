import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface KioskSalesProps {
  kioskId: string;
  onOrderComplete: () => void;
}

const KioskSales = ({ kioskId, onOrderComplete }: KioskSalesProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [currentOrder, setCurrentOrder] = useState<any[]>([]);
  const [paymentType, setPaymentType] = useState<"Cash" | "UPI">("Cash");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
    setupRealtimeSubscription();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("kiosk_inventory")
      .select("*")
      .eq("kiosk_id", kioskId)
      .order("item_name");

    if (error) {
      toast.error("Error fetching items");
      console.error(error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('kiosk-inventory-sales')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_inventory', filter: `kiosk_id=eq.${kioskId}` },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const addToOrder = (item: any) => {
    if (item.stock === 0) {
      toast.error("Item out of stock");
      return;
    }

    const existingItem = currentOrder.find(orderItem => orderItem.id === item.id);
    
    if (existingItem) {
      if (existingItem.quantity >= item.stock) {
        toast.error("Cannot add more than available stock");
        return;
      }
      setCurrentOrder(currentOrder.map(orderItem =>
        orderItem.id === item.id
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ));
    } else {
      setCurrentOrder([...currentOrder, { ...item, quantity: 1 }]);
    }
  };

  const removeFromOrder = (itemId: string) => {
    const item = currentOrder.find(orderItem => orderItem.id === itemId);
    if (item && item.quantity > 1) {
      setCurrentOrder(currentOrder.map(orderItem =>
        orderItem.id === itemId
          ? { ...orderItem, quantity: orderItem.quantity - 1 }
          : orderItem
      ));
    } else {
      setCurrentOrder(currentOrder.filter(orderItem => orderItem.id !== itemId));
    }
  };

  const getTotalPrice = () => {
    return currentOrder.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  };

  const handlePlaceOrder = async () => {
    if (currentOrder.length === 0) {
      toast.error("Add items to order first");
      return;
    }

    const total = getTotalPrice();
    const orderItems = currentOrder.map(item => ({
      id: item.id,
      name: item.item_name,
      quantity: item.quantity,
      price: Number(item.price),
    }));

    // Create order
    const { error: orderError } = await supabase
      .from("orders")
      .insert({
        kiosk_id: kioskId,
        items: orderItems,
        total,
        payment_type: paymentType,
      });

    if (orderError) {
      toast.error("Error placing order");
      console.error(orderError);
      return;
    }

    // Update inventory stocks
    for (const item of currentOrder) {
      const newStock = item.stock - item.quantity;
      const { error } = await supabase
        .from("kiosk_inventory")
        .update({ 
          stock: newStock,
          status: newStock === 0 ? "Out of Stock" : newStock < 10 ? "Low Stock" : "In Stock"
        })
        .eq("id", item.id);

      if (error) {
        console.error("Error updating stock:", error);
      }

      // Auto-create purchase order if stock < 10
      if (newStock < 10) {
        const { error: poError } = await supabase
          .from("purchase_orders")
          .insert({
            kiosk_id: kioskId,
            items: [{ name: item.item_name, quantity: 50 - newStock }],
            status: "Preparing"
          });

        if (poError) {
          console.error("Error creating purchase order:", poError);
        }
      }
    }

    toast.success("Order placed successfully!");
    setCurrentOrder([]);
    fetchItems();
    onOrderComplete();
  };

  const getStatusBadge = (item: any) => {
    if (item.stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (item.stock < 10) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge>In Stock</Badge>;
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Available Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell>{item.stock}</TableCell>
                  <TableCell>₹{Number(item.price).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(item)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => addToOrder(item)}
                      disabled={item.stock === 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Current Order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentOrder.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No items in order
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {currentOrder.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-secondary rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-muted-foreground">
                        ₹{Number(item.price).toFixed(2)} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeFromOrder(item.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-bold">₹{(Number(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{getTotalPrice().toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <Label>Payment Type</Label>
                  <RadioGroup value={paymentType} onValueChange={(value) => setPaymentType(value as "Cash" | "UPI")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Cash" id="cash" />
                      <Label htmlFor="cash" className="cursor-pointer">Cash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="UPI" id="upi" />
                      <Label htmlFor="upi" className="cursor-pointer">UPI</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handlePlaceOrder} className="w-full">
                  Place Order
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KioskSales;
