import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Clock } from "lucide-react";
import { toast } from "sonner";

interface ClockInOutProps {
  kioskId: string;
  onClockAction: () => void;
}

const ClockInOut = ({ kioskId, onClockAction }: ClockInOutProps) => {
  const [capturing, setCapturing] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [clockType, setClockType] = useState<"in" | "out" | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async (type: "in" | "out") => {
    setClockType(type);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      setCapturing(true);
      setVideoReady(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video metadata to load
        videoRef.current.onloadedmetadata = async () => {
          if (videoRef.current) {
            try {
              await videoRef.current.play();
              console.log("Video playing, ready to capture");
              setVideoReady(true);
            } catch (playError) {
              console.error("Error playing video:", playError);
              toast.error("Could not start video playback");
            }
          }
        };
      }
    } catch (error) {
      toast.error("Could not access camera");
      console.error("Camera error:", error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturing(false);
    setVideoReady(false);
    setClockType(null);
  };

  const captureAndClock = async () => {
    if (!clockType) {
      toast.error("Please select clock in or out");
      return;
    }
    
    if (!videoRef.current || !canvasRef.current) {
      toast.error("Camera not ready");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Verify video has dimensions
    if (!video.videoWidth || !video.videoHeight) {
      toast.error("Video not loaded properly. Please try again.");
      return;
    }
    
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Unable to process image");
      return;
    }

    console.log("Capturing image with dimensions:", video.videoWidth, "x", video.videoHeight);

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error("Failed to capture image");
        return;
      }

      try {
        const captureTimestamp = new Date().toISOString();
        
        // Upload to Supabase Storage
        const fileName = `${kioskId}_${clockType}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("clockin-photos")
          .upload(fileName, blob, {
            contentType: "image/jpeg",
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("clockin-photos")
          .getPublicUrl(fileName);

        // Save clock log with explicit timestamp
        const { error: logError } = await supabase
          .from("clock_logs")
          .insert({
            kiosk_id: kioskId,
            image_url: publicUrl,
            type: clockType,
            timestamp: captureTimestamp,
          });

        if (logError) throw logError;

        console.log(`Clock ${clockType} saved at ${captureTimestamp} for kiosk:`, kioskId);
        toast.success(`Clocked ${clockType} successfully!`);
        stopCamera();
        onClockAction();
      } catch (error) {
        toast.error("Error saving clock data");
        console.error("Clock in/out error:", error);
      }
    }, "image/jpeg", 0.95);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Clock In / Clock Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Capture your photo to clock in or out
        </div>

        {!capturing ? (
          <div className="flex gap-4">
            <Button onClick={() => startCamera("in")} className="flex-1">
              <Clock className="h-4 w-4 mr-2" />
              Clock In
            </Button>
            <Button onClick={() => startCamera("out")} variant="secondary" className="flex-1">
              <Clock className="h-4 w-4 mr-2" />
              Clock Out
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full"
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            
            {!videoReady ? (
              <div className="text-sm text-muted-foreground text-center">
                Preparing camera...
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center">
                Ready to capture for Clock {clockType?.toUpperCase()}
              </div>
            )}
            
            <Button 
              onClick={captureAndClock} 
              className="w-full"
              disabled={!videoReady}
              size="lg"
            >
              <Camera className="h-5 w-5 mr-2" />
              Capture & Submit
            </Button>
            
            <Button onClick={stopCamera} variant="outline" className="w-full">
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClockInOut;
