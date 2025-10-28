import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PastAnalyticsData {
  kioskName: string;
  revenue: number;
  clockIn: string;
  clockOut: string;
}

const PastAnalytics = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState<Date>();
  const [analyticsData, setAnalyticsData] = useState<PastAnalyticsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchPastAnalytics = async (selectedDate: Date) => {
    setLoading(true);
    setHasSearched(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    try {
      // Get all kiosks
      const { data: kiosks } = await supabase
        .from("profiles")
        .select("id, kiosk_name")
        .eq("role", "kiosk");

      if (!kiosks) {
        setAnalyticsData([]);
        setLoading(false);
        return;
      }

      // Get data for each kiosk for the selected date
      const analyticsPromises = kiosks.map(async (kiosk) => {
        // Get revenue
        const { data: orders } = await supabase
          .from("orders")
          .select("total")
          .eq("kiosk_id", kiosk.id)
          .eq("date", dateStr);

        const revenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

        // Get clock times
        const { data: clockLogs } = await supabase
          .from("clock_logs")
          .select("type, timestamp")
          .eq("kiosk_id", kiosk.id)
          .gte("timestamp", `${dateStr}T00:00:00`)
          .lte("timestamp", `${dateStr}T23:59:59`)
          .order("timestamp", { ascending: true });

        const clockIn = clockLogs?.find(log => log.type === "in")?.timestamp;
        const clockOut = clockLogs?.find(log => log.type === "out")?.timestamp;

        return {
          kioskName: kiosk.kiosk_name || "Unnamed Kiosk",
          revenue,
          clockIn: clockIn ? new Date(clockIn).toLocaleTimeString() : "-",
          clockOut: clockOut ? new Date(clockOut).toLocaleTimeString() : "-",
        };
      });

      const data = await Promise.all(analyticsPromises);
      setAnalyticsData(data);
    } catch (error) {
      console.error("Error fetching past analytics:", error);
      setAnalyticsData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      fetchPastAnalytics(selectedDate);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          {t('manager.pastAnalytics')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('manager.pastAnalyticsTitle')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t('manager.selectDate')}:</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>{t('manager.pickDate')}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          )}

          {!loading && hasSearched && analyticsData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('manager.noDataForDate')}
            </div>
          )}

          {!loading && analyticsData.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('manager.kioskName')}</TableHead>
                  <TableHead>{t('manager.clockInTime')}</TableHead>
                  <TableHead>{t('manager.clockOutTime')}</TableHead>
                  <TableHead>{t('manager.totalRevenue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyticsData.map((data, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{data.kioskName}</TableCell>
                    <TableCell>{data.clockIn}</TableCell>
                    <TableCell>{data.clockOut}</TableCell>
                    <TableCell className="text-primary font-semibold">
                      ₹{data.revenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PastAnalytics;
