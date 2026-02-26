import React from 'react';
import { Circle, Square, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useSession } from '../../hooks/useSession';
import { formatDuration } from '../../lib/utils';
import { StreamToggles } from './StreamToggles';

export function SessionControls() {
  const {
    status,
    elapsedTime,
    error,
    streams,
    isRecording,
    isStarting,
    isStopping,
    startRecording,
    stopRecording,
    toggleStream,
  } = useSession();

  return (
    <div className="space-y-6">
      {/* Timer and Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6">
            {/* Timer Display */}
            <div className="text-center">
              <div className="text-5xl font-mono font-bold tracking-wider">
                {formatDuration(elapsedTime)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {status === 'idle' && 'Ready to record'}
                {status === 'starting' && 'Starting...'}
                {status === 'recording' && 'Recording in progress'}
                {status === 'stopping' && 'Stopping...'}
                {status === 'processing' && 'Processing recording...'}
              </p>
            </div>

            {/* Recording Indicator */}
            {isRecording && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full recording-indicator" />
                <span className="text-sm font-medium text-red-500">REC</span>
              </div>
            )}

            {/* Main Control Button */}
            <div className="flex gap-4">
              {!isRecording ? (
                <Button
                  size="lg"
                  className="w-32 h-12"
                  onClick={startRecording}
                  disabled={isStarting || isStopping}
                >
                  <Circle className="mr-2 h-4 w-4 fill-current" />
                  {isStarting ? 'Starting...' : 'Record'}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-32 h-12"
                  onClick={stopRecording}
                  disabled={isStopping}
                >
                  <Square className="mr-2 h-4 w-4 fill-current" />
                  {isStopping ? 'Stopping...' : 'Stop'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stream Toggles */}
      <StreamToggles
        streams={streams}
        onToggle={toggleStream}
        disabled={isStarting || isStopping}
      />

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
