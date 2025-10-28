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
import { Plus, Pencil, Send, Trash2, BarChart3, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface FactoryInventoryProps {
  onUpdate: () => void;
}

const FactoryInventory = ({ onUpdate }: FactoryInventoryProps) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [kioskStockTotals, setKioskStockTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [sendItem, setSendItem] = useState<any>(null);
  const [selectedKiosk, setSelectedKiosk] = useState("");
  const [sendQuantity, setSendQuantity] = useState("");
  const [breakdownItem, setBreakdownItem] = useState<any>(null);
  const [breakdownData, setBreakdownData] = useState<any[]>([]);
  
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetchInventory();
    fetchKiosks();
    fetchKioskStockTotals();
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

  const fetchKioskStockTotals = async () => {
    const { data } = await supabase
      .from("kiosk_inventory")
      .select("item_name, stock");

    if (data) {
      const totals: Record<string, number> = {};
      data.forEach((item) => {
        if (totals[item.item_name]) {
          totals[item.item_name] += item.stock;
        } else {
          totals[item.item_name] = item.stock;
        }
      });
      setKioskStockTotals(totals);
    }
  };

  const setupRealtimeSubscription = () => {
    const factoryChannel = supabase
      .channel('factory-inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factory_inventory' },
        () => fetchInventory()
      )
      .subscribe();

    const kioskChannel = supabase
      .channel('kiosk-inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_inventory' },
        () => fetchKioskStockTotals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(factoryChannel);
      supabase.removeChannel(kioskChannel);
    };
  };

  const handleAddItem = async () => {
    const price = parseFloat(newItem.price);

    if (!newItem.name || isNaN(price)) {
      toast.error("Please fill all fields correctly");
      return;
    }

    const { error } = await supabase
      .from("factory_inventory")
      .insert({
        name: newItem.name,
        stock: 999999,
        price,
        status: "In Stock",
      });

    if (error) {
      toast.error("Error adding item");
      console.error(error);
    } else {
      toast.success("Item added successfully");
      setNewItem({ name: "", price: "" });
      fetchInventory();
      onUpdate();
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!editItem) return null;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editItem.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload image to storage
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      setUploadingImage(false);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      setUploadingImage(false);
      return null;
    }
  };

  const handleUpdateItem = async () => {
    if (!editItem) return;

    const price = parseFloat(editItem.price);
    let imageUrl = editItem.image_url;

    // Upload new image if selected
    if (imageFile) {
      const uploadedUrl = await handleImageUpload(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      }
    }

    const { error } = await supabase
      .from("factory_inventory")
      .update({
        name: editItem.name,
        price,
        status: "In Stock",
        image_url: imageUrl,
      })
      .eq("id", editItem.id);

    if (error) {
      toast.error("Error updating item");
      console.error(error);
    } else {
      // Sync image to all kiosk inventories with the same item name (case-insensitive)
      const { data: kioskItems, error: fetchKioskError } = await supabase
        .from("kiosk_inventory")
        .select("id, item_name")
        .ilike("item_name", editItem.name);

      if (fetchKioskError) {
        console.error("Error fetching kiosk items:", fetchKioskError);
        toast.error("Failed to sync image to kiosks");
      } else if (kioskItems && kioskItems.length > 0) {
        // Update each matching kiosk inventory item
        const kioskIds = kioskItems.map(item => item.id);
        const { error: kioskError } = await supabase
          .from("kiosk_inventory")
          .update({ image_url: imageUrl })
          .in("id", kioskIds);

        if (kioskError) {
          console.error("Error syncing image to kiosks:", kioskError);
          toast.error("Failed to sync image to kiosks");
        } else {
          console.log(`Synced image to ${kioskItems.length} kiosk inventory items`);
        }
      }

      toast.success("Item updated successfully");
      setEditItem(null);
      setImageFile(null);
      fetchInventory();
      onUpdate();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("factory_inventory")
      .delete()
      .eq("id", itemId);

    if (error) {
      toast.error("Error deleting item");
      console.error(error);
    } else {
      toast.success("Item deleted successfully");
      fetchInventory();
      onUpdate();
    }
  };

  const fetchBreakdownData = async (itemName: string) => {
    // First get all valid kiosk profiles
    const { data: kioskProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, kiosk_name")
      .eq("role", "kiosk")
      .not("kiosk_name", "is", null);

    if (profileError) {
      toast.error("Error fetching kiosk profiles");
      console.error(profileError);
      return [];
    }

    if (!kioskProfiles || kioskProfiles.length === 0) {
      return [];
    }

    const kioskIds = kioskProfiles.map(k => k.id);

    // Then get inventory for those kiosks
    const { data, error } = await supabase
      .from("kiosk_inventory")
      .select("stock, kiosk_id")
      .eq("item_name", itemName)
      .in("kiosk_id", kioskIds)
      .gt("stock", 0);

    if (error) {
      toast.error("Error fetching breakdown data");
      console.error(error);
      return [];
    }

    // Map kiosk names to the data
    const enrichedData = (data || []).map(item => ({
      stock: item.stock,
      kiosk_id: item.kiosk_id,
      profiles: {
        kiosk_name: kioskProfiles.find(k => k.id === item.kiosk_id)?.kiosk_name
      }
    }));

    return enrichedData;
  };

  const handleBreakdownClick = async (item: any) => {
    setBreakdownItem(item);
    const data = await fetchBreakdownData(item.name);
    setBreakdownData(data);
  };

  const handleSendItem = async () => {
    if (!sendItem || !selectedKiosk || !sendQuantity) {
      toast.error("Please select kiosk and quantity");
      return;
    }

    const quantity = parseInt(sendQuantity);

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
    fetchKioskStockTotals();
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
              <TableHead>Total Stock Across Kiosks</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span>{item.name}</span>
                  </div>
                </TableCell>
                <TableCell>∞</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{kioskStockTotals[item.name] || 0}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleBreakdownClick(item)}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>₹{Number(item.price).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="default">In Stock</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditItem(item);
                          setImageFile(null);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent onCloseAutoFocus={() => setImageFile(null)}>
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
                              <Label>Price</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editItem.price}
                                onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Item Image</Label>
                              {editItem.image_url && !imageFile && (
                                <div className="mb-2">
                                  <img 
                                    src={editItem.image_url} 
                                    alt={editItem.name}
                                    className="h-24 w-24 rounded object-cover"
                                  />
                                </div>
                              )}
                              {imageFile && (
                                <div className="mb-2">
                                  <img 
                                    src={URL.createObjectURL(imageFile)} 
                                    alt="Preview"
                                    className="h-24 w-24 rounded object-cover"
                                  />
                                </div>
                              )}
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setImageFile(file);
                                }}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Upload an image for this item
                              </p>
                            </div>
                            <Button 
                              onClick={handleUpdateItem} 
                              className="w-full"
                              disabled={uploadingImage}
                            >
                              {uploadingImage ? "Uploading..." : "Update Item"}
                            </Button>
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
                              <p className="text-sm text-muted-foreground">Factory stock: Infinite</p>
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
                              />
                            </div>
                            <Button onClick={handleSendItem} className="w-full">Send to Kiosk</Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Item</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{item.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Breakdown Modal */}
      <Dialog open={!!breakdownItem} onOpenChange={() => setBreakdownItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Breakdown - {breakdownItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {breakdownData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No stock found in any kiosk
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kiosk Name</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdownData.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.profiles?.kiosk_name || 'Unknown Kiosk'}
                      </TableCell>
                      <TableCell className="text-right">{item.stock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FactoryInventory;
