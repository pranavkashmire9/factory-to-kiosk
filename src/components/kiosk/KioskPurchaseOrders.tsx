import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

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
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("kiosk_id", kioskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching purchase orders:", error);
    } else {
      setOrders(data || []);
    }
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Purchase Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No purchase orders yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="text-sm">
                      {Array.isArray(order.items) ? 
                        order.items.map((item: any, idx: number) => (
                          <div key={idx}>{item.name} ({item.quantity})</div>
                        ))
                        : "No items"
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default KioskPurchaseOrders;
