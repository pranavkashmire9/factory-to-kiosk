import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PurchaseOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    setupRealtimeSubscription();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        profiles:kiosk_id (kiosk_name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error fetching purchase orders");
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('purchase-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Error updating order status");
      console.error(error);
    } else {
      toast.success("Order status updated");
      fetchOrders();
    }
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
        <CardTitle>Incoming Purchase Orders</CardTitle>
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
                <TableHead>Kiosk Name</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.profiles?.kiosk_name || "Unknown"}
                  </TableCell>
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
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Preparing">Preparing</SelectItem>
                        <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
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

export default PurchaseOrders;
