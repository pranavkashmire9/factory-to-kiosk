import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

interface ClockInOutProps {
  kioskId: string;
  onClockAction: () => void;
}

const ClockInOut = ({ kioskId, onClockAction }: ClockInOutProps) => {
  const [loading, setLoading] = useState(false);

  const handleClock = async (type: "in" | "out") => {
    setLoading(true);
    try {
      const timestamp = new Date().toISOString();
      console.log(`Recording clock ${type} at ${timestamp}`);

      const { data: insertData, error: logError } = await supabase
        .from("clock_logs")
        .insert({
          kiosk_id: kioskId,
          type: type,
          timestamp: timestamp,
          image_url: null, // No image needed
        })
        .select();

      if (logError) {
        console.error("Clock log insert error:", logError);
        throw logError;
      }

      console.log("Clock log saved successfully:", insertData);
      console.log(`✅ Clock ${type} completed at ${timestamp}`);
      
      toast.success(`Clocked ${type} at ${new Date(timestamp).toLocaleTimeString()}!`);
      
      // Trigger dashboard refresh
      onClockAction();
    } catch (error: any) {
      console.error("❌ Clock in/out error:", error);
      toast.error(`Error saving clock ${type}: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
          Clock In / Clock Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        <div className="text-xs sm:text-sm text-muted-foreground">
          Record your attendance by clicking below
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Button 
            onClick={() => handleClock("in")} 
            className="flex-1 h-20 sm:h-24 flex-col gap-2 text-sm sm:text-base"
            disabled={loading}
            size="lg"
          >
            <LogIn className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>Clock In</span>
          </Button>
          
          <Button 
            onClick={() => handleClock("out")} 
            variant="secondary" 
            className="flex-1 h-20 sm:h-24 flex-col gap-2 text-sm sm:text-base"
            disabled={loading}
            size="lg"
          >
            <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>Clock Out</span>
          </Button>
        </div>

        {loading && (
          <div className="text-xs sm:text-sm text-muted-foreground text-center">
            Recording timestamp...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClockInOut;
