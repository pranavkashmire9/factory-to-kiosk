import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Package, ImageIcon } from "lucide-react";

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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Package className="h-4 w-4 sm:h-5 sm:w-5" />
          Live Inventory
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <ScrollArea className="h-[400px] sm:h-[500px]">
          <div className="px-4 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Item Name</TableHead>
                  <TableHead className="text-xs sm:text-sm">Quantity</TableHead>
                  <TableHead className="text-xs sm:text-sm">Price</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.item_name} className="h-6 w-6 sm:h-8 sm:w-8 rounded object-cover" />
                        ) : (
                          <div className="h-6 w-6 sm:h-8 sm:w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span>{item.item_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{item.stock}</TableCell>
                    <TableCell className="text-xs sm:text-sm">₹{Number(item.price).toFixed(0)}</TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LiveInventory;
