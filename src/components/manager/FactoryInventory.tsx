import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Send } from "lucide-react";
import { toast } from "sonner";

interface FactoryInventoryProps {
  onUpdate: () => void;
}

const FactoryInventory = ({ onUpdate }: FactoryInventoryProps) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [sendItem, setSendItem] = useState<any>(null);
  const [selectedKiosk, setSelectedKiosk] = useState("");
  const [sendQuantity, setSendQuantity] = useState("");
  
  const [newItem, setNewItem] = useState({
    name: "",
    stock: "",
    price: "",
  });

  useEffect(() => {
    fetchInventory();
    fetchKiosks();
    setupRealtimeSubscription();
  }, []);

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from("factory_inventory")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Error fetching inventory");
      console.error(error);
    } else {
      setInventory(data || []);
    }
    setLoading(false);
  };

  const fetchKiosks = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, kiosk_name")
      .eq("role", "kiosk");

    setKiosks(data || []);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('factory-inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factory_inventory' },
        () => fetchInventory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAddItem = async () => {
    const stock = parseInt(newItem.stock);
    const price = parseFloat(newItem.price);

    if (!newItem.name || isNaN(stock) || isNaN(price)) {
      toast.error("Please fill all fields correctly");
      return;
    }

    const status = stock < 10 ? "Low Stock" : "In Stock";

    const { error } = await supabase
      .from("factory_inventory")
      .insert({
        name: newItem.name,
        stock,
        price,
        status,
      });

    if (error) {
      toast.error("Error adding item");
      console.error(error);
    } else {
      toast.success("Item added successfully");
      setNewItem({ name: "", stock: "", price: "" });
      fetchInventory();
      onUpdate();
    }
  };

  const handleUpdateItem = async () => {
    if (!editItem) return;

    const stock = parseInt(editItem.stock);
    const price = parseFloat(editItem.price);
    const status = stock < 10 ? "Low Stock" : "In Stock";

    const { error } = await supabase
      .from("factory_inventory")
      .update({
        name: editItem.name,
        stock,
        price,
        status,
      })
      .eq("id", editItem.id);

    if (error) {
      toast.error("Error updating item");
      console.error(error);
    } else {
      toast.success("Item updated successfully");
      setEditItem(null);
      fetchInventory();
      onUpdate();
    }
  };

  const handleSendItem = async () => {
    if (!sendItem || !selectedKiosk || !sendQuantity) {
      toast.error("Please select kiosk and quantity");
      return;
    }

    const quantity = parseInt(sendQuantity);
    if (quantity > sendItem.stock) {
      toast.error("Insufficient stock");
      return;
    }

    // Reduce factory stock
    const { error: factoryError } = await supabase
      .from("factory_inventory")
      .update({ 
        stock: sendItem.stock - quantity,
        status: (sendItem.stock - quantity) < 10 ? "Low Stock" : "In Stock"
      })
      .eq("id", sendItem.id);

    if (factoryError) {
      toast.error("Error updating factory inventory");
      return;
    }

    // Check if item exists in kiosk inventory
    const { data: existingItem } = await supabase
      .from("kiosk_inventory")
      .select("*")
      .eq("kiosk_id", selectedKiosk)
      .eq("item_name", sendItem.name)
      .maybeSingle();

    if (existingItem) {
      // Update existing item
      const newStock = existingItem.stock + quantity;
      const { error } = await supabase
        .from("kiosk_inventory")
        .update({ 
          stock: newStock,
          status: newStock < 10 ? "Low Stock" : "In Stock"
        })
        .eq("id", existingItem.id);

      if (error) {
        toast.error("Error updating kiosk inventory");
        return;
      }
    } else {
      // Create new item
      const { error } = await supabase
        .from("kiosk_inventory")
        .insert({
          kiosk_id: selectedKiosk,
          item_name: sendItem.name,
          stock: quantity,
          price: sendItem.price,
          status: quantity < 10 ? "Low Stock" : "In Stock"
        });

      if (error) {
        toast.error("Error adding item to kiosk");
        return;
      }
    }

    toast.success("Item sent to kiosk successfully");
    setSendItem(null);
    setSelectedKiosk("");
    setSendQuantity("");
    fetchInventory();
    onUpdate();
  };

  if (loading) return <div>Loading inventory...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Manage Factory Inventory</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add New Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Sweet Name</Label>
                  <Input
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g., Gulab Jamun"
                  />
                </div>
                <div>
                  <Label>Stock (units)</Label>
                  <Input
                    type="number"
                    value={newItem.stock}
                    onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Price (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddItem} className="w-full">Add Item</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sweet Name</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.stock}</TableCell>
                <TableCell>₹{Number(item.price).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "Low Stock" ? "destructive" : "default"}>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setEditItem(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Item</DialogTitle>
                        </DialogHeader>
                        {editItem && (
                          <div className="space-y-4">
                            <div>
                              <Label>Sweet Name</Label>
                              <Input
                                value={editItem.name}
                                onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Stock</Label>
                              <Input
                                type="number"
                                value={editItem.stock}
                                onChange={(e) => setEditItem({ ...editItem, stock: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Price</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editItem.price}
                                onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                              />
                            </div>
                            <Button onClick={handleUpdateItem} className="w-full">Update Item</Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSendItem(item)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send Item to Kiosk</DialogTitle>
                        </DialogHeader>
                        {sendItem && (
                          <div className="space-y-4">
                            <div>
                              <Label>Item: {sendItem.name}</Label>
                              <p className="text-sm text-muted-foreground">Available: {sendItem.stock} units</p>
                            </div>
                            <div>
                              <Label>Select Kiosk</Label>
                              <Select value={selectedKiosk} onValueChange={setSelectedKiosk}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose kiosk" />
                                </SelectTrigger>
                                <SelectContent>
                                  {kiosks.map((kiosk) => (
                                    <SelectItem key={kiosk.id} value={kiosk.id}>
                                      {kiosk.kiosk_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                value={sendQuantity}
                                onChange={(e) => setSendQuantity(e.target.value)}
                                max={sendItem.stock}
                              />
                            </div>
                            <Button onClick={handleSendItem} className="w-full">Send to Kiosk</Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default FactoryInventory;
