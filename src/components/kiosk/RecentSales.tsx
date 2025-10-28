import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt } from "lucide-react";

interface RecentSalesProps {
  kioskId: string;
}

const RecentSales = ({ kioskId }: RecentSalesProps) => {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
    setupRealtimeSubscription();
  }, []);

  const fetchSales = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("kiosk_id", kioskId)
      .eq("date", today)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Error fetching sales:", error);
    } else {
      setSales(data || []);
    }
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('recent-sales')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `kiosk_id=eq.${kioskId}` },
        () => fetchSales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(sale.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs sm:text-sm">
                          {Array.isArray(sale.items) ? 
                            sale.items.map((item: any, idx: number) => (
                              <div key={idx}>{item.name} × {item.quantity}</div>
                            ))
                            : "No items"
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{sale.payment_type}</TableCell>
                      <TableCell className="font-semibold text-primary text-xs sm:text-sm">
                        ₹{Number(sale.total).toFixed(0)}
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

export default RecentSales;
