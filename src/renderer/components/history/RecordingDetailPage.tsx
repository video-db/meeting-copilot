/**
 * Recording Detail Page
 *
 * Full page view for a recording with:
 * - Header: back button, title, metadata, actions
 * - Left panel: Meeting summary, key points, checklist
 * - Right panel: Video player, chat button, transcript
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  List,
  CheckSquare,
  MessageCircle,
  Sparkles,
  Upload,
  Link2,
  ChevronDown,
  Check,
  Loader2,
  Video,
} from 'lucide-react';
import { trpc } from '../../api/trpc';
import type { Recording } from '../../../shared/schemas/recording.schema';
import { formatDate, formatDurationMinutes, cn } from '../../lib/utils';

interface RecordingDetailPageProps {
  recordingId: number;
  onBack: () => void;
}

// Format time as MM:SS for transcript
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingDetailPage({ recordingId, onBack }: RecordingDetailPageProps) {
  const [showAllKeyPoints, setShowAllKeyPoints] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);

  // Fetch recording data
  const { data: recording, isLoading } = trpc.recordings.get.useQuery(
    { recordingId },
    { enabled: !!recordingId }
  );

  // Fetch transcript from database
  const { data: transcript } = trpc.recordings.getTranscript.useQuery(
    { recordingId },
    { enabled: !!recordingId }
  );

  // Populate collectionId if missing
  const populateCollectionIdMutation = trpc.recordings.populateCollectionId.useMutation();

  useEffect(() => {
    if (recording?.videoId && !recording?.collectionId && !collectionId) {
      populateCollectionIdMutation.mutateAsync({ recordingId }).then((result) => {
        if (result.collectionId) {
          setCollectionId(result.collectionId);
        }
      });
    } else if (recording?.collectionId) {
      setCollectionId(recording.collectionId);
    }
  }, [recording?.videoId, recording?.collectionId, recordingId]);

  if (isLoading) {
    return (
      <div className="bg-[#f7f7f7] h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#ec5b16] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="bg-[#f7f7f7] h-full flex flex-col items-center justify-center gap-4">
        <p className="text-[#464646]">Recording not found</p>
        <button
          onClick={onBack}
          className="text-[#ec5b16] hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const title = recording.meetingName || `Recording - ${formatDate(recording.createdAt)}`;
  const isVideoReady = recording.status === 'available' && !!recording.playerUrl;

  // Debug logging
  console.log('[RecordingDetailPage] videoId:', recording.videoId);
  console.log('[RecordingDetailPage] collectionId (from recording):', recording.collectionId);
  console.log('[RecordingDetailPage] collectionId (local state):', collectionId);

  return (
    <div className="bg-[#f7f7f7] h-full flex flex-col pt-[10px] px-[10px]">
      {/* Header */}
      <Header
        title={title}
        recordingId={recordingId}
        createdAt={recording.createdAt}
        duration={recording.duration}
        playerUrl={recording.playerUrl}
        onBack={onBack}
      />

      {/* Main Content */}
      <div className="flex-1 bg-white border border-[#efefef] rounded-[20px] p-[20px] pb-[40px] flex gap-[30px] overflow-y-auto mb-[10px]">
        {/* Left Panel - Meeting Insights */}
        <div className="flex-1 flex flex-col gap-[30px] min-w-0">
          {/* Section Header */}
          <div className="flex items-center gap-[4px]">
            <Sparkles className="h-5 w-5 text-[#ec5b16]" />
            <h2 className="text-[18px] font-semibold text-black tracking-[0.09px]">
              Meeting Insights
            </h2>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-[20px] pb-[20px]">
            {/* Meeting Summary Card */}
            <SummaryCard summary={recording.shortOverview} />

            {/* Key Points Card */}
            <KeyPointsCard
              keyPoints={recording.keyPoints}
              expanded={showAllKeyPoints}
              onToggle={() => setShowAllKeyPoints(!showAllKeyPoints)}
            />

            {/* Action Items Card (Post-Meeting Checklist) */}
            <ActionItemsCard checklist={recording.postMeetingChecklist} />
          </div>
        </div>

        {/* Right Panel - Video & Transcript */}
        <div className="flex-1 flex flex-col gap-[30px] min-w-0">
          {/* Video Player */}
          <VideoPlayerSection
            playerUrl={recording.playerUrl}
            isReady={isVideoReady}
          />

          {/* Chat with Video Button */}
          <div className="flex justify-center">
            <ChatWithVideoButton
              videoId={recording.videoId}
              collectionId={collectionId}
              disabled={!isVideoReady}
            />
          </div>

          {/* Transcript Section */}
          <TranscriptSection transcript={transcript || []} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface HeaderProps {
  title: string;
  recordingId: number;
  createdAt: string;
  duration: number | null;
  playerUrl: string | null | undefined;
  onBack: () => void;
}

