import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface LiveInventoryProps {
  kioskId: string;
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

const LiveInventory = ({ kioskId }: LiveInventoryProps) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
    setupRealtimeSubscription();
  }, []);

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from("kiosk_inventory")
      .select("*")
      .eq("kiosk_id", kioskId)
      .order("item_name");

    if (error) {
      console.error("Error fetching inventory:", error);
      setLoading(false);
      return;
    }

    // Merge predefined items with database inventory
    const dbInventory = data || [];
    const mergedInventory = PREDEFINED_ITEMS.map((predefinedItem) => {
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

    setInventory([...mergedInventory, ...extraItems]);
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('live-inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_inventory', filter: `kiosk_id=eq.${kioskId}` },
        () => fetchInventory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  if (loading) return <div>Loading inventory...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Live Inventory
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.item_name}</TableCell>
                <TableCell>{item.stock}</TableCell>
                <TableCell>₹{Number(item.price).toFixed(2)}</TableCell>
                <TableCell>{getStatusBadge(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LiveInventory;
