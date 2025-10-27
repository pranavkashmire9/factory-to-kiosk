import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Recent Sales (Today)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No sales today
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Time</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {new Date(sale.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {Array.isArray(sale.items) ? 
                        sale.items.map((item: any, idx: number) => (
                          <div key={idx}>{item.name} × {item.quantity}</div>
                        ))
                        : "No items"
                      }
                    </div>
                  </TableCell>
                  <TableCell>{sale.payment_type}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    ₹{Number(sale.total).toFixed(2)}
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

export default RecentSales;
