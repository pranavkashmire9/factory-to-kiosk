import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, PackageX, Clock } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import KioskSales from "@/components/kiosk/KioskSales";
import ClockInOut from "@/components/kiosk/ClockInOut";
import LiveInventory from "@/components/kiosk/LiveInventory";
import KioskPurchaseOrders from "@/components/kiosk/KioskPurchaseOrders";
import RecentSales from "@/components/kiosk/RecentSales";
import LanguageSelector from "@/components/LanguageSelector";

const KioskDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [kioskId, setKioskId] = useState<string>("");
  const [kioskName, setKioskName] = useState("");
  const [stats, setStats] = useState({
    totalRevenue: 0,
    ordersCompleted: 0,
    lowStockItems: 0,
    clockIn: null as string | null,
    clockOut: null as string | null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Error getting user:", userError);
        navigate("/auth");
        return;
      }

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, kiosk_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        toast.error("Error loading profile");
        navigate("/auth");
        return;
      }

      if (!profile) {
        toast.error("Profile not found. Please contact administrator.");
        navigate("/auth");
        return;
      }

      if (profile.role !== "kiosk") {
        navigate("/manager-dashboard");
        return;
      }

      setKioskId(user.id);
      setKioskName(profile.kiosk_name || "Kiosk");
      fetchStats(user.id);
      setupRealtimeSubscription(user.id);
    } catch (error) {
      console.error("Auth check error:", error);
      toast.error("Authentication error");
      setLoading(false);
    }
  };

  const fetchStats = async (userId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Total Revenue (today)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("total")
        .eq("kiosk_id", userId)
        .eq("date", today);
      
      if (ordersError) throw ordersError;
      
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      // Orders Completed (today)
      const ordersCompleted = orders?.length || 0;

      // Low Stock Items (< 10)
      const { count: lowStockItems, error: lowStockError } = await supabase
        .from("kiosk_inventory")
        .select("*", { count: 'exact', head: true })
        .eq("kiosk_id", userId)
        .lt("stock", 10);

      if (lowStockError) {
        toast.error("Error fetching low stock items");
      }

      // Clock times (today)
      const { data: clockLogs, error: clockError } = await supabase
        .from("clock_logs")
        .select("type, timestamp")
        .eq("kiosk_id", userId)
        .gte("timestamp", `${today}T00:00:00`)
        .order("timestamp", { ascending: false });

      if (clockError) {
        toast.error("Error fetching clock logs");
      }

      // Get the most recent clock in and clock out for today
      const clockIn = clockLogs?.find(log => log.type === "in")?.timestamp || null;
      const clockOut = clockLogs?.find(log => log.type === "out")?.timestamp || null;

      setStats({
        totalRevenue,
        ordersCompleted,
        lowStockItems: lowStockItems || 0,
        clockIn,
        clockOut,
      });
    } catch (error: any) {
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (userId: string) => {
    const channel = supabase
      .channel('kiosk-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `kiosk_id=eq.${userId}` },
        () => fetchStats(userId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_inventory', filter: `kiosk_id=eq.${userId}` },
        () => fetchStats(userId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clock_logs', filter: `kiosk_id=eq.${userId}` },
        () => fetchStats(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (loading || !kioskId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{kioskName} {t('kiosk.dashboard')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{currentDate}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <LanguageSelector />
            <Button variant="outline" onClick={handleSignOut} className="flex-1 sm:flex-none">{t('common.signOut')}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{t('kiosk.totalRevenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-primary">₹{stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{t('kiosk.todayEarnings')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{t('kiosk.ordersCompleted')}</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.ordersCompleted}</div>
              <p className="text-xs text-muted-foreground">{t('kiosk.today')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{t('kiosk.lowStockItems')}</CardTitle>
              <PackageX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.lowStockItems}</div>
              <p className="text-xs text-muted-foreground">{t('kiosk.belowUnits')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{t('kiosk.clockInOut')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs sm:text-sm font-medium">
                {stats.clockIn && <div>In: {new Date(stats.clockIn).toLocaleTimeString()}</div>}
                {stats.clockOut && <div>Out: {new Date(stats.clockOut).toLocaleTimeString()}</div>}
                {!stats.clockIn && !stats.clockOut && <div className="text-muted-foreground">{t('kiosk.notClockedIn')}</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="w-full flex flex-nowrap overflow-x-auto overflow-y-hidden justify-start sm:grid sm:grid-cols-5 h-auto">
            <TabsTrigger value="sales" className="flex-shrink-0 text-xs sm:text-sm">{t('kiosk.tabs.sales')}</TabsTrigger>
            <TabsTrigger value="clock" className="flex-shrink-0 text-xs sm:text-sm">{t('kiosk.tabs.clock')}</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-shrink-0 text-xs sm:text-sm">{t('kiosk.tabs.inventory')}</TabsTrigger>
            <TabsTrigger value="purchase" className="flex-shrink-0 text-xs sm:text-sm">{t('kiosk.tabs.orders')}</TabsTrigger>
            <TabsTrigger value="recent" className="flex-shrink-0 text-xs sm:text-sm">{t('kiosk.tabs.recent')}</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <KioskSales kioskId={kioskId} onOrderComplete={() => fetchStats(kioskId)} />
          </TabsContent>

          <TabsContent value="clock">
            <ClockInOut kioskId={kioskId} onClockAction={() => fetchStats(kioskId)} />
          </TabsContent>

          <TabsContent value="inventory">
            <LiveInventory kioskId={kioskId} />
          </TabsContent>

          <TabsContent value="purchase">
            <KioskPurchaseOrders kioskId={kioskId} />
          </TabsContent>

          <TabsContent value="recent">
            <RecentSales kioskId={kioskId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default KioskDashboard;
