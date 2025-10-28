import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Receipt, ImageIcon, Trash2 } from "lucide-react";
import WastageModal from "./WastageModal";

interface RecentSalesProps {
  kioskId: string;
}

const RecentSales = ({ kioskId }: RecentSalesProps) => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wastageModal, setWastageModal] = useState<{ open: boolean; orderId: string; items: any[] }>({
    open: false,
    orderId: "",
    items: [],
  });
  const [wastageData, setWastageData] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchSales();
    fetchWastageData();
    setupRealtimeSubscription();
  }, []);

  const fetchSales = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("kiosk_id", kioskId)
      .eq("date", today)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Error fetching sales:", error);
      setLoading(false);
      return;
    }

    // Fetch item images from kiosk inventory
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

    setSales(enrichedOrders);
    setLoading(false);
  };

  const fetchWastageData = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("kiosk_id", kioskId)
      .eq("date", today);

    if (!orders) return;

    const orderIds = orders.map(o => o.id);
    
    const { data: wastage } = await supabase
      .from("wastage")
      .select("order_id, quantity")
      .in("order_id", orderIds);

    if (wastage) {
      const wastageMap = new Map<string, number>();
      wastage.forEach(w => {
        wastageMap.set(w.order_id, (wastageMap.get(w.order_id) || 0) + w.quantity);
      });
      setWastageData(wastageMap);
    }
  };

  const setupRealtimeSubscription = () => {
    const ordersChannel = supabase
      .channel('recent-sales')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `kiosk_id=eq.${kioskId}` },
        () => fetchSales()
      )
      .subscribe();

    const wastageChannel = supabase
      .channel('wastage-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wastage', filter: `kiosk_id=eq.${kioskId}` },
        () => fetchWastageData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(wastageChannel);
    };
  };

  if (loading) return <div>Loading sales...</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
          Recent Sales (Today)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {sales.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">
            No sales today
          </div>
        ) : (
          <ScrollArea className="h-[400px] sm:h-[500px]">
            <div className="px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Time</TableHead>
                    <TableHead className="text-xs sm:text-sm">Items</TableHead>
                    <TableHead className="text-xs sm:text-sm">Payment</TableHead>
                    <TableHead className="text-xs sm:text-sm">Total</TableHead>
                    <TableHead className="text-xs sm:text-sm">Wastage</TableHead>
                    <TableHead className="text-xs sm:text-sm">Waste Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(sale.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs sm:text-sm space-y-1">
                          {Array.isArray(sale.items) ? 
                            sale.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.name} className="h-6 w-6 rounded object-cover" />
                                ) : (
                                  <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                )}
                                <span>{item.name} × {item.quantity}</span>
                              </div>
                            ))
                            : "No items"
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{sale.payment_type}</TableCell>
                      <TableCell className="font-semibold text-primary text-xs sm:text-sm">
                        ₹{Number(sale.total).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setWastageModal({
                            open: true,
                            orderId: sale.id,
                            items: sale.items,
                          })}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Add Wastage
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-medium">
                        {wastageData.get(sale.id) || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <WastageModal
        open={wastageModal.open}
        onOpenChange={(open) => setWastageModal({ ...wastageModal, open })}
        orderId={wastageModal.orderId}
        kioskId={kioskId}
        items={wastageModal.items}
        onWastageAdded={() => {
          fetchWastageData();
          fetchSales();
        }}
      />
    </Card>
  );
};

export default RecentSales;
