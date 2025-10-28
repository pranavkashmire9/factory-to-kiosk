import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { toast } from "sonner";

interface OrderBreakdown {
  itemName: string;
  paymentType: string;
  time: string;
  revenue: number;
}

const TodaysReport = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKiosk, setSelectedKiosk] = useState<{ id: string; name: string } | null>(null);
  const [breakdownData, setBreakdownData] = useState<OrderBreakdown[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  useEffect(() => {
    fetchReports();
    setupRealtimeSubscription();
  }, []);

  const fetchReports = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all kiosks
    const { data: kiosks } = await supabase
      .from("profiles")
      .select("id, kiosk_name")
      .eq("role", "kiosk");

    if (!kiosks) return;

    // Get today's data for each kiosk
    const reportsData = await Promise.all(
      kiosks.map(async (kiosk) => {
        // Get revenue
        const { data: orders } = await supabase
          .from("orders")
          .select("total")
          .eq("kiosk_id", kiosk.id)
          .eq("date", today);

        const revenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

        // Get clock times
        const { data: clockLogs } = await supabase
          .from("clock_logs")
          .select("type, timestamp")
          .eq("kiosk_id", kiosk.id)
          .gte("timestamp", `${today}T00:00:00`)
          .order("timestamp", { ascending: true });

        const clockIn = clockLogs?.find(log => log.type === "in")?.timestamp;
        const clockOut = clockLogs?.find(log => log.type === "out")?.timestamp;

        return {
          kioskId: kiosk.id,
          kioskName: kiosk.kiosk_name,
          revenue,
          clockIn: clockIn ? new Date(clockIn).toLocaleTimeString() : "-",
          clockOut: clockOut ? new Date(clockOut).toLocaleTimeString() : "-",
        };
      })
    );

    setReports(reportsData);
    setLoading(false);
  };

  const fetchBreakdown = async (kioskId: string, kioskName: string) => {
    setSelectedKiosk({ id: kioskId, name: kioskName });
    setLoadingBreakdown(true);
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data: orders, error } = await supabase
      .from("orders")
      .select("items, payment_type, timestamp, total")
      .eq("kiosk_id", kioskId)
      .eq("date", today)
      .order("timestamp", { ascending: false });

    if (error) {
      toast.error("Failed to fetch breakdown data");
      setLoadingBreakdown(false);
      return;
    }

    const breakdown: OrderBreakdown[] = [];
    
    orders?.forEach(order => {
      const items = order.items as any[];
      items.forEach(item => {
        breakdown.push({
          itemName: item.name,
          paymentType: order.payment_type,
          time: new Date(order.timestamp).toLocaleTimeString(),
          revenue: item.price * item.quantity,
        });
      });
    });

    setBreakdownData(breakdown);
    setLoadingBreakdown(false);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchReports()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clock_logs' },
        () => fetchReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  if (loading) return <div>Loading reports...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Report</CardTitle>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No kiosks registered yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kiosk Name</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Clock-in Time</TableHead>
                <TableHead>Clock-out Time</TableHead>
                <TableHead>Revenue Breakdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{report.kioskName}</TableCell>
                  <TableCell className="text-primary font-semibold">
                    ₹{report.revenue.toFixed(2)}
                  </TableCell>
                  <TableCell>{report.clockIn}</TableCell>
                  <TableCell>{report.clockOut}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchBreakdown(report.kioskId, report.kioskName)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Breakdown
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selectedKiosk} onOpenChange={() => setSelectedKiosk(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revenue Breakdown - {selectedKiosk?.name}</DialogTitle>
          </DialogHeader>
          
          {loadingBreakdown ? (
            <div className="text-center py-8 text-muted-foreground">Loading breakdown...</div>
          ) : breakdownData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sales data for today</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownData.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>{item.paymentType}</TableCell>
                    <TableCell>{item.time}</TableCell>
                    <TableCell className="text-primary font-semibold">
                      ₹{item.revenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TodaysReport;
