import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const TodaysReport = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaysReport;
