import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClockInOutProps {
  kioskId: string;
  onClockAction: () => void;
}

interface ClockImage {
  type: "in" | "out";
  image_url: string;
  timestamp: string;
}

const ClockInOut = ({ kioskId, onClockAction }: ClockInOutProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"in" | "out" | null>(null);
  const [recentImages, setRecentImages] = useState<ClockImage[]>([]);

  useEffect(() => {
    fetchRecentImages();
  }, [kioskId]);

  const fetchRecentImages = async () => {
    try {
      const { data, error } = await supabase
        .from("clock_logs")
        .select("type, image_url, timestamp")
        .eq("kiosk_id", kioskId)
        .not("image_url", "is", null)
        .order("timestamp", { ascending: false })
        .limit(4);

      if (error) throw error;
      setRecentImages(data as ClockImage[]);
    } catch (error) {
      console.error("Error fetching recent images:", error);
    }
  };

  const handleImageUpload = async (type: "in" | "out", file: File) => {
    setUploadingImage(type);
    try {
      const timestamp = new Date().toISOString();
      const fileExt = file.name.split('.').pop();
      const fileName = `${kioskId}/${type}_${timestamp}.${fileExt}`;

      // Upload image to storage
      const { error: uploadError } = await supabase.storage
        .from("clockin-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("clockin-photos")
        .getPublicUrl(fileName);

      // Insert clock log with image URL
      const { error: logError } = await supabase
        .from("clock_logs")
        .insert({
          kiosk_id: kioskId,
          type: type,
          timestamp: timestamp,
          image_url: publicUrl,
        });

      if (logError) throw logError;

      toast.success(`Clock ${type} image uploaded successfully!`);
      fetchRecentImages();
      onClockAction();
    } catch (error: any) {
      console.error("Image upload error:", error);
      toast.error(`Error uploading image: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingImage(null);
    }
  };

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
          image_url: null,
        })
        .select();

      if (logError) {
        console.error("Clock log insert error:", logError);
        throw logError;
      }

      console.log("Clock log saved successfully:", insertData);
      console.log(`✅ Clock ${type} completed at ${timestamp}`);
      
      toast.success(`Clocked ${type} at ${new Date(timestamp).toLocaleTimeString()}!`);
      
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

        <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 border-t">
          <div className="space-y-2">
            <Label htmlFor="clock-in-image" className="text-xs sm:text-sm flex items-center gap-1">
              <Upload className="h-3 w-3" />
              Clock In Image
            </Label>
            <Input
              id="clock-in-image"
              type="file"
              accept="image/*"
              disabled={uploadingImage !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload("in", file);
              }}
              className="text-xs cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clock-out-image" className="text-xs sm:text-sm flex items-center gap-1">
              <Upload className="h-3 w-3" />
              Clock Out Image
            </Label>
            <Input
              id="clock-out-image"
              type="file"
              accept="image/*"
              disabled={uploadingImage !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload("out", file);
              }}
              className="text-xs cursor-pointer"
            />
          </div>
        </div>

        {uploadingImage && (
          <div className="text-xs sm:text-sm text-muted-foreground text-center">
            Uploading {uploadingImage === "in" ? "Clock In" : "Clock Out"} image...
          </div>
        )}

        {recentImages.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <div className="text-xs sm:text-sm font-medium flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Recent Images
            </div>
            <div className="grid grid-cols-2 gap-2">
              {recentImages.map((img, idx) => (
                <div key={idx} className="space-y-1">
                  <img
                    src={img.image_url}
                    alt={`Clock ${img.type} - ${new Date(img.timestamp).toLocaleString()}`}
                    className="w-full h-24 sm:h-32 object-cover rounded-md border"
                  />
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium">Clock {img.type === "in" ? "In" : "Out"}</div>
                    <div>{new Date(img.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClockInOut;
