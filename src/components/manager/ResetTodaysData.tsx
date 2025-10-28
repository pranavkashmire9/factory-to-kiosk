import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ResetTodaysDataProps {
  onReset: () => void;
}

const ResetTodaysData = ({ onReset }: ResetTodaysDataProps) => {
  const { t } = useTranslation();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Delete today's orders
      const { error: ordersError } = await supabase
        .from("orders")
        .delete()
        .eq("date", today);

      if (ordersError) throw ordersError;

      // Delete today's clock logs
      const { error: clockLogsError } = await supabase
        .from("clock_logs")
        .delete()
        .gte("timestamp", `${today}T00:00:00`)
        .lt("timestamp", `${today}T23:59:59`);

      if (clockLogsError) throw clockLogsError;

      // Delete today's reports
      const { error: reportsError } = await supabase
        .from("reports")
        .delete()
        .eq("date", today);

      if (reportsError) throw reportsError;

      toast.success(t("todaysDataReset") || "Today's data has been reset successfully");
      onReset();
    } catch (error) {
      console.error("Error resetting data:", error);
      toast.error(t("resetDataError") || "Failed to reset today's data");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          {t("resetTodaysData") || "Reset Today's Data"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("resetDataConfirmTitle") || "Are you absolutely sure?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("resetDataConfirmDescription") || 
              "This action cannot be undone. This will permanently delete all of today's sales, clock logs, and reports from the database."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResetting}>
            {t("cancel") || "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={isResetting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isResetting ? t("resetting") || "Resetting..." : t("resetData") || "Reset Data"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ResetTodaysData;
