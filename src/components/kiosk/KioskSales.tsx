import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface KioskSalesProps {
  kioskId: string;
  onOrderComplete: () => void;
}

// Predefined menu items that should always be visible
const PREDEFINED_ITEMS = [
  { name: "Pani Puri", price: 40 },
  { name: "Shev Puri (J)", price: 60 },
  { name: "Bhel Puri (J)", price: 50 },
  { name: "Dry Masala Puri", price: 40 },
  { name: "Ragda Pattice", price: 60 },
  { name: "Ragda Samosa", price: 50 },
  { name: "Samosa Chaat", price: 50 },
  { name: "Dahi Shev Puri (J)", price: 70 },
  { name: "Dahi Aloo Chaat", price: 50 },
  { name: "Dahi Bhel Puri (J)", price: 70 },
  { name: "Tokri Chaat", price: 80 },
  { name: "Basket Chaat", price: 80 },
  { name: "Papdi Chaat", price: 70 },
  { name: "Cheese Bhel (J)", price: 100 },
  { name: "Cheese Shev Puri (J)", price: 100 },
  { name: "Dahi Wada (J)", price: 70 },
  { name: "Veg Sandwich", price: 50 },
  { name: "Veg Cheese Sandwich", price: 70 },
  { name: "Veg Cheese Grill Sandwich", price: 100 },
  { name: "Veg Grill Sandwich", price: 70 },
  { name: "Chocolate Sandwich", price: 80 },
  { name: "Chocolate Cheese Sandwich", price: 100 },
  { name: "Cheese Chilly Toast", price: 90 },
];

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
      setLoading(false);
      return;
    }

    // Merge predefined items with database inventory
    const dbInventory = data || [];
    const mergedItems = PREDEFINED_ITEMS.map((predefinedItem) => {
      // Check if item exists in database
      const dbItem = dbInventory.find(
        (item) => item.item_name.toLowerCase() === predefinedItem.name.toLowerCase()
      );

      if (dbItem) {
        // Use database values if item exists
        return dbItem;
      } else {
        // Create a placeholder item with predefined values
        return {
          id: `placeholder-${predefinedItem.name}`,
          item_name: predefinedItem.name,
          stock: 0,
          price: predefinedItem.price,
          status: "Out of Stock",
          kiosk_id: kioskId,
        };
      }
    });

    // Also include any items from database that are not in predefined list
    const extraItems = dbInventory.filter(
      (dbItem) =>
        !PREDEFINED_ITEMS.some(
          (predefined) =>
            predefined.name.toLowerCase() === dbItem.item_name.toLowerCase()
        )
    );

    setItems([...mergedItems, ...extraItems]);
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
    // Check if it's a placeholder item (not in database)
    if (typeof item.id === 'string' && item.id.startsWith('placeholder-')) {
      toast.error("Item not available in inventory yet");
      return;
    }

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

    // Update inventory stocks in parallel
    const stockUpdates = currentOrder.map(item => {
      const newStock = item.stock - item.quantity;
      return supabase
        .from("kiosk_inventory")
        .update({ 
          stock: newStock,
          status: newStock === 0 ? "Out of Stock" : newStock < 10 ? "Low Stock" : "In Stock"
        })
        .eq("id", item.id)
        .then(({ error }) => {
          if (error) console.error("Error updating stock:", error);
          return { item, newStock };
        });
    });

    const stockResults = await Promise.all(stockUpdates);

    // Create purchase orders in parallel for low stock items
    const purchaseOrders = stockResults
      .filter(({ newStock }) => newStock < 10)
      .map(({ item, newStock }) =>
        supabase
          .from("purchase_orders")
          .insert({
            kiosk_id: kioskId,
            items: [{ name: item.item_name, quantity: 50 - newStock }],
            status: "Preparing"
          })
          .then(({ error }) => {
            if (error) console.error("Error creating purchase order:", error);
          })
      );

    await Promise.all(purchaseOrders);

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">Available Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <ScrollArea className="h-[400px] sm:h-[500px]">
            <div className="px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Item</TableHead>
                    <TableHead className="text-xs sm:text-sm">Stock</TableHead>
                    <TableHead className="text-xs sm:text-sm">Price</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">{item.item_name}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{item.stock}</TableCell>
                      <TableCell className="text-xs sm:text-sm">₹{Number(item.price).toFixed(0)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getStatusBadge(item)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => addToOrder(item)}
                          disabled={item.stock === 0 || (typeof item.id === 'string' && item.id.startsWith('placeholder-'))}
                          className="text-xs h-7 sm:h-8"
                        >
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Add</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            Current Order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {currentOrder.length === 0 ? (
            <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">
              No items in order
            </div>
          ) : (
            <>
              <ScrollArea className="h-[250px] sm:h-[300px]">
                <div className="space-y-2 sm:space-y-3 pr-4">
                  {currentOrder.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 sm:p-3 bg-secondary rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs sm:text-sm truncate">{item.item_name}</div>
                        <div className="text-xs text-muted-foreground">
                          ₹{Number(item.price).toFixed(0)} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromOrder(item.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToOrder(item)}
                          disabled={item.quantity >= item.stock}
                          className="h-7 w-7 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="font-bold text-xs sm:text-sm min-w-[50px] text-right">
                          ₹{(Number(item.price) * item.quantity).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg font-bold">Total:</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">
                    ₹{getTotalPrice().toFixed(0)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Payment Type</Label>
                  <RadioGroup value={paymentType} onValueChange={(value) => setPaymentType(value as "Cash" | "UPI")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Cash" id="cash" />
                      <Label htmlFor="cash" className="cursor-pointer text-sm sm:text-base">Cash</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="UPI" id="upi" />
                      <Label htmlFor="upi" className="cursor-pointer text-sm sm:text-base">UPI</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handlePlaceOrder} className="w-full text-sm sm:text-base h-9 sm:h-10">
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