function Header({ title, recordingId, createdAt, duration, playerUrl, onBack }: HeaderProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>('idle');
  const [exportOpen, setExportOpen] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadingTranscript, setDownloadingTranscript] = useState(false);

  const downloadVideoMutation = trpc.recordings.downloadVideo.useMutation();
  const { data: transcript } = trpc.recordings.getTranscript.useQuery(
    { recordingId },
    { enabled: !!recordingId }
  );

  const handleCopyLink = async () => {
    if (!playerUrl || copyState !== 'idle') return;

    setCopyState('copying');
    await navigator.clipboard.writeText(playerUrl);
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 2000);
  };

  const handleDownloadVideo = async () => {
    setDownloadingVideo(true);
    setExportOpen(false);
    try {
      const result = await downloadVideoMutation.mutateAsync({ recordingId });
      window.open(result.downloadUrl, '_blank');
    } catch (error) {
      console.error('Failed to download video:', error);
    } finally {
      setDownloadingVideo(false);
    }
  };

  const handleDownloadTranscript = () => {
    if (!transcript || transcript.length === 0) return;
    setDownloadingTranscript(true);
    setExportOpen(false);

    const content = transcript.map(seg => {
      const mins = Math.floor(seg.startTime / 60);
      const secs = Math.floor(seg.startTime % 60);
      const time = `${mins}:${secs.toString().padStart(2, '0')}`;
      const speaker = seg.channel === 'me' ? 'You' : 'Them';
      return `[${time}] ${speaker}: ${seg.text}`;
    }).join('\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadingTranscript(false);
  };

  return (
    <div className="flex gap-[12px] items-start p-[20px]">
      {/* Left: Back + Title */}
      <div className="flex-1 flex gap-[16px] items-start">
        {/* Back Button */}
        <div className="pt-[2px]">
          <button
            onClick={onBack}
            className="w-[28px] h-[28px] bg-white border border-black/20 rounded-[6.5px] flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-[15px] w-[15px] text-black" />
          </button>
        </div>

        {/* Title & Metadata */}
        <div className="flex-1 flex flex-col gap-[10px]">
          <h1 className="text-[24px] font-semibold text-black tracking-[0.12px]">
            {title}
          </h1>
          <div className="flex items-center gap-[20px]">
            {/* Date */}
            <div className="flex items-center gap-[4px]">
              <Calendar className="h-4 w-4 text-[#969696]" />
              <span className="text-[14px] text-[#464646] tracking-[0.07px]">
                {formatDate(createdAt)}
              </span>
            </div>
            {/* Duration */}
            {duration && (
              <div className="flex items-center gap-[8px]">
                <Clock className="h-4 w-4 text-[#969696]" />
                <span className="text-[14px] text-[#464646] tracking-[0.07px]">
                  {formatDurationMinutes(duration)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex gap-[12px] items-start">
        {/* Export Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={downloadingVideo || downloadingTranscript}
            className={cn(
              "flex items-center gap-[6px] border rounded-[12px] px-[16px] py-[12px] shadow-[0px_1.27px_15.27px_0px_rgba(0,0,0,0.05)] transition-colors",
              exportOpen
                ? "bg-[#fff5ec] border-[#ffcfa5]"
                : "bg-white border-[#efefef] hover:bg-[#efefef] hover:border-[#969696]"
            )}
          >
            {downloadingVideo || downloadingTranscript ? (
              <Loader2 className="h-5 w-5 text-black animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-black" />
            )}
            <span className="text-[14px] font-semibold text-black tracking-[-0.28px]">
              Export
            </span>
            <ChevronDown className="h-5 w-5 text-black" />
          </button>

          {/* Dropdown Menu */}
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-[#efefef] rounded-[12px] shadow-[0px_17px_17px_0px_rgba(0,0,0,0.12),0px_4px_9px_0px_rgba(0,0,0,0.14)] p-[8px] min-w-[180px]">
                <button
                  onClick={handleDownloadVideo}
                  className="w-full flex items-center gap-[6px] px-[10px] py-[8px] rounded-[10px] hover:bg-[#efefef] transition-colors"
                >
                  <Video className="h-5 w-5 text-black" />
                  <span className="text-[13px] font-medium text-black">Video</span>
                </button>
                <button
                  onClick={handleDownloadTranscript}
                  disabled={!transcript || transcript.length === 0}
                  className="w-full flex items-center gap-[6px] px-[10px] py-[8px] rounded-[10px] hover:bg-[#efefef] transition-colors disabled:opacity-50"
                >
                  <FileText className="h-5 w-5 text-black" />
                  <span className="text-[13px] font-medium text-black">Transcript</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Copy Video Link Button */}
        <button
          onClick={handleCopyLink}
          disabled={!playerUrl || copyState !== 'idle'}
          className={cn(
            "flex items-center gap-[4px] rounded-[12px] px-[14px] py-[12px] shadow-[0px_1.27px_15.27px_0px_rgba(0,0,0,0.05)] transition-colors",
            copyState === 'copied' ? "bg-[#007657]" :
            copyState === 'copying' ? "bg-[#ff7e32]" :
            "bg-[#ff4000] hover:bg-[#cc2b02]",
            !playerUrl && "opacity-50 cursor-not-allowed"
          )}
        >
          {copyState === 'copied' ? (
            <Check className="h-5 w-5 text-white" />
          ) : copyState === 'copying' ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Link2 className="h-5 w-5 text-white" />
          )}
          <span className="text-[14px] font-semibold text-white tracking-[-0.28px]">
            {copyState === 'copied' ? "Link copied!" :
             copyState === 'copying' ? "Creating link..." :
             "Copy video link"}
          </span>
        </button>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  summary: string | null | undefined;
}

function SummaryCard({ summary }: SummaryCardProps) {
  if (!summary) return null;

  return (
    <div className="bg-[#fff5ec] border border-[#ffe9d3] rounded-[16px] p-[20px] flex flex-col gap-[16px]">
      {/* Header */}
      <div className="flex items-center gap-[8px]">
        <FileText className="h-5 w-5 text-[#ec5b16]" />
        <h3 className="text-[16px] font-medium text-black tracking-[0.08px]">
          Meeting Summary
        </h3>
      </div>
      {/* Content */}
      <p className="text-[14px] text-[#2d2d2d] leading-[20px] tracking-[0.07px]">
        {summary}
      </p>
    </div>
  );
}

interface KeyPointsCardProps {
  keyPoints: Array<{ topic: string; points: string[] }> | null | undefined;
  expanded: boolean;
  onToggle: () => void;
}

function KeyPointsCard({ keyPoints, expanded, onToggle }: KeyPointsCardProps) {
  if (!keyPoints || keyPoints.length === 0) return null;

  return (
    <div className={cn(
      "bg-[#fff5ec] border border-[#ffe9d3] rounded-[16px] p-[20px] flex flex-col gap-[16px] relative overflow-hidden",
      !expanded && "max-h-[200px]"
    )}>
      {/* Header */}
      <div className="flex items-center gap-[8px]">
        <List className="h-5 w-5 text-[#ec5b16]" />
        <h3 className="text-[16px] font-medium text-black tracking-[0.08px]">
          Key Points
        </h3>
      </div>

      {/* Content */}
      <div className="flex flex-col text-[14px] text-[#2d2d2d]">
        {keyPoints.map((kp, idx) => (
          <div key={idx} className="mb-2">
            <p className="font-semibold leading-[24px]">
              {idx + 1}. {kp.topic}
            </p>
            <ul className="list-disc ml-[42px]">
              {kp.points.map((point, pIdx) => (
                <li key={pIdx} className="leading-[24px]">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Gradient Overlay & See More Button */}
      {!expanded && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-[52px] bg-gradient-to-t from-[#fff5ec] to-transparent pointer-events-none" />
          <button
            onClick={onToggle}
            className="absolute bottom-[6px] left-1/2 -translate-x-1/2 flex items-center gap-px bg-white border border-[#ffcfa5] rounded-full px-[12px] py-[8px] hover:bg-gray-50 transition-colors"
          >
            <span className="text-[13px] font-medium text-[#1f2937] tracking-[0.065px] px-[4px]">
              See more
            </span>
            <ChevronDown className="h-4 w-4 text-[#1f2937]" />
          </button>
        </>
      )}
    </div>
  );
}

interface ActionItemsCardProps {
  checklist: string[] | null | undefined;
}

function ActionItemsCard({ checklist }: ActionItemsCardProps) {
  if (!checklist || checklist.length === 0) return null;

  return (
    <div className="bg-[#f7f7f7] border border-[#efefef] rounded-[16px] p-[20px] flex flex-col gap-[16px]">
      {/* Header */}
      <div className="flex items-center gap-[8px]">
        <CheckSquare className="h-5 w-5 text-[#ec5b16]" />
        <h3 className="text-[16px] font-medium text-black tracking-[0.08px]">
          Action Items
        </h3>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-[10px]">
        {checklist.map((item, idx) => (
          <div
            key={idx}
            className="bg-white border border-[#efefef] rounded-[8px] px-[16px] py-[12px] flex items-start gap-[12px]"
          >
            {/* Checkbox */}
            <div className="w-4 h-4 shrink-0 rounded border border-[#ec5b16] flex items-center justify-center mt-[2px]">
              {/* Unchecked by default */}
            </div>
            <span className="text-[14px] text-black leading-[20px] tracking-[0.07px]">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface VideoPlayerSectionProps {
  playerUrl: string | null | undefined;
  isReady: boolean;
}

function VideoPlayerSection({ playerUrl, isReady }: VideoPlayerSectionProps) {
  const embedUrl = playerUrl?.replace('/watch', '/embed');

  return (
    <div className="border border-[#efefef] rounded-[16px] px-[6px] py-[5px]">
      <div className="aspect-video rounded-[16px] border border-black/10 overflow-hidden bg-gray-100">
        {isReady && embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#969696]">
            <p className="text-[14px]">Video not available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatWithVideoButtonProps {
  videoId: string | null | undefined;
  collectionId: string | null | undefined;
  disabled: boolean;
}

function ChatWithVideoButton({ videoId, collectionId, disabled }: ChatWithVideoButtonProps) {
  const handleClick = () => {
    if (!videoId || !collectionId) return;
    const chatUrl = `https://chat.videodb.io?video_id=${videoId}&collection_id=${collectionId}`;
    window.electronAPI?.app.openExternalLink(chatUrl);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || !videoId || !collectionId}
      className={cn(
        "w-[248px] h-[52px] rounded-[32px] shadow-[0px_2px_3px_0px_rgba(0,0,0,0.18)] relative overflow-hidden",
        (disabled || !videoId || !collectionId) && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Gradient Background */}
      <div
        className="absolute inset-0 rounded-[32px] border-2 border-[#494949]"
        style={{
          background: 'linear-gradient(260deg, rgb(0, 0, 0) 4.66%, rgb(30, 30, 30) 99.38%)',
        }}
      >
        <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_4px_4px_0px_rgba(255,255,255,0.32)]" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center gap-[6px]">
        <MessageCircle className="h-5 w-5 text-white" />
        <span className="text-[16px] font-medium text-white tracking-[-0.08px]">
          Chat with video
        </span>
      </div>
    </button>
  );
}

interface TranscriptSegment {
  id: string;
  channel: 'me' | 'them';
  text: string;
  startTime: number;
}

interface TranscriptSectionProps {
  transcript: TranscriptSegment[];
}

function TranscriptSection({ transcript }: TranscriptSectionProps) {
  return (
    <div className="flex flex-col gap-[20px] flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-[4px]">
        <Sparkles className="h-5 w-5 text-[#ec5b16]" />
        <h2 className="text-[18px] font-semibold text-black tracking-[0.09px]">
          Meeting Transcript
        </h2>
      </div>

      {/* Transcript Content */}
      <div className="border border-[#efefef] rounded-[16px] flex-1 min-h-[200px] max-h-[500px] overflow-hidden relative">
        <div className="h-full overflow-y-auto px-[20px]">
          {/* Top gradient overlay */}
          <div className="sticky top-0 left-0 right-0 h-[52px] bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />

          {/* Transcript items */}
          <div className="flex flex-col gap-[8px] -mt-[40px] pb-[20px]">
            {transcript.length === 0 ? (
              <div className="py-8 text-center text-[#969696] text-[14px]">
                No transcript available
              </div>
            ) : (
              transcript.map((segment) => (
                <TranscriptChunk
                  key={segment.id}
                  time={formatTime(segment.startTime)}
                  speaker={segment.channel === 'me' ? 'You' : 'Them'}
                  text={segment.text}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TranscriptChunkProps {
  time: string;
  speaker: string;
  text: string;
}

function TranscriptChunk({ time, speaker, text }: TranscriptChunkProps) {
  return (
    <div className="flex gap-[12px] items-start px-[8px] py-[6px] rounded-[10px]">
      {/* Time */}
      <div className="flex items-center justify-center">
        <span className="text-[12px] text-[#969696] leading-[16px]">{time}</span>
      </div>

      {/* Speaker & Text */}
      <div className="flex-1 flex flex-col gap-[4px]">
        <span className="text-[13px] font-medium text-black leading-[16px]">
          {speaker}
        </span>
        <p className="text-[12px] text-[#464646] leading-[16px]">
          {text}
        </p>
      </div>
    </div>
  );
}

export default RecordingDetailPage;
