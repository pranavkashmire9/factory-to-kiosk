import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ImageIcon } from "lucide-react";

interface KioskPurchaseOrdersProps {
  kioskId: string;
}

const KioskPurchaseOrders = ({ kioskId }: KioskPurchaseOrdersProps) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    setupRealtimeSubscription();
  }, []);

  const fetchOrders = async () => {
    const { data: orders, error } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("kiosk_id", kioskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching purchase orders:", error);
      setLoading(false);
      return;
    }

    // Fetch kiosk inventory images
    const { data: inventory } = await supabase
      .from("kiosk_inventory")
      .select("item_name, image_url")
      .eq("kiosk_id", kioskId);

    const imageMap = new Map(inventory?.map(item => [item.item_name, item.image_url]) || []);

    // Enrich orders with image URLs
    const enrichedOrders = orders?.map(order => ({
      ...order,
      items: Array.isArray(order.items) 
        ? order.items.map((item: any) => ({
            ...item,
            image_url: imageMap.get(item.name)
          }))
        : []
    })) || [];

    setOrders(enrichedOrders);
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('kiosk-purchase-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders', filter: `kiosk_id=eq.${kioskId}` },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Preparing":
        return "default";
      case "Out for Delivery":
        return "secondary";
      case "Delivered":
        return "default";
      case "Rejected":
        return "destructive";
      default:
        return "default";
    }
  };

  if (loading) return <div>Loading purchase orders...</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
          Purchase Orders
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">
            No purchase orders yet
          </div>
        ) : (
          <ScrollArea className="h-[400px] sm:h-[500px]">
            <div className="px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Items</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="text-xs sm:text-sm space-y-1">
                          {Array.isArray(order.items) ? 
                            order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.name} className="h-6 w-6 rounded object-cover" />
                                ) : (
                                  <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                )}
                                <span>{item.name} ({item.quantity})</span>
                              </div>
                            ))
                            : "No items"
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(order.status)} className="text-xs">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(order.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default KioskPurchaseOrders;
