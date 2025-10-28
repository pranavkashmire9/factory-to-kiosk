import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TruckIcon, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import FactoryInventory from "@/components/manager/FactoryInventory";
import PurchaseOrders from "@/components/manager/PurchaseOrders";
import TodaysReport from "@/components/manager/TodaysReport";

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalStocks: 0,
    pendingProduction: 0,
    totalDispatched: 0,
  });

  useEffect(() => {
    checkAuth();
    fetchStats();
    setupRealtimeSubscription();
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
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        toast.error("Error loading profile");
        setLoading(false);
        return;
      }

      if (profile?.role !== "manager") {
        navigate("/kiosk-dashboard");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      toast.error("Authentication error");
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Total Revenue (today)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("total")
        .eq("date", today);
      
      if (ordersError) throw ordersError;
      
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      // Total Orders
      const { count: totalOrders, error: ordersCountError } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true });

      if (ordersCountError) {
        toast.error("Error fetching orders count");
      }

      // Total Stocks across all kiosks
      const { data: kioskInventory, error: kioskInventoryError } = await supabase
        .from("kiosk_inventory")
        .select("stock");
      
      if (kioskInventoryError) throw kioskInventoryError;
      
      const totalStocks = kioskInventory?.reduce((sum, item) => sum + item.stock, 0) || 0;

      // Pending Production
      const { count: pendingProduction, error: pendingError } = await supabase
        .from("purchase_orders")
        .select("*", { count: 'exact', head: true })
        .eq("status", "Preparing");

      if (pendingError) {
        toast.error("Error fetching pending production");
      }

      // Total Dispatched
      const { count: totalDispatched, error: dispatchedError } = await supabase
        .from("purchase_orders")
        .select("*", { count: 'exact', head: true })
        .eq("status", "Delivered");

      if (dispatchedError) {
        toast.error("Error fetching dispatched orders");
      }

      setStats({
        totalRevenue,
        totalOrders: totalOrders || 0,
        totalStocks,
        pendingProduction: pendingProduction || 0,
        totalDispatched: totalDispatched || 0,
      });
    } catch (error: any) {
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('manager-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosk_inventory' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => fetchStats()
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
            <h1 className="text-3xl font-bold text-foreground">Factory Manager Dashboard</h1>
            <p className="text-muted-foreground">{currentDate}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">All kiosks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Stocks</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStocks}</div>
              <p className="text-xs text-muted-foreground">Across all kiosks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Production</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingProduction}</div>
              <p className="text-xs text-muted-foreground">In preparing state</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Dispatched</CardTitle>
              <TruckIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDispatched}</div>
              <p className="text-xs text-muted-foreground">Delivered orders</p>
            </CardContent>
          </Card>
        </div>

        <FactoryInventory onUpdate={fetchStats} />
        <PurchaseOrders />
        <TodaysReport />
      </div>
    </div>
  );
};

export default ManagerDashboard;
