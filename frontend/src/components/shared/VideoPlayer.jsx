import { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Video Player Component for Compro
 * Supports: YouTube embeds, direct MP4, and with custom controls
 */
export default function VideoPlayer({ 
  src, 
  poster, 
  title = "Video", 
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  className = "",
  aspectRatio = "16/9" // or "4/3", "21/9", "1/1"
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [showControls, setShowControls] = useState(false);

  // Check if YouTube URL
  const isYouTube = src?.includes("youtube.com") || src?.includes("youtu.be");
  
  // Extract YouTube video ID
  const getYouTubeId = (url) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen();
      }
    }
  };

  // YouTube Embed
  if (isYouTube) {
    const videoId = getYouTubeId(src);
    return (
      <div 
        className={`relative overflow-hidden rounded-xl bg-black ${className}`}
        style={{ aspectRatio }}
        data-testid="video-player-youtube"
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}&mute=${muted ? 1 : 0}&loop=${loop ? 1 : 0}&playlist=${loop ? videoId : ''}`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Native Video Player
  return (
    <div 
      className={`relative overflow-hidden rounded-xl bg-black group ${className}`}
      style={{ aspectRatio }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      data-testid="video-player-native"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
        onClick={handlePlayPause}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Custom Controls Overlay */}
      {controls && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls || !playing ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none"
        >
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className="pointer-events-auto flex items-center justify-center w-16 h-16 rounded-full bg-white/90 hover:bg-white transition-all hover:scale-110 shadow-xl"
            aria-label={playing ? "Pause video" : "Play video"}
            data-testid="video-play-pause-btn"
          >
            {playing ? (
              <Pause className="w-6 h-6 text-[#1C1510]" fill="currentColor" />
            ) : (
              <Play className="w-6 h-6 text-[#1C1510] ml-1" fill="currentColor" />
            )}
          </button>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={handleMuteToggle}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>

              <div className="flex-1" />

              <button
                onClick={handleFullscreen}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                aria-label="Fullscreen"
              >
                <Maximize className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Gradient Overlay for better control visibility */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
}
