import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, PackageX, Clock } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KioskSales from "@/components/kiosk/KioskSales";
import ClockInOut from "@/components/kiosk/ClockInOut";
import LiveInventory from "@/components/kiosk/LiveInventory";
import KioskPurchaseOrders from "@/components/kiosk/KioskPurchaseOrders";
import RecentSales from "@/components/kiosk/RecentSales";

const KioskDashboard = () => {
  const navigate = useNavigate();
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
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        toast.error("Error loading profile");
        setLoading(false);
        return;
      }

      if (profile?.role !== "kiosk") {
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
      console.log("Starting to fetch kiosk stats for user:", userId);
      const today = new Date().toISOString().split('T')[0];

      // Total Revenue (today)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("total")
        .eq("kiosk_id", userId)
        .eq("date", today);
      
      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        throw ordersError;
      }
      
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
      console.log("Total revenue:", totalRevenue);

      // Orders Completed (today)
      const ordersCompleted = orders?.length || 0;

      // Low Stock Items (< 10)
      const { count: lowStockItems, error: lowStockError } = await supabase
        .from("kiosk_inventory")
        .select("*", { count: 'exact', head: true })
        .eq("kiosk_id", userId)
        .lt("stock", 10);

      if (lowStockError) {
        console.error("Error fetching low stock:", lowStockError);
      }

      // Clock times (today)
      const { data: clockLogs, error: clockError } = await supabase
        .from("clock_logs")
        .select("type, timestamp")
        .eq("kiosk_id", userId)
        .gte("timestamp", `${today}T00:00:00`)
        .order("timestamp", { ascending: true });

      if (clockError) {
        console.error("Error fetching clock logs:", clockError);
      }

      const clockIn = clockLogs?.find(log => log.type === "in")?.timestamp || null;
      const clockOut = clockLogs?.find(log => log.type === "out")?.timestamp || null;

      setStats({
        totalRevenue,
        ordersCompleted,
        lowStockItems: lowStockItems || 0,
        clockIn,
        clockOut,
      });

      console.log("Kiosk stats fetched successfully");
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      toast.error("Error loading dashboard data: " + (error.message || "Unknown error"));
    } finally {
      console.log("Setting loading to false");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{kioskName} Dashboard</h1>
            <p className="text-muted-foreground">{currentDate}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Today's earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Orders Completed</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ordersCompleted}</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <PackageX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lowStockItems}</div>
              <p className="text-xs text-muted-foreground">Below 10 units</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Clock In/Out</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {stats.clockIn && <div>In: {new Date(stats.clockIn).toLocaleTimeString()}</div>}
                {stats.clockOut && <div>Out: {new Date(stats.clockOut).toLocaleTimeString()}</div>}
                {!stats.clockIn && !stats.clockOut && <div className="text-muted-foreground">Not clocked in</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="clock">Clock In/Out</TabsTrigger>
            <TabsTrigger value="inventory">Live Inventory</TabsTrigger>
            <TabsTrigger value="purchase">Purchase Orders</TabsTrigger>
            <TabsTrigger value="recent">Recent Sales</TabsTrigger>
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
