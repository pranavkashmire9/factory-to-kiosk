import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Edit, Plus, Trash2 } from "lucide-react";

const PurchaseOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [factoryInventory, setFactoryInventory] = useState<any[]>([]);
  const [editItems, setEditItems] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchFactoryInventory();
    setupRealtimeSubscription();
  }, []);

  const fetchOrders = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        profiles:kiosk_id (kiosk_name)
      `)
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`)
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

  const fetchFactoryInventory = async () => {
    const { data, error } = await supabase
      .from("factory_inventory")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Error fetching factory inventory");
      console.error(error);
    } else {
      setFactoryInventory(data || []);
    }
  };

  const handleEditClick = (order: any) => {
    setSelectedOrder(order);
    setEditItems(order.items || []);
    setEditDialogOpen(true);
  };

  const handleAddItem = () => {
    setEditItems([...editItems, { name: "", quantity: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditItems(updated);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;

    // Update purchase order
    const { error: orderError } = await supabase
      .from("purchase_orders")
      .update({ items: editItems })
      .eq("id", selectedOrder.id);

    if (orderError) {
      toast.error("Error updating purchase order");
      console.error(orderError);
      return;
    }

    // Update kiosk inventory
    for (const item of editItems) {
      const { data: existingItem } = await supabase
        .from("kiosk_inventory")
        .select("*")
        .eq("kiosk_id", selectedOrder.kiosk_id)
        .eq("item_name", item.name)
        .maybeSingle();

      if (existingItem) {
        // Update existing item
        await supabase
          .from("kiosk_inventory")
          .update({ stock: existingItem.stock + item.quantity })
          .eq("id", existingItem.id);
      } else {
        // Create new item
        const factoryItem = factoryInventory.find(f => f.name === item.name);
        await supabase
          .from("kiosk_inventory")
          .insert({
            kiosk_id: selectedOrder.kiosk_id,
            item_name: item.name,
            stock: item.quantity,
            price: factoryItem?.price || 0,
            status: "In Stock"
          });
      }
    }

    toast.success("Purchase order updated and kiosk inventory synced");
    setEditDialogOpen(false);
    fetchOrders();
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
                <TableHead>Edit</TableHead>
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
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(order)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Kiosk: {selectedOrder?.profiles?.kiosk_name}
            </div>

            {editItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Item</Label>
                  <Select
                    value={item.name}
                    onValueChange={(value) => handleItemChange(index, "name", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {factoryInventory.map((inv) => (
                        <SelectItem key={inv.id} value={inv.name}>
                          {inv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 0)}
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              onClick={handleAddItem}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PurchaseOrders;
