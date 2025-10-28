import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, Camera, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClockInOutProps {
  kioskId: string;
  onClockAction: () => void;
}

interface ClockImage {
  type: "in" | "out";
  image_url: string;
  timestamp: string;
}

interface CapturedImage {
  blob: Blob;
  dataUrl: string;
  timestamp: string;
}

const ClockInOut = ({ kioskId, onClockAction }: ClockInOutProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"in" | "out" | null>(null);
  const [recentImages, setRecentImages] = useState<ClockImage[]>([]);
  const [cameraOpen, setCameraOpen] = useState<"in" | "out" | null>(null);
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchRecentImages();
  }, [kioskId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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

  const openCamera = async (type: "in" | "out") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      streamRef.current = stream;
      setCameraOpen(type);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error("Camera access error:", error);
      toast.error("Could not access camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const dataUrl = canvas.toDataURL("image/jpeg");
        const timestamp = new Date().toISOString();
        setCapturedImage({ blob, dataUrl, timestamp });
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  };

  const submitImage = async () => {
    if (!capturedImage || !cameraOpen) return;

    setUploadingImage(cameraOpen);
    try {
      const fileExt = "jpg";
      const fileName = `${kioskId}/${cameraOpen}_${capturedImage.timestamp}.${fileExt}`;

      // Upload image to storage
      const { error: uploadError } = await supabase.storage
        .from("clockin-photos")
        .upload(fileName, capturedImage.blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("clockin-photos")
        .getPublicUrl(fileName);

      // Insert clock log with image URL and captured timestamp
      const { error: logError } = await supabase
        .from("clock_logs")
        .insert({
          kiosk_id: kioskId,
          type: cameraOpen,
          timestamp: capturedImage.timestamp,
          image_url: publicUrl,
        });

      if (logError) throw logError;

      toast.success(`Clock ${cameraOpen} image uploaded successfully!`);
      fetchRecentImages();
      onClockAction();
      closeCamera();
    } catch (error: any) {
      console.error("Image upload error:", error);
      toast.error(`Error uploading image: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingImage(null);
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(null);
    setCapturedImage(null);
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
          <Button
            onClick={() => openCamera("in")}
            variant="outline"
            className="h-20 sm:h-24 flex-col gap-2"
            disabled={uploadingImage !== null}
          >
            <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">Take Clock In Photo</span>
          </Button>

          <Button
            onClick={() => openCamera("out")}
            variant="outline"
            className="h-20 sm:h-24 flex-col gap-2"
            disabled={uploadingImage !== null}
          >
            <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">Take Clock Out Photo</span>
          </Button>
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

      <Dialog open={cameraOpen !== null} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Take Clock {cameraOpen === "in" ? "In" : "Out"} Photo
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-md border"
                />
                <canvas ref={canvasRef} className="hidden" />
                <Button
                  onClick={capturePhoto}
                  className="w-full"
                  size="lg"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Capture Photo
                </Button>
              </>
            ) : (
              <>
                <img
                  src={capturedImage.dataUrl}
                  alt="Captured"
                  className="w-full rounded-md border"
                />
                <div className="text-xs text-muted-foreground text-center">
                  Timestamp: {new Date(capturedImage.timestamp).toLocaleString()}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => setCapturedImage(null)}
                    variant="outline"
                    size="lg"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Retake
                  </Button>
                  <Button
                    onClick={submitImage}
                    disabled={uploadingImage !== null}
                    size="lg"
                  >
                    {uploadingImage ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ClockInOut;
