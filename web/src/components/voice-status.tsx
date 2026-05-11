"use client";

type CallStatus = "preparing" | "dialing" | "in_progress" | "completed" | "failed";

interface VoiceStatusProps {
  status: CallStatus;
  message: string;
}

export function VoiceStatus({ status, message }: VoiceStatusProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
      <StatusAnimation status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{statusLabel(status)}</p>
        <p className="text-xs text-muted mt-0.5 truncate">{message}</p>
      </div>
    </div>
  );
}

function StatusAnimation({ status }: { status: CallStatus }) {
  if (status === "completed") {
    return (
      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-success" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10l4 4L16 6" />
        </svg>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-error" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l8 8M14 6l-8 8" />
        </svg>
      </div>
    );
  }

  // Active states: preparing, dialing, in_progress
  return (
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 relative">
      {/* Pulse animation */}
      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
      <svg className="w-5 h-5 text-primary relative z-10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {status === "preparing" ? (
          // Gear icon
          <path d="M10 7v6M7 10h6" />
        ) : status === "dialing" ? (
          // Phone icon
          <>
            <path d="M3 5.5C3 4.67 3.67 4 4.5 4H7l1.5 3-2 1.5a9 9 0 0 0 5 5l1.5-2 3 1.5V15.5c0 .83-.67 1.5-1.5 1.5A13 13 0 0 1 3 5.5Z" />
          </>
        ) : (
          // Waveform icon (in_progress)
          <>
            <path d="M4 10v0M7 7v6M10 5v10M13 7v6M16 10v0" />
          </>
        )}
      </svg>
    </div>
  );
}

function statusLabel(status: CallStatus): string {
  switch (status) {
    case "preparing": return "准备中";
    case "dialing": return "拨打中";
    case "in_progress": return "通话中";
    case "completed": return "预定完成";
    case "failed": return "预定失败";
  }
}
