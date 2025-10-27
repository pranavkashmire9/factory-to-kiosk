import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

interface LiveInventoryProps {
  kioskId: string;
}

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
    } else {
      setInventory(data || []);
    }
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
        {inventory.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No items in inventory yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sweet</TableHead>
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
        )}
      </CardContent>
    </Card>
  );
};

export default LiveInventory;
