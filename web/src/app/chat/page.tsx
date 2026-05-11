"use client";

import { AuthGuard } from "@/components/auth-guard";
import { ChatSidebar } from "@/components/chat-sidebar";
import { BookingDrawer } from "@/components/booking-drawer";
import { VoiceBookingDrawer } from "@/components/voice-booking-drawer";
import { SourceDrawer } from "@/components/source-drawer";
import { NotificationBanner } from "@/components/notification-banner";
import { useChat } from "@/features/chat/hooks/use-chat";
import { TopBar } from "@/features/chat/components/top-bar";
import { MessageBubble } from "@/features/chat/components/message-bubble";
import { InputArea } from "@/features/chat/components/input-area";
import { BookingDetailDrawer } from "@/features/chat/components/booking-detail-drawer";

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatContent />
    </AuthGuard>
  );
}

function ChatContent() {
  const chat = useChat();
  const { sessions, drawers } = chat;

  return (
    <div className="flex h-dvh">
      <ChatSidebar
        sessions={sessions.sessions}
        currentSessionId={sessions.currentSessionId}
        open={sessions.sidebarOpen}
        onToggle={() => sessions.toggleSidebar()}
        onNewChat={chat.handleCreateNewSession}
        onSelectSession={(id) => {
          chat.handleLoadSession(id);
          if (window.innerWidth < 768) sessions.toggleSidebar(false);
        }}
        onDeleteSession={sessions.deleteSession}
        onTogglePin={sessions.togglePin}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuToggle={() => sessions.toggleSidebar()} />

        <div className="flex-1 overflow-y-auto">
          <div className={`mx-auto px-4 py-6 space-y-6 ${drawers.anyDrawerOpen ? "max-w-3xl" : "max-w-4xl"} transition-all`}>
            {chat.notifications.length > 0 && (
              <NotificationBanner notifications={chat.notifications} onDismiss={chat.dismissNotification} />
            )}
            {chat.messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onCountrySelect={chat.handleCountrySelect}
                onBooking={drawers.openBooking}
                onVoiceBooking={drawers.openVoiceBooking}
                onOpenSource={drawers.openSource}
                bookedItems={drawers.bookedItems}
                onViewBooking={drawers.viewBooking}
              />
            ))}
            <div ref={chat.bottomRef} />
          </div>
        </div>

        <InputArea
          input={chat.input}
          setInput={chat.setInput}
          loading={chat.loading}
          mode={chat.mode}
          setMode={chat.setMode}
          selectedCountry={chat.selectedCountry}
          anyDrawerOpen={drawers.anyDrawerOpen}
          onSubmit={() => chat.handleSubmit()}
          onKeyDown={chat.handleKeyDown}
          addPreset={chat.addPreset}
        />
      </div>

      <BookingDrawer
        open={drawers.bookingOpen}
        onClose={() => drawers.setBookingOpen(false)}
        item={drawers.bookingItem}
        sessionId={sessions.currentSessionId || ""}
        onBookingComplete={drawers.completeBooking}
      />

      <VoiceBookingDrawer
        open={drawers.voiceBookingOpen}
        onClose={() => drawers.setVoiceBookingOpen(false)}
        item={drawers.voiceBookingItem}
        sessionId={sessions.currentSessionId || ""}
        onComplete={drawers.completeVoiceBooking}
      />

      <SourceDrawer
        open={drawers.sourceDrawerOpen}
        onClose={() => drawers.setSourceDrawerOpen(false)}
        url={drawers.sourceDrawerUrl}
        notes={drawers.sourceDrawerNotes}
      />

      {drawers.viewBookingOpen && drawers.viewBookingName && drawers.bookedItemsMap.has(drawers.viewBookingName) && (
        <BookingDetailDrawer
          open={drawers.viewBookingOpen}
          onClose={() => drawers.setViewBookingOpen(false)}
          itemName={drawers.viewBookingName}
          booking={drawers.bookedItemsMap.get(drawers.viewBookingName)!}
          onCancel={drawers.cancelBooking}
        />
      )}
    </div>
  );
}
